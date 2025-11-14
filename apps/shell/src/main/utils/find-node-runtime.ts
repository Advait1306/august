import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import log from 'electron-log/main'
import { app } from 'electron'

export interface NodeRuntime {
  nodePath: string
  npmPath: string
  npxPath: string
  version: string
  source: 'system' | 'bundled'
}

/**
 * Find Node.js runtime, preferring bundled version for consistency
 */
export async function findNodeRuntime(): Promise<NodeRuntime | null> {
  log.info('Searching for Node.js runtime...')

  // Check for bundled Node.js first (add this to your Electron build)
  const bundledNode = checkBundledNode()
  if (bundledNode) {
    log.info('Using bundled Node.js:', bundledNode)
    return bundledNode
  }

  // Fallback to system Node.js
  const systemNode = checkSystemNode()
  if (systemNode) {
    log.info('Using system Node.js:', systemNode)
    return systemNode
  }

  log.warn('No Node.js runtime found')
  return null
}

function checkBundledNode(): NodeRuntime | null {
  // Path where bundled Node.js would be located
  // This depends on your build configuration
  const isWin = process.platform === 'win32'
  const resourcesPath = process.resourcesPath || app.getAppPath()

  const bundledNodePath = join(
    resourcesPath,
    'node',
    isWin ? 'node.exe' : 'bin/node'
  )

  const bundledNpmPath = join(
    resourcesPath,
    'node',
    isWin ? 'npm.cmd' : 'bin/npm'
  )

  const bundledNpxPath = join(
    resourcesPath,
    'node',
    isWin ? 'npx.cmd' : 'bin/npx'
  )

  if (existsSync(bundledNodePath)) {
    try {
      const version = execSync(`"${bundledNodePath}" --version`, {
        encoding: 'utf-8'
      }).trim()

      return {
        nodePath: bundledNodePath,
        npmPath: bundledNpmPath,
        npxPath: bundledNpxPath,
        version,
        source: 'bundled'
      }
    } catch (error) {
      log.error('Bundled Node.js found but not functional:', error)
    }
  }

  return null
}

function checkSystemNode(): NodeRuntime | null {
  const isWin = process.platform === 'win32'

  try {
    // Try to find node in PATH
    const nodeCommand = isWin ? 'where node' : 'which node'
    const nodePath = execSync(nodeCommand, { encoding: 'utf-8' }).trim().split('\n')[0]

    const npmCommand = isWin ? 'where npm' : 'which npm'
    const npmPath = execSync(npmCommand, { encoding: 'utf-8' }).trim().split('\n')[0]

    const npxCommand = isWin ? 'where npx' : 'which npx'
    const npxPath = execSync(npxCommand, { encoding: 'utf-8' }).trim().split('\n')[0]

    const version = execSync('node --version', { encoding: 'utf-8' }).trim()

    return {
      nodePath,
      npmPath,
      npxPath,
      version,
      source: 'system'
    }
  } catch (error) {
    log.debug('System Node.js not found in PATH')
    return null
  }
}

/**
 * Get Node.js environment variables for spawning subprocesses
 */
export async function getNodeEnvironment(): Promise<Record<string, string>> {
  const runtime = await findNodeRuntime()

  if (!runtime) {
    return {}
  }

  const isWin = process.platform === 'win32'
  const separator = isWin ? ';' : ':'

  // Add bundled Node.js to PATH if using bundled version
  if (runtime.source === 'bundled') {
    const nodeBinDir = runtime.nodePath.replace(isWin ? /node\.exe$/ : /\/node$/, '')
    const currentPath = process.env.PATH || ''

    return {
      PATH: `${nodeBinDir}${separator}${currentPath}`,
      NODE_PATH: nodeBinDir
    }
  }

  return {}
}
