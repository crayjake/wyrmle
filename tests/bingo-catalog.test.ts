import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { bingoPreviews, bingoPreviewHref, leaveBingoPreviewHref, readBingoPreviewRequest } from '../src/experimental/bingo/catalog.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'

test('production preview URLs preserve the legacy beta and constrain life counts', () => {
  assert.equal(readBingoPreviewRequest(''), null)
  assert.equal(readBingoPreviewRequest('?preview=unrelated'), null)
  assert.deepEqual(readBingoPreviewRequest('?preview=bingo'), { id: 'bingo', lives: 3 })
  assert.deepEqual(readBingoPreviewRequest('?preview=bingos&lives=4'), { id: 'bingos', lives: 4 })
  for (const lives of [3, 4, 5] as const) for (const entry of bingoPreviews) {
    assert.deepEqual(readBingoPreviewRequest(bingoPreviewHref(entry.id, lives)), { id: entry.id, lives })
  }
  for (const value of ['0', '-1', '1000000', 'Infinity', '4oops']) {
    assert.equal(readBingoPreviewRequest(`?preview=bingo-chaos-1&lives=${value}`)?.lives, 3)
  }
  // Bad preview names remain in the isolated picker, never silently mount a daily.
  assert.deepEqual(readBingoPreviewRequest('?preview=bingo-missing'), { id: 'bingo-missing', lives: 3 })
  assert.equal(leaveBingoPreviewHref('https://example.com/wyrmle/?preview=bingo-chaos-1&lives=4&set=earlier&foo=bar'),
    'https://example.com/wyrmle/?foo=bar')
})

test('the library contains only the five maintained bingo-first previews', () => {
  assert.equal(bingoPreviews.length, 5)
  assert.ok(bingoPreviews.every(entry => entry.collection === 'new'))
  assert.equal(new Set(bingoPreviews.map(entry => entry.id)).size, bingoPreviews.length)
})

test('preview decoding rejects missing, mismatched or stale assets', () => {
  const entry = bingoPreviews[0]
  const payload = JSON.parse(readFileSync(new URL(`../public/${entry.asset}`, import.meta.url), 'utf8'))
  assert.throws(() => decodeBingoPreview(null, entry, 3), /Invalid preview/)
  assert.throws(() => decodeBingoPreview({ ...payload, id: 'bingo-fear-1' }, entry, 3), /match/)
  assert.throws(() => decodeBingoPreview({ ...payload, semanticStatus: 'certified' }, entry, 3), /match/)
  assert.throws(() => decodeBingoPreview({ ...payload, encounter: { ...payload.encounter, refillQueue: 'ZZZZ' } }, entry, 3), /stale/)
})
