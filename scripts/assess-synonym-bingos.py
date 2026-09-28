#!/usr/bin/env python3
"""Count synonym letter overlaps offline; does not generate or publish puzzles.

Uses only distinct, admitted source lemmas sharing an exact OEWN synset.
Inflections, substring answers, and semantic graph expansion are excluded.
The output is a lexical feasibility census, not an editorial approval or a
proof of playable boards, useful refill paths, or difficulty progression.
"""

import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def armour_capacity(enemy, answer):
    """Same allocation as bingoArmour: at most one extra hit per enemy tile."""
    return sum(min(count, answer[letter] - count) for letter, count in enemy.items())


def census():
    catalog_path = ROOT / 'src/lexicon/data/oewn-2025-meanings-v1.json.gz'
    frequency_path = ROOT / 'src/generator/data/familiarity-v1.json'
    catalog_bytes = catalog_path.read_bytes()
    metadata = json.loads((catalog_path.parent / 'oewn-2025-meanings-v1-metadata.json').read_text())
    if digest(catalog_bytes) != metadata['catalog']['sha256']:
        raise ValueError('Meaning catalog differs from the pinned metadata')
    catalog = json.loads(gzip.decompress(catalog_bytes))
    frequency_bytes = frequency_path.read_bytes()
    frequency_data = json.loads(frequency_bytes)
    frequency = {word: score / 100 for score, words in frequency_data['bins'] for word in words.split()}

    # Form 0 is an actual lemma, not a plural or conjugation inferred by the
    # catalog builder. A spelling may still independently be a lemma in a sense.
    groups = defaultdict(set)
    for word, entries in catalog['words'].items():
        if not 3 <= len(word) <= 16:
            continue
        for entry, form in entries:
            if form != 0:
                continue
            for sense in catalog['entries'][entry][3]:
                groups[catalog['senses'][sense][2]].add(word)

    counts = {word: Counter(word) for words in groups.values() for word in words}
    enemies = {word for word in counts if len(word) <= 8}
    pairs = {}
    any_overlap = set()
    familiar_overlap = set()
    has_synonym = set()
    for synset, members in sorted(groups.items()):
        for enemy in sorted(members):
            if enemy not in enemies:
                continue
            for answer in sorted(members):
                if enemy == answer or enemy in answer:
                    continue
                has_synonym.add(enemy)
                shared = sum((counts[enemy] & counts[answer]).values())
                if not shared:
                    continue
                any_overlap.add(enemy)
                if min(frequency[enemy], frequency[answer]) >= 3:
                    familiar_overlap.add(enemy)
                if shared != len(enemy):
                    continue
                pair = pairs.setdefault((enemy, answer), {
                    'enemy': enemy, 'answer': answer,
                    'enemyZipf': frequency[enemy], 'answerZipf': frequency[answer],
                    'armourCapacity': armour_capacity(counts[enemy], counts[answer]),
                    'senses': [],
                })
                # Potential alternatives under this exact sense, irrespective
                # of board/refills. Do not conflate unrelated enemy senses.
                alternatives = [word for word in sorted(members)
                                if word not in (enemy, answer) and enemy not in word
                                and len(word) <= 12 and frequency[word] >= 3
                                and counts[enemy].keys() & counts[word].keys()]
                source = catalog['synsets'][synset]
                pair['senses'].append({
                    'id': source[0], 'partOfSpeech': source[1],
                    'definitions': source[2], 'familiarOverlappingAlternatives': alternatives,
                })

    candidates = sorted(pairs.values(), key=lambda row: (row['enemy'], row['answer']))

    def totals(minimum=0, armour=0, long_answer=False, alternatives=0):
        selected = [row for row in candidates
                    if min(row['enemyZipf'], row['answerZipf']) >= minimum
                    and row['armourCapacity'] >= armour
                    and (not long_answer or 7 <= len(row['answer']) <= 15)
                    and any(len(sense['familiarOverlappingAlternatives']) >= alternatives
                            for sense in row['senses'])]
        return {'enemySpellings': len({row['enemy'] for row in selected}), 'pairs': len(selected)}

    summary = {
        'method': 'Exact-synset, distinct-lemma, no-substring synonym letter census v1',
        'source': {'name': 'Open English Wordnet 2025', 'catalogSha256': digest(catalog_bytes),
                   'synsets': len(catalog['synsets']), 'coveredSpellings': len(catalog['words']),
                   'url': 'https://en-word.net/', 'license': 'CC-BY-4.0'},
        'familiarity': {'version': frequency_data['version'], 'sha256': digest(frequency_bytes),
                        'dictionarySpellings': frequency_data['counts']['queried'],
                        'familiarMinimumZipf': 3},
        'policy': {
            'enemyLength': [3, 8], 'answerLength': [3, 16],
            'enemyAndAnswerMustBeSourceLemmas': True,
            'sameSpellingExcluded': True, 'answerContainingEnemySubstringExcluded': True,
            'semanticExpansion': 'none; one exact source synset is required',
            'fullCoverage': 'multiset containment, respecting repeated enemy letters',
            'armour': 'one extra hit per enemy position, when the answer has a spare copy',
            'frequencyIsSenseSpecific': False,
            'regionalVariantsAndRelatedDerivationsMayRemain': True,
            'boardsAndRoutesVerified': False,
        },
        'counts': {
            'eligibleEnemyLemmas': len(enemies),
            'eligibleFamiliarEnemyLemmas': sum(frequency[word] >= 3 for word in enemies),
            'enemiesWithDistinctNonSubstringSynonym': len(has_synonym),
            'enemiesSharingAtLeastOneLetter': len(any_overlap),
            'familiarEnemiesSharingAtLeastOneLetterWithFamiliarSynonym': len(familiar_overlap),
            'fullCoverage': totals(),
            'fullCoverageFamiliar': totals(minimum=3),
            'fullCoverageFamiliarLongAnswer': totals(minimum=3, long_answer=True),
            'fullCoverageFamiliarOneArmour': totals(minimum=3, armour=1),
            'fullCoverageFamiliarTwoArmour': totals(minimum=3, armour=2),
            'fullCoverageTwoArmour': totals(armour=2),
            'familiarTwoArmourAndTwoAlternatives': totals(minimum=3, armour=2, alternatives=2),
            'familiarTwoArmourAndFourAlternatives': totals(minimum=3, armour=2, alternatives=4),
        },
    }
    return summary, candidates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Optional research artifact directory')
    args = parser.parse_args()
    summary, candidates = census()
    text = json.dumps(summary, indent=2) + '\n'
    if args.output:
        args.output.mkdir(parents=True, exist_ok=True)
        (args.output / 'summary.json').write_text(text)
        encoded = (json.dumps(candidates, sort_keys=True, separators=(',', ':')) + '\n').encode()
        (args.output / 'candidates.json.gz').write_bytes(gzip.compress(encoded, mtime=0))
    print(text, end='')


if __name__ == '__main__':
    main()
