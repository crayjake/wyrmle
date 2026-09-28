import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultPreferences, getOnboardingStage, loadPreferences, PREFERENCES_KEY, savePreferences } from '../src/preferences.ts'
import type { StorageLike } from '../src/daily/types.ts'

class MemoryStorage implements StorageLike {
  data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

test('two rings and circular tiles are the defaults; explicit layout choices still persist', () => {
  const storage = new MemoryStorage()
  assert.equal(loadPreferences(storage).boardLayout, 'wheel')
  assert.equal(loadPreferences(storage).tileShape, 'circle')
  savePreferences(storage, { ...defaultPreferences(), boardLayout: 'grid', tileShape: 'square' })
  assert.equal(loadPreferences(storage).boardLayout, 'grid')
  assert.equal(loadPreferences(storage).tileShape, 'square')
  savePreferences(storage, { ...defaultPreferences(), boardLayout: 'ring', tileShape: 'circle' })
  assert.equal(loadPreferences(storage).boardLayout, 'ring')
  assert.equal(loadPreferences(storage).tileShape, 'circle')
  storage.setItem(PREFERENCES_KEY, JSON.stringify({ boardLayout: 'invalid', tileShape: 'triangle' }))
  assert.equal(loadPreferences(storage).boardLayout, 'wheel')
  assert.equal(loadPreferences(storage).tileShape, 'circle')
  assert.equal(loadPreferences(storage).preferredMode, 'normal')
})

test('first visit recommends Normal and enters tutorial without creating Daily data', () => {
  const storage = new MemoryStorage()
  const preferences = loadPreferences(storage)
  assert.deepEqual(preferences, defaultPreferences())
  assert.equal(getOnboardingStage(preferences), 'tutorial')
  assert.equal(storage.length, 0)
  savePreferences(storage, preferences)
  assert.deepEqual([...storage.data.keys()], [PREFERENCES_KEY])
})

test('existing players move to two circular rings once, then can save a different layout', () => {
  const storage = new MemoryStorage()
  storage.setItem(PREFERENCES_KEY, JSON.stringify({ preferredMode: 'hard', hasCompletedOnboarding: true,
    hasChosenMode: true, boardLayout: 'grid', tileShape: 'square' }))
  const migrated = loadPreferences(storage)
  assert.equal(migrated.boardLayout, 'wheel')
  assert.equal(migrated.tileShape, 'circle')
  assert.equal(migrated.preferredMode, 'hard')
  assert.equal(migrated.hasCompletedOnboarding, true)
  savePreferences(storage, { ...migrated, boardLayout: 'grid', tileShape: 'square' })
  assert.equal(loadPreferences(storage).boardLayout, 'grid')
  assert.equal(loadPreferences(storage).tileShape, 'square')
})

test('skip/completion survives interruption at mode selection without repeating tutorial', () => {
  const storage = new MemoryStorage()
  savePreferences(storage, { ...defaultPreferences(), hasCompletedOnboarding: true })
  assert.equal(getOnboardingStage(loadPreferences(storage)), 'mode')
  savePreferences(storage, { preferredMode: 'hard', hasCompletedOnboarding: true, hasChosenMode: true })
  assert.equal(loadPreferences(storage).preferredMode, 'hard')
  assert.equal(getOnboardingStage(loadPreferences(storage)), null)
})

test('Hardcore is a durable preferred mode and does not change onboarding completion', () => {
  const storage = new MemoryStorage()
  savePreferences(storage, { preferredMode: 'hardcore', hasCompletedOnboarding: true, hasChosenMode: true })
  assert.equal(loadPreferences(storage).preferredMode, 'hardcore')
  assert.equal(getOnboardingStage(loadPreferences(storage)), null)
  assert.deepEqual([...storage.data.keys()], [PREFERENCES_KEY])
})

test('Easy mode persists without changing saved games or the Normal default', () => {
  const storage = new MemoryStorage()
  assert.equal(loadPreferences(storage).preferredMode, 'normal')
  savePreferences(storage, { ...defaultPreferences(), preferredMode: 'easy' })
  assert.equal(loadPreferences(storage).preferredMode, 'easy')
  assert.deepEqual([...storage.data.keys()], [PREFERENCES_KEY])
})

test('returning players skip forced onboarding, including historical and damaged Daily records', () => {
  for (const key of ['wyrmle:letter-strike:daily:v1:run:2026-09-24',
    'wyrmle:letter-strike:daily:v1:result:2026-09-24', 'wyrmle:daily:v1:run:2026-09-23']) {
    const storage = new MemoryStorage()
    storage.setItem(key, '{saved-data-not-interpreted-by-preferences')
    assert.equal(getOnboardingStage(loadPreferences(storage)), null)
    assert.equal(loadPreferences(storage).preferredMode, 'normal')
    assert.equal(storage.getItem(key), '{saved-data-not-interpreted-by-preferences')
  }
})

test('changing preference and resetting onboarding touches no Daily records', () => {
  const storage = new MemoryStorage()
  const key = 'wyrmle:letter-strike:daily:v1:run:2026-09-24'
  storage.setItem(key, JSON.stringify({ mode: 'normal', playedWords: ['JOY'] }))
  const original = storage.getItem(key)
  savePreferences(storage, { ...loadPreferences(storage), preferredMode: 'hard' })
  assert.equal(storage.getItem(key), original)
  savePreferences(storage, { ...loadPreferences(storage), hasCompletedOnboarding: false, hasChosenMode: false })
  assert.equal(getOnboardingStage(loadPreferences(storage)), 'tutorial')
  assert.equal(storage.getItem(key), original)
})

test('invalid preference values fall back to Normal and keep returning-player status', () => {
  const storage = new MemoryStorage()
  storage.setItem(PREFERENCES_KEY, JSON.stringify({ preferredMode: 'cheat', hasCompletedOnboarding: true }))
  assert.deepEqual(loadPreferences(storage), { ...defaultPreferences(), hasCompletedOnboarding: true, hasChosenMode: true })
  storage.setItem('wyrmle:daily:run:2026-09-24', 'old')
  for (const value of ['{invalid', 'null', '[]', '"text"']) {
    storage.setItem(PREFERENCES_KEY, value)
    assert.equal(getOnboardingStage(loadPreferences(storage)), null)
  }
})
