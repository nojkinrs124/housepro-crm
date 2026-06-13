'use client'

import { useState, useEffect, useCallback } from 'react'

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded — ignore
  }
}

/**
 * Like useState, but persists value in localStorage under `key`.
 * On first render uses the stored value (or `initial` if nothing stored).
 */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValueRaw] = useState<T>(() => readStorage(key, initial))

  const setValue = useCallback((v: T | ((prev: T) => T)) => {
    setValueRaw(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      writeStorage(key, next)
      return next
    })
  }, [key])

  // Sync if key changes (shouldn't happen, but just in case)
  useEffect(() => {
    writeStorage(key, value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [value, setValue]
}
