import type { DifficultyMode, StorageLike } from './daily/types.ts'

export const PREFERENCES_KEY = 'wyrmle:preferences:v1'

export type UserPreferences = {
  preferredMode: DifficultyMode
  hasCompletedOnboarding: boolean
  hasChosenMode: boolean
}

export function defaultPreferences(): UserPreferences {
  return { preferredMode: 'normal', hasCompletedOnboarding: false, hasChosenMode: false }
}

function hasPreviousVisit(storage: StorageLike): boolean {
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    // Include older numeric Daily records: returning players need no forced tutorial.
    if (key?.startsWith('wyrmle:letter-strike:daily:') || key?.startsWith('wyrmle:daily:')) return true
  }
  return false
}

/** Preferences never read or change the contents of a Daily run or result. */
export function loadPreferences(storage: StorageLike): UserPreferences {
  const defaults = defaultPreferences()
  const returning = hasPreviousVisit(storage)
  const raw = storage.getItem(PREFERENCES_KEY)
  if (raw !== null) {
    try {
      const value: unknown = JSON.parse(raw)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const data = value as Record<string, unknown>
        const complete = typeof data.hasCompletedOnboarding === 'boolean'
          ? data.hasCompletedOnboarding : returning
        return {
          preferredMode: data.preferredMode === 'hard' || data.preferredMode === 'hardcore' ? data.preferredMode : 'normal',
          hasCompletedOnboarding: complete,
          // Older preference records may predate the interrupted-choice flag.
          hasChosenMode: typeof data.hasChosenMode === 'boolean' ? data.hasChosenMode : complete,
        }
      }
    } catch { /* A damaged preference must not block access to saved gameplay. */ }
  }
  return returning ? { ...defaults, hasCompletedOnboarding: true, hasChosenMode: true } : defaults
}

export function savePreferences(storage: StorageLike, preferences: UserPreferences): void {
  storage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
}

export function getOnboardingStage(preferences: UserPreferences): 'tutorial' | 'mode' | null {
  if (!preferences.hasCompletedOnboarding) return 'tutorial'
  return preferences.hasChosenMode ? null : 'mode'
}
