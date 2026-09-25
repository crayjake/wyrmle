#!/usr/bin/env python3
"""Compile a pinned OEWN XML archive into deterministic, offline game metadata.

Usage: python3 scripts/build-lexicon.py /path/to/english-wordnet-2025.xml.gz
Download the input explicitly from the URL below. This script has no network
side effects, no per-word exceptions, and never changes the game's validity list.
"""

import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://en-word.net/static/english-wordnet-2025.xml.gz"
VERSION = "oewn-2025-pos-v1"
SOURCE_SHA256 = "9ca6d1dcb75f822fdd66617f7d9da48142ace38dd544d6ad5e2feca1674ad3fe"
DICTIONARY_SHA256 = "dadb53f5df46b5b26577fe1cadc85bf076d2d04cf554f6fcda693f2704555e06"
POS = {"n": 1, "v": 2, "a": 4, "s": 4, "r": 8}
# These sense selections are configuration, not word exceptions. They prevent
# e.g. CHAOS the physics concept and FEAR meaning reverence entering combat.
ENEMY_SENSES = {
    "ANGER": "oewn-anger__1.12.00..",
    "CHAOS": "oewn-chaos__1.26.00..",
    "CRUELTY": "oewn-cruelty__1.04.00..",
    "DESPAIR": "oewn-despair__1.12.00..",
    "FEAR": "oewn-fear__1.12.00..",
    "MELANCHOLY": "oewn-melancholy__1.12.00..",
}


def regular_forms(word, pos, has_explicit_forms=False):
    """Conservative spelling rules, subsequently intersected with validity.

    Inflection preserves POS. In particular -ed/-ing verbs are NOT automatically
    adjectives, and adjective+ly is NOT assumed to be an adverb. OEWN's explicit
    forms supply irregulars; doubled consonants are limited to a single vowel
    group so unknown stress patterns do not generate speculative forms.
    """
    if len(word) < 2:
        return set()
    vowel = "aeiou"
    consonant_y = word.endswith("y") and word[-2] not in vowel
    doubled = (len(word) >= 3 and word[-1] not in vowel + "wxy"
               and word[-2] in vowel and word[-3] not in vowel
               and len(re.findall(r"[aeiou]+", word)) == 1)
    if pos in (1, 2):
        plural = (word[:-1] + "ies" if consonant_y else word + "es"
                  if word.endswith(("s", "x", "z", "ch", "sh")) else word + "s")
        forms = {plural}
        if pos == 1:
            return forms
        forms.add(word[:-1] + "ied" if consonant_y else word + "d"
                  if word.endswith("e") else word + "ed")
        forms.add(word[:-2] + "ying" if word.endswith("ie") else word[:-1] + "ing"
                  if word.endswith("e") and not word.endswith(("ee", "ye", "oe")) else word + "ing")
        if doubled:
            forms.update({word + word[-1] + "ed", word + word[-1] + "ing"})
        return forms
    if pos == 4 and not has_explicit_forms:
        # Do not turn an explicitly irregular adjective into regular variants.
        stem = word[:-1] + "i" if consonant_y else word[:-1] if word.endswith("e") else word
        forms = {stem + "er", stem + "est"}
        if doubled:
            forms.update({word + word[-1] + "er", word + word[-1] + "est"})
        return forms
    return set()


def grouped_masks(masks):
    groups = defaultdict(list)
    for word, mask in sorted(masks.items()):
        groups[str(mask)].append(word)
    return {mask: " ".join(groups[mask]) for mask in sorted(groups, key=int)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Cached official OEWN 2025 .xml.gz")
    args = parser.parse_args()
    source_bytes = args.source.read_bytes()
    dictionary_path = ROOT / "node_modules/an-array-of-english-words/index.json"
    dictionary_bytes = dictionary_path.read_bytes()
    if hashlib.sha256(source_bytes).hexdigest() != SOURCE_SHA256:
        raise SystemExit("Source checksum differs from the pinned 2025 release; create a new lexical version before changing source data.")
    if hashlib.sha256(dictionary_bytes).hexdigest() != DICTIONARY_SHA256:
        raise SystemExit("Validity dictionary checksum changed; create a new lexical version before recompiling.")
    dictionary = set(json.loads(dictionary_bytes))
    allowed = {word for word in dictionary if re.fullmatch(r"[a-z]+", word)}
    lexicon = ET.fromstring(gzip.decompress(source_bytes)).find("Lexicon")
    if lexicon is None or lexicon.get("id") != "oewn" or lexicon.get("version") != "2025":
        raise SystemExit("Expected the official Open English Wordnet 2025 archive.")

    direct = defaultdict(int)
    inferred = defaultdict(int)
    entry_forms = {}
    senses = {}
    synset_senses = defaultdict(list)
    synsets = {node.get("id"): node for node in lexicon.findall("Synset")}
    for entry in lexicon.findall("LexicalEntry"):
        lemma = entry.find("Lemma")
        word = lemma.get("writtenForm", "").lower()
        pos = POS.get(lemma.get("partOfSpeech"))
        forms = {form.get("writtenForm", "").lower() for form in entry.findall("Form")}
        explicit = {word, *forms} & allowed
        regular = (regular_forms(word, pos, bool(forms)) & allowed
                   if pos and re.fullmatch(r"[a-z]+", word) else set())
        entry_forms[entry.get("id")] = explicit | regular
        if pos:
            for form in explicit:
                direct[form.upper()] |= pos
            for form in regular:
                inferred[form.upper()] |= pos
        for sense in entry.findall("Sense"):
            sense_id = sense.get("id")
            senses[sense_id] = {"entry": entry.get("id"), "word": word,
                                "synset": sense.get("synset"), "node": sense}
            synset_senses[sense.get("synset")].append(sense_id)

    # Keep only additional inferred information; this also keeps the bundle small.
    inferred = {word: mask & ~direct.get(word, 0) for word, mask in inferred.items()
                if mask & ~direct.get(word, 0)}
    relations = {}
    for enemy, selected_id in sorted(ENEMY_SENSES.items()):
        selected = senses[selected_id]
        selected_synset = selected["synset"]
        groups = {name: set() for name in ("similar", "opposite", "related")}
        evidence = defaultdict(list)

        def add(sense_id, category, relation, from_sense):
            if sense_id not in senses:
                raise ValueError(f"Missing source sense: {sense_id}")
            target = senses[sense_id]
            for form in entry_forms[target["entry"]]:
                upper = form.upper()
                groups[category].add(upper)
                evidence[upper].append({"category": category, "relation": relation,
                                        "fromSense": from_sense, "toSense": sense_id})

        # Only synonyms in the chosen noun sense, direct antonyms of those senses,
        # and a single derivation edge. No transitive relatedness or sentiment.
        for sense_id in sorted(synset_senses[selected_synset]):
            add(sense_id, "similar", "same-synset", selected_id)
            for edge in senses[sense_id]["node"].findall("SenseRelation"):
                kind = edge.get("relType")
                if kind in ("antonym", "derivation"):
                    add(edge.get("target"), "opposite" if kind == "antonym" else "related", kind, sense_id)
        # Deterministic conflict precedence agrees with the runtime categories.
        groups["similar"] -= groups["opposite"]
        groups["related"] -= groups["opposite"] | groups["similar"]
        relations[enemy] = {**{name: sorted(words) for name, words in groups.items()},
                            "provenance": {"source": "Open English Wordnet 2025", "sense": selected_id,
                                           "synset": selected_synset,
                                           "definition": synsets[selected_synset].findtext("Definition"),
                                           "evidence": dict(sorted(evidence.items()))}}

    all_words = set(direct) | set(inferred)
    metadata = {
        "version": VERSION,
        "source": {"name": "Open English Wordnet", "version": "2025", "url": SOURCE_URL,
                   "license": "CC-BY-4.0", "sha256": hashlib.sha256(source_bytes).hexdigest()},
        "dictionary": {"package": "an-array-of-english-words", "version": "2.0.0",
                       "sha256": hashlib.sha256(dictionary_bytes).hexdigest(), "words": len(dictionary)},
        "coverage": {"wordnetWords": len(direct), "morphologyOnlyWords": len(set(inferred) - set(direct)),
                     "wordsWithAdditionalInferredPos": len(inferred), "coveredWords": len(all_words),
                     "unknownWords": len(dictionary) - len(all_words)},
        "posBits": {"noun": 1, "verb": 2, "adjective": 4, "adverb": 8},
        "morphologyPolicy": "Regular noun/verb inflections; adjective comparatives without explicit irregular forms; dictionary intersection. No participle-to-adjective or -ly inference.",
        "semanticPolicy": "Selected noun synset synonyms, direct sense antonyms and one derivation edge; explicit and regular forms inherit that entry's relation. Missing relation is unknown, never proof of unrelated meaning.",
    }
    output = ROOT / "src/lexicon/data"
    output.mkdir(parents=True, exist_ok=True)
    for name, value, pretty in [("oewn-2025-pos-v1.json", {"wordnet": grouped_masks(direct), "morphology": grouped_masks(inferred)}, False),
                                ("oewn-2025-relations-v1.json", relations, True),
                                ("oewn-2025-metadata-v1.json", metadata, True)]:
        text = json.dumps(value, ensure_ascii=True, indent=2 if pretty else None,
                          separators=None if pretty else (",", ":")) + "\n"
        (output / name).write_text(text)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
