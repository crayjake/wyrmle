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

test('first visit recommends Normal and enters tutorial without creating Daily data', () => {
  const storage = new MemoryStorage()
  const preferences = loadPreferences(storage)
  assert.deepEqual(preferences, defaultPreferences())
  assert.equal(getOnboardingStage(preferences), 'tutorial')
  assert.equal(storage.length, 0)
  savePreferences(storage, preferences)
  assert.deepEqual([...storage.data.keys()], [PREFERENCES_KEY])
})

test('skip/completion survives interruption at mode selection without repeating tutorial', () => {
  const storage = new MemoryStorage()
  savePreferences(storage, { ...defaultPreferences(), hasCompletedOnboarding: true })
  assert.equal(getOnboardingStage(loadPreferences(storage)), 'mode')
  savePreferences(storage, { preferredMode: 'hard', hasCompletedOnboarding: true, hasChosenMode: true })
  assert.equal(loadPreferences(storage).preferredMode, 'hard')
  assert.equal(getOnboardingStage(loadPreferences(storage)), null)
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
  assert.deepEqual(loadPreferences(storage), { preferredMode: 'normal', hasCompletedOnboarding: true, hasChosenMode: true })
  storage.setItem('wyrmle:daily:run:2026-09-24', 'old')
  for (const value of ['{invalid', 'null', '[]', '"text"']) {
    storage.setItem(PREFERENCES_KEY, value)
    assert.equal(getOnboardingStage(loadPreferences(storage)), null)
  }
})
