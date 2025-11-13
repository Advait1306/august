import { execSync } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import log from 'electron-log/main'
import { shellEnv } from 'shell-env'
import { app } from 'electron'

export enum InstallationType {
  System = 'system',
  Custom = 'custom'
}

export interface ClaudeInstallation {
  path: string
  version?: string
  source: string
  installationType: InstallationType
}

export async function findClaudeBinary(): Promise<{ path: string; env: NodeJS.ProcessEnv }> {
  log.info('Searching for claude binary...')

  const env = await createEnvironmentForPath()
  const installations = discoverSystemInstallations(env)

  if (installations.length === 0) {
    throw new Error(
      "Claude Code not found. Please ensure it's installed in one of these locations: PATH, /usr/local/bin, /opt/homebrew/bin, ~/.nvm/versions/node/*/bin, ~/.claude/local, ~/.local/bin"
    )
  }

  for (const installation of installations) {
    log.info('Found Claude installation:', installation)
  }

  const best = selectBestInstallation(installations)
  if (!best) {
    throw new Error('No valid Claude installation found')
  }

  log.info(
    `Selected Claude installation: path=${best.path}, version=${best.version}, source=${best.source}`
  )

  return {
    path: best.path,
    env
  }
}

export async function discoverClaudeInstallations(): Promise<ClaudeInstallation[]> {
  log.info('Discovering all Claude installations...')

  const env = await createEnvironmentForPath()
  const installations = discoverSystemInstallations(env)

  installations.sort((a, b) => {
    if (a.version && b.version) {
      const versionComparison = compareVersions(b.version, a.version)
      if (versionComparison !== 0) {
        return versionComparison
      }
    } else if (a.version && !b.version) {
      return -1
    } else if (!a.version && b.version) {
      return 1
    }
    return sourcePreference(a) - sourcePreference(b)
  })

  return installations
}

function sourcePreference(installation: ClaudeInstallation): number {
  const preferences: Record<string, number> = {
    which: 1,
    homebrew: 2,
    system: 3,
    'local-bin': 5,
    'claude-local': 6,
    'npm-global': 7,
    yarn: 8,
    'yarn-global': 8,
    bun: 9,
    'node-modules': 10,
    'home-bin': 11,
    PATH: 12
  }

  if (installation.source.startsWith('nvm')) {
    return 4
  }

  return preferences[installation.source] || 13
}

function discoverSystemInstallations(env: NodeJS.ProcessEnv): ClaudeInstallation[] {
  const installations: ClaudeInstallation[] = []

  const whichInstallation = tryWhichCommand(env)
  if (whichInstallation) {
    installations.push(whichInstallation)
  }

  installations.push(...findNvmInstallations(env))
  installations.push(...findStandardInstallations(env))

  const uniquePaths = new Set<string>()
  return installations.filter((install) => {
    if (uniquePaths.has(install.path)) {
      return false
    }
    uniquePaths.add(install.path)
    return true
  })
}

function tryWhichCommand(env: NodeJS.ProcessEnv): ClaudeInstallation | null {
  log.debug("Trying 'which claude' to find binary...")

  try {
    const output = execSync('which claude', { encoding: 'utf8' }).trim()

    if (!output) {
      return null
    }

    let path: string
    if (output.startsWith('claude:') && output.includes('aliased to')) {
      const aliasedPath = output.split('aliased to')[1]?.trim()
      if (!aliasedPath) return null
      path = aliasedPath
    } else {
      path = output
    }

    log.debug(`'which' found claude at: ${path}`)

    if (!existsSync(path)) {
      log.warn(`Path from 'which' does not exist: ${path}`)
      return null
    }

    const version = getClaudeVersion(path, env)

    return {
      path,
      version,
      source: 'which',
      installationType: InstallationType.System
    }
  } catch {
    return null
  }
}

function findNvmInstallations(env: NodeJS.ProcessEnv): ClaudeInstallation[] {
  const installations: ClaudeInstallation[] = []
  const home = homedir()
  const nvmDir = join(home, '.nvm', 'versions', 'node')

  log.debug(`Checking NVM directory: ${nvmDir}`)

  if (!existsSync(nvmDir)) {
    return installations
  }

  try {
    const entries = readdirSync(nvmDir)
    for (const entry of entries) {
      const entryPath = join(nvmDir, entry)
      if (statSync(entryPath).isDirectory()) {
        const claudePath = join(entryPath, 'bin', 'claude')

        if (existsSync(claudePath) && statSync(claudePath).isFile()) {
          log.debug(`Found Claude in NVM node ${entry}: ${claudePath}`)

          const version = getClaudeVersion(claudePath, env)

          installations.push({
            path: claudePath,
            version,
            source: `nvm (${entry})`,
            installationType: InstallationType.System
          })
        }
      }
    }
  } catch (error) {
    log.warn(`Error reading NVM directory: ${error}`)
  }

  return installations
}

function findStandardInstallations(env: NodeJS.ProcessEnv): ClaudeInstallation[] {
  const installations: ClaudeInstallation[] = []
  const home = homedir()

  // Determine bundled binary path based on whether app is packaged or in dev mode
  let bundledBinaryPath: string
  if (app.isPackaged) {
    // Production: binary in app.asar.unpacked
    bundledBinaryPath = join(
      process.resourcesPath,
      'app.asar.unpacked',
      'binaries',
      `claude-darwin-${process.arch}`
    )
    log.info('App is packaged, looking for bundled binary at:', bundledBinaryPath)
  } else {
    // Development: binary in shell/binaries relative to app path
    bundledBinaryPath = join(app.getAppPath(), 'binaries', `claude-darwin-${process.arch}`)
    log.info('App is in development mode, looking for bundled binary at:', bundledBinaryPath)
  }

  const pathsToCheck: Array<[string, string]> = [
    // Add bundled binary check first (highest priority)
    [bundledBinaryPath, 'bundled'],
    ['/usr/local/bin/claude', 'system'],
    ['/opt/homebrew/bin/claude', 'homebrew'],
    ['/usr/bin/claude', 'system'],
    ['/bin/claude', 'system'],
    [join(home, '.claude', 'local', 'claude'), 'claude-local'],
    [join(home, '.local', 'bin', 'claude'), 'local-bin'],
    [join(home, '.npm-global', 'bin', 'claude'), 'npm-global'],
    [join(home, '.yarn', 'bin', 'claude'), 'yarn'],
    [join(home, '.bun', 'bin', 'claude'), 'bun'],
    [join(home, 'bin', 'claude'), 'home-bin'],
    [join(home, 'node_modules', '.bin', 'claude'), 'node-modules'],
    [join(home, '.config', 'yarn', 'global', 'node_modules', '.bin', 'claude'), 'yarn-global']
  ]

  for (const [path, source] of pathsToCheck) {
    try {
      if (existsSync(path)) {
        const stats = statSync(path)
        log.debug('Checking path:', path, 'source:', source, 'isFile:', stats.isFile())

        if (stats.isFile()) {
          log.debug(`Found claude at standard path: ${path} (${source})`)

          const version = getClaudeVersion(path, env)

          installations.push({
            path,
            version,
            source,
            installationType: InstallationType.System
          })
        }
      }
    } catch (error) {
      log.debug(`Error checking path ${path}:`, error)
    }
  }

  try {
    execSync('claude --version', { encoding: 'utf8' })
    log.debug('claude is available in PATH')
    const version = extractVersionFromOutput(execSync('claude --version', { encoding: 'utf8' }))

    installations.push({
      path: 'claude',
      version,
      source: 'PATH',
      installationType: InstallationType.System
    })
  } catch {
    // Claude not in PATH
  }

  return installations
}

function getClaudeVersion(path: string, env: NodeJS.ProcessEnv): string | undefined {
  try {
    const output = execSync(`"${path}" --version`, { encoding: 'utf8', env })
    return extractVersionFromOutput(output)
  } catch (error) {
    log.warn(`Failed to get version for ${path}: ${error}`)
    return undefined
  }
}

function extractVersionFromOutput(stdout: string): string | undefined {
  log.debug('Raw version output:', stdout)

  const versionRegex = /(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?)/
  const match = stdout.match(versionRegex)

  if (match?.[1]) {
    const version = match[1]
    log.debug('Extracted version:', version)
    return version
  }

  log.debug('No version found in output')
  return undefined
}

function selectBestInstallation(
  installations: ClaudeInstallation[]
): ClaudeInstallation | undefined {
  return installations.reduce(
    (best, current) => {
      if (!best) return current

      if (best.version && current.version) {
        const comparison = compareVersions(best.version, current.version)
        if (comparison > 0) return best
        if (comparison < 0) return current
      } else if (best.version && !current.version) {
        return best
      } else if (!best.version && current.version) {
        return current
      }

      if (best.path === 'claude' && current.path !== 'claude') {
        return current
      } else if (best.path !== 'claude' && current.path === 'claude') {
        return best
      }

      return best
    },
    undefined as ClaudeInstallation | undefined
  )
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map((part) => {
    const numericPart = part.match(/^\d+/)?.[0]
    return numericPart ? parseInt(numericPart, 10) : 0
  })

  const bParts = b.split('.').map((part) => {
    const numericPart = part.match(/^\d+/)?.[0]
    return numericPart ? parseInt(numericPart, 10) : 0
  })

  const maxLength = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < maxLength; i++) {
    const aVal = aParts[i] || 0
    const bVal = bParts[i] || 0
    if (aVal > bVal) return 1
    if (aVal < bVal) return -1
  }

  return 0
}

export async function createEnvironmentForPath(): Promise<NodeJS.ProcessEnv> {
  return await shellEnv()
}
