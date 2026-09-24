import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultPreferences, loadPreferences, PREFERENCES_KEY, savePreferences } from './preferences.ts'
import type { UserPreferences } from './preferences.ts'

function readPreferences(): UserPreferences {
  try { return loadPreferences(window.localStorage) }
  catch { return defaultPreferences() }
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState(readPreferences)
  const currentPreferences = useRef(preferences)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== PREFERENCES_KEY && event.key !== null) return
      const next = readPreferences()
      currentPreferences.current = next
      setPreferences(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const update = useCallback((changes: Partial<UserPreferences>) => {
    const next = { ...currentPreferences.current, ...changes }
    currentPreferences.current = next
    setPreferences(next)
    try {
      savePreferences(window.localStorage, next)
      setError(null)
    } catch {
      setError('Preferences could not be saved. They apply for this visit.')
    }
  }, [])

  return { preferences, error, update }
}
