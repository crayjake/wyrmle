import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import report from '../artifacts/bingo-feasibility-2026-09-26/candidates.json' with { type: 'json' }
import { bingoPreviews, bingoPreviewHref, leaveBingoPreviewHref, readBingoPreviewRequest } from '../src/experimental/bingo/catalog.ts'
import { decodeBingoPreview } from '../src/experimental/bingo/previewData.ts'
import { createLetterStrikeGame, submitLetterStrike } from '../src/game/letterStrike.ts'
import { selectWordIds } from '../src/generator/constructRefill.ts'

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

test('all ten frozen previews reproduce the assessed boards and winning routes at every life count', () => {
  const earlier = bingoPreviews.filter(entry => entry.collection !== 'new')
  assert.equal(earlier.length, 10)
  assert.equal(new Set(bingoPreviews.map(entry => entry.id)).size, bingoPreviews.length)
  for (const [index, entry] of earlier.entries()) {
    const original = report[index]
    const payload = JSON.parse(readFileSync(new URL(`../public/${entry.asset}`, import.meta.url), 'utf8'))
    for (const lives of [3, 4, 5] as const) {
      const encounter = decodeBingoPreview(payload, entry, lives)
      assert.equal(encounter.startingTiles.map(tile => tile.letter).join(''), original.board)
      assert.equal(encounter.refillQueue, original.refills)
      assert.equal(Object.keys(encounter.meaningLexicon!.words).length, original.meaningWords)
      const initial = createLetterStrikeGame(encounter)
      const bingo = selectWordIds(initial.tiles, original.bingo)
      assert.ok(bingo)
      const win = submitLetterStrike(initial, bingo)
      assert.equal(win.status, 'won', `${entry.id}/${lives} bingo`)
      assert.equal(win.playerResolve, lives - 1)
      for (const root of original.analysis.rootReports) {
        const witness = root.witness
        if (!witness || witness.words.length > lives) continue
        let state = initial
        for (const [turn, ids] of witness.tileIds.entries()) {
          state = submitLetterStrike(state, ids)
          assert.equal(state.error, null)
          assert.equal(state.playedWords.at(-1)!.word, witness.words[turn])
          assert.equal(state.playedWords.at(-1)!.semanticLabel, witness.labels[turn])
          assert.equal(state.playedWords.at(-1)!.strikes, witness.hits[turn])
        }
        assert.equal(state.status, 'won', `${entry.id}/${lives} ${root.word}`)
      }
    }
  }
})

test('preview decoding rejects missing, mismatched or stale assets', () => {
  const entry = bingoPreviews[0]
  const payload = JSON.parse(readFileSync(new URL(`../public/${entry.asset}`, import.meta.url), 'utf8'))
  assert.throws(() => decodeBingoPreview(null, entry, 3), /Invalid preview/)
  assert.throws(() => decodeBingoPreview({ ...payload, id: 'bingo-fear-1' }, entry, 3), /match/)
  assert.throws(() => decodeBingoPreview({ ...payload, semanticStatus: 'certified' }, entry, 3), /match/)
  assert.throws(() => decodeBingoPreview({ ...payload, encounter: { ...payload.encounter, refillQueue: 'ZZZZ' } }, entry, 3), /stale/)
})
