import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { challengeShareText, scoreShareUrl, sharedPuzzleDate } from '../src/daily/scoreShare.ts'
import { puzzleLocation } from '../src/daily/calendar.ts'
import { scoreSharePage } from '../scripts/lib/scoreSharePage.ts'

const date = '2026-09-27'
const site = 'https://example.com/wyrmle/'

test('share URLs reflect the best result, including historical long wins and unsolved games', () => {
  for (const [words, stars] of [[1, 3], [2, 2], [3, 1], [5, 1]]) {
    assert.equal(scoreShareUrl(date, words, site), `${site}share/${date}/${stars}/`)
    const text = challengeShareText({ date, bestWords: words }, site)
    assert.ok(text.includes(`${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`))
    assert.equal(text.split('https://').length, 2, 'Only one share link')
  }
  assert.equal(scoreShareUrl(date, null, site), `${site}?daily=${date}`)
  assert.equal(scoreShareUrl(date, 1, 'https://example.com'), `https://example.com/share/${date}/3/`)
  assert.throws(() => scoreShareUrl('2026-02-30', 1, site))
  for (const invalid of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => scoreShareUrl(date, invalid, site))
})

test('receiving a score link selects a puzzle date without importing a score', () => {
  for (const stars of [1, 2, 3]) {
    assert.deepEqual(puzzleLocation('', `/wyrmle/share/${date}/${stars}/`), {
      date, calendar: false, month: null, replacement: `?daily=${date}`,
    })
    assert.equal(sharedPuzzleDate(`/share/${date}/${stars}/index.html`), date)
  }
  assert.equal(puzzleLocation('?calendar', `/share/${date}/3/`).calendar, true)
  assert.equal(puzzleLocation('?daily=2026-09-26', `/share/${date}/3/`).date, '2026-09-26')
  for (const path of ['/share/2026-02-30/3/', `/share/${date}/9/`, '/']) assert.equal(sharedPuzzleDate(path), null)
})

test('each score page has unique crawler-readable metadata and retains the playable app', () => {
  const html = readFileSync('index.html', 'utf8')
  for (const stars of [1, 2, 3] as const) {
    const page = scoreSharePage(html, date, stars, site)
    assert.equal((page.match(/property="og:title"/g) ?? []).length, 1)
    assert.equal((page.match(/property="og:image"/g) ?? []).length, 1)
    assert.equal((page.match(/name="description"/g) ?? []).length, 1)
    assert.ok(page.includes(`content="${site}share/${date}/${stars}/"`))
    assert.ok(page.includes(`content="${site}share-cards/${stars}-stars-v1.png"`))
    assert.match(page, new RegExp(`WYRMLE · 27 Sept? 2026 · ${'★'.repeat(stars)}`))
    assert.ok(page.includes('<div id="root"></div>'))
    assert.ok(page.includes('src="/src/main.tsx"'))
    assert.ok(!/EXTINGUISH|IRRIGATED/.test(page), 'No answer in shared HTML')
  }
})
