import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { test } from 'node:test'
import { sha256 } from '../src/generator/sha256.ts'

const oracle = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

test('browser-safe SHA-256 matches standard short, multi-block and million-byte vectors', () => {
  for (const [text, expected] of [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['a'.repeat(1_000_000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
  ]) {
    assert.equal(sha256(text), expected)
    assert.equal(sha256(text), oracle(text))
  }
})

test('SHA-256 agrees with Node crypto across padding boundaries and random inputs', () => {
  const lengths = [...Array.from({ length: 130 }, (_, index) => index), 255, 256, 511, 512, 1023, 4096, 22_000]
  for (const length of lengths) {
    const text = randomBytes(length).toString('latin1')
    assert.equal(sha256(text), oracle(text), `UTF-8 encoding of ${length} random bytes`)
    // ASCII gives exact byte lengths at 55/56/63/64 and following boundaries.
    const ascii = randomBytes(length).toString('base64').slice(0, length)
    assert.equal(sha256(ascii), oracle(ascii), `${length} ASCII bytes`)
  }
})

test('SHA-256 hashes UTF-8 Unicode and replacement characters consistently', () => {
  for (const text of ['calm 😌 / colère / 怒り', '\0\u0001\u007f\u0080\u07ff\u0800\uffff', '\ud800', '\udc00', 'x\ud800y\udc00z', 'é', 'e\u0301']) {
    assert.equal(sha256(text), oracle(text))
  }
  assert.notEqual(sha256('é'), sha256('e\u0301'), 'Hash bytes exactly; do not silently normalize meanings.')
})
