#!/usr/bin/env python3
"""Offline importer and provenance regression checks; run with python3."""
from pathlib import Path
import gzip, hashlib, importlib.util, json, sys
sys.dont_write_bytecode = True
root = Path.cwd()
spec = importlib.util.spec_from_file_location('function_words', root / 'scripts/build-function-words.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
directory = root / 'src/lexicon/data'
snapshot_bytes = (directory / 'function-words-source-v1.json.gz').read_bytes()
assert hashlib.sha256(snapshot_bytes).hexdigest() == module.SNAPSHOT_SHA256
snapshot = json.loads(gzip.decompress(snapshot_bytes))
allowed = set(json.loads((root / 'node_modules/an-array-of-english-words/index.json').read_text()))
words, rejected = module.build(snapshot, allowed)
export = json.loads((directory / 'function-words-v1.json').read_text())
assert words == export['words']
source_ids = {s.get('id', s.get('sourceLocator')) for r in snapshot['records'] for s in r['senses']}
seen = set()
for word in words.values():
    for sense in word['senses']:
        assert sense['sourceSenseId'] in source_ids
        payload = {key: sense[key] for key in ['lemma','partOfSpeech','sourceSenseId','glosses','tags','formOf','altOf']}
        assert sense['id'] == 'wikt-en-' + hashlib.sha256(module.encoded(payload)).hexdigest()[:20]
        assert sense['id'] not in seen
        seen.add(sense['id'])
        if sense['formOf'] or sense['altOf']:
            assert sense['resolvedReferences']
            assert sense['definition'] == ' '.join(sense['glosses']) + ' ' + sense['resolvedReferences'][0]['definition']
        else:
            assert sense['definition'] == ' '.join(sense['glosses'])
        def check_refs(refs, visited):
            for ref in refs:
                assert ref['word'] not in visited
                candidates = [s for row in snapshot['records'] if row['word'] == ref['word'] for s in row['senses']]
                assert any(' '.join(s.get('glosses', [])) == ref['definition'] for s in candidates)
                assert ref['sourceUrl'] == 'https://en.wiktionary.org/wiki/' + ref['word'] + '#English'
                check_refs(ref['references'], visited | {ref['word']})
        check_refs(sense.get('resolvedReferences', []), {word['lemma']})
def fixture(word, definition=None, ref=None, tags=None):
    sense = {'id': word, 'glosses': [definition] if definition is not None else [], 'tags': tags or []}
    if ref: sense['form_of'] = [{'word': ref}]
    return {'word': word, 'pos': 'pron', 'tags': [], 'senses': [sense]}
fixtures = [fixture('base', 'A source definition.'), fixture('form', 'Plural of base.', 'base'),
            fixture('missing'), fixture('placeholder', 'Definition needed.'),
            fixture('old', 'An old form.', tags=['obsolete']),
            fixture('cyclea', 'See cycleb.', 'cycleb'), fixture('cycleb', 'See cyclea.', 'cyclea'),
            fixture('orphan', 'See unknown.', 'unknown')]
accepted, rejected = module.build({'records': fixtures}, {r['word'] for r in fixtures})
assert set(accepted) == {'BASE', 'FORM'}
assert rejected['missingOrPlaceholderDefinition'] == 2
assert rejected['unresolvedFormReference'] == 3
print('ok')
