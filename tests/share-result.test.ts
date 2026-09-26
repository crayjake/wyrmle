import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shareResult } from '../src/daily/shareResult.ts'

test('sharing invokes the native sheet immediately with one text payload and no clipboard write', async () => {
  const calls: unknown[] = []
  const target = {
    share(data: { text: string }) { assert.equal(this, target); calls.push(data); return Promise.resolve() },
    clipboard: { writeText() { assert.fail('Native sharing must not also copy') } },
  }
  const pending = shareResult('WYRMLE\n🟩⬜\nhttps://example.com/', target)
  assert.deepEqual(calls, [{ text: 'WYRMLE\n🟩⬜\nhttps://example.com/' }], 'User activation is not lost to a prior await.')
  assert.equal(await pending, 'shared')
})

test('cancelling the native sheet leaves the clipboard untouched', async () => {
  assert.equal(await shareResult('result', {
    share: async () => { throw new DOMException('Cancelled', 'AbortError') },
    clipboard: { writeText() { assert.fail('Cancellation is not permission to copy') } },
  }), 'cancelled')
})

test('unavailable or failed native sharing falls back to copying the exact result', async () => {
  for (const share of [undefined, async () => { throw new Error('Unavailable share target') }]) {
    const copies: string[] = []
    const clipboard = { async writeText(text: string) { assert.equal(this, clipboard); copies.push(text) } }
    assert.equal(await shareResult('result\n🟥🟩', { share, clipboard }), 'copied')
    assert.deepEqual(copies, ['result\n🟥🟩'])
  }
})

test('missing or blocked clipboard offers manual copying, without throwing', async () => {
  assert.equal(await shareResult('result', {}), 'manual')
  assert.equal(await shareResult('result', { clipboard: { async writeText() { throw new Error('Denied') } } }), 'manual')
  assert.equal(await shareResult('result', {
    share: async () => { throw new DOMException('Denied', 'NotAllowedError') },
  }), 'manual')
})
