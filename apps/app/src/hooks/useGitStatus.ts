import { useState, useEffect, useCallback, useRef } from 'react'

interface GitRepoCache {
  isGitRepo: boolean
  timestamp: number
}

const CACHE_TTL = 30000 // 30 seconds
const repoCache = new Map<string, GitRepoCache>()

interface UseGitStatusResult {
  isGitRepo: boolean
  isLoading: boolean
  refresh: () => void
}

export function useGitStatus(cwd: string | undefined): UseGitStatusResult {
  const [isGitRepo, setIsGitRepo] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const cwdRef = useRef(cwd)

  const checkIsRepo = useCallback(async (targetCwd: string, forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      const cached = repoCache.get(targetCwd)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setIsGitRepo(cached.isGitRepo)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)
    try {
      const result = await window.api?.git?.isRepo(targetCwd)
      const isRepo = result?.isRepo ?? false

      // Update cache
      repoCache.set(targetCwd, { isGitRepo: isRepo, timestamp: Date.now() })

      // Only update state if cwd hasn't changed
      if (cwdRef.current === targetCwd) {
        setIsGitRepo(isRepo)
      }
    } catch {
      if (cwdRef.current === targetCwd) {
        setIsGitRepo(false)
      }
    } finally {
      if (cwdRef.current === targetCwd) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    cwdRef.current = cwd
    if (cwd) {
      checkIsRepo(cwd)
    } else {
      setIsGitRepo(false)
      setIsLoading(false)
    }
  }, [cwd, checkIsRepo])

  const refresh = useCallback(() => {
    if (cwd) {
      checkIsRepo(cwd, true)
    }
  }, [cwd, checkIsRepo])

  return { isGitRepo, isLoading, refresh }
}
