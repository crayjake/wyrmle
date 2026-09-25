import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { test } from 'node:test'
import { getDictionaryMeaning } from '../src/lexicon/meaningDictionary.ts'

const dataDirectory = new URL('../src/lexicon/data/', import.meta.url)
const read = (name: string) => readFileSync(new URL(name, dataDirectory))
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

// Independent player vocabulary audit. This is deliberately not generated from
// the imported headwords or copied from the export's successful coverage result.
const everydayWords = `the and that have for not with you this but his from they say her she
will one all would there their what out about who get which when make can like time just
him know take people into year your good some could them see other than then now look only
come its over think also back after use two how our work first well way even new want
because any these give day most us are were was been being has had does did doing may
might must should shall where why whose whom anyone anybody anything everybody everyone
everything nobody nothing somebody someone something each either neither both such enough
several few many much less little more another every those myself yourself himself herself
itself ourselves themselves yours ours theirs although though unless until while since
during among amongst amid amidst along across against around before behind below beside
besides between beyond despite down except inside near off onto opposite outside past per
round through throughout toward towards under underneath unlike upon versus via within
without yet nor so whereas wherever whenever whatever whoever whichever whomever whether
once`.toUpperCase().split(/\s+/)

test('all 191 everyday audit words have a real definition in the merged dictionary', () => {
  assert.equal(new Set(everydayWords).size, 191)
  for (const word of everydayWords) {
    const meaning = getDictionaryMeaning(word)
    assert.ok(meaning?.definition.trim(), `${word} has no definition`)
    assert.ok(meaning.senseId && meaning.partsOfSpeech.length, `${word} has no source sense or POS`)
  }
  assert.equal(getDictionaryMeaning('WHERE')?.definition, 'In, at or to what place.')
  for (const word of ['WHERE', 'HOW', 'THE', 'AND', 'WOULD', 'COULD', 'SHOULD', 'SHALL']) {
    assert.equal(getDictionaryMeaning(word)?.source, 'wiktionary-en')
  }
})

test('function-word data and offline source retain their pinned checksums', () => {
  const metadata = JSON.parse(read('function-words-v1-metadata.json').toString())
  const snapshot = read('function-words-source-v1.json.gz')
  const source = JSON.parse(gunzipSync(snapshot).toString())
  assert.equal(sha(snapshot), metadata.snapshot.sha256)
  assert.equal(sha(read('function-words-v1.json')), metadata.export.sha256)
  assert.equal(source.version, metadata.version)
  assert.deepEqual(source.sources, metadata.sources)
  assert.equal(source.source.license, 'CC-BY-SA-4.0')
  assert.equal(source.sources.length, 22)
  for (const input of source.sources) {
    assert.match(input.sha256, /^[a-f0-9]{64}$/)
    assert.ok(input.bytes > 0)
    assert.ok(input.url.startsWith('https://kaikki.org/dictionary/English/'))
  }
})

test('every supplemental definition has an exact pinned source and any form reference resolves', () => {
  const exported = JSON.parse(read('function-words-v1.json').toString())
  const snapshot = JSON.parse(gunzipSync(read('function-words-source-v1.json.gz')).toString())
  const sourceIds = new Set(snapshot.records.flatMap((row: { senses: { id?: string; sourceLocator?: string }[] }) =>
    row.senses.map(sense => sense.id ?? sense.sourceLocator)))
  const seen = new Set<string>()
  type Reference = { word: string; senseId: string; definition: string; sourceUrl: string; references: Reference[] }
  type Sense = { id: string; lemma: string; partOfSpeech: string; sourceSenseId: string; glosses: string[];
    tags: string[]; formOf: object[]; altOf: object[]; definition: string; resolvedReferences?: Reference[] }
  function checkReferences(references: Reference[], visited: Set<string>) {
    for (const reference of references) {
      assert.ok(!visited.has(reference.word), 'form reference cycle')
      assert.equal(reference.sourceUrl, `https://en.wiktionary.org/wiki/${reference.word}#English`)
      const senses = snapshot.records.filter((row: { word: string }) => row.word === reference.word)
        .flatMap((row: { senses: { glosses?: string[] }[] }) => row.senses)
      assert.ok(senses.some((sense: { glosses?: string[] }) => sense.glosses?.join(' ') === reference.definition),
        `${reference.word} reference lacks a source definition`)
      checkReferences(reference.references, new Set([...visited, reference.word]))
    }
  }
  for (const word of Object.values(exported.words) as { lemma: string; senses: Sense[] }[]) {
    for (const sense of word.senses) {
      assert.ok(sourceIds.has(sense.sourceSenseId))
      const payload = { lemma: sense.lemma, partOfSpeech: sense.partOfSpeech, sourceSenseId: sense.sourceSenseId,
        glosses: sense.glosses, tags: sense.tags, formOf: sense.formOf, altOf: sense.altOf }
      assert.equal(sense.id, `wikt-en-${sha(JSON.stringify(payload) + '\n').slice(0, 20)}`)
      assert.ok(!seen.has(sense.id))
      seen.add(sense.id)
      if (sense.formOf.length || sense.altOf.length) {
        assert.ok(sense.resolvedReferences?.length)
        assert.equal(sense.definition, `${sense.glosses.join(' ')} ${sense.resolvedReferences[0].definition}`)
      } else {
        assert.equal(sense.definition, sense.glosses.join(' '))
      }
      checkReferences(sense.resolvedReferences ?? [], new Set([word.lemma]))
    }
  }
  assert.equal(seen.size, JSON.parse(read('function-words-v1-metadata.json').toString()).coverage.senseCount)
})
