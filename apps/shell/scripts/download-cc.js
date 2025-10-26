#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-require-imports */

import https from 'https'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Binaries directory
const BINARIES_DIR = path.join(__dirname, '..', 'binaries')

/**
 * Get the base URL by following the redirect from claude.ai/install.sh
 * @returns {Promise<string>} The base URL for Claude Code releases
 */
function getBaseUrl() {
  return new Promise((resolve, reject) => {
    const installUrl = 'https://claude.ai/install.sh'
    console.log('Fetching base URL from claude.ai/install.sh...')

    https
      .get(installUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location
          // Extract base URL from redirect
          // e.g., https://.../claude-code-releases/bootstrap.sh -> https://.../claude-code-releases
          const baseUrl = redirectUrl.replace(/\/[^/]*$/, '')
          console.log(`Base URL: ${baseUrl}`)
          resolve(baseUrl)
        } else {
          reject(new Error(`Unexpected response from install.sh: ${response.statusCode}`))
        }
      })
      .on('error', reject)
  })
}

/**
 * Detect Mac architecture (x64 or arm64)
 * @returns {string} The detected architecture
 */
function detectArch() {
  const arch = process.arch
  switch (arch) {
    case 'x64':
    case 'arm64':
      return arch
    default:
      throw new Error(`Unsupported architecture: ${arch}`)
  }
}

/**
 * Download file from URL
 * @param {string} url - The URL to download from
 * @returns {Promise<Buffer>} The downloaded file data
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from: ${url}`)

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          return downloadFile(response.headers.location).then(resolve).catch(reject)
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
          return
        }

        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve(Buffer.concat(chunks)))
        response.on('error', reject)
      })
      .on('error', reject)
  })
}

/**
 * Calculate SHA256 hash of buffer
 * @param {Buffer} buffer - The buffer to hash
 * @returns {string} The SHA256 hash as a hex string
 */
function calculateHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Main download function
 * @returns {Promise<void>}
 */
async function downloadClaudeCode() {
  try {
    // Get base URL dynamically from claude.ai/install.sh redirect
    const baseUrl = await getBaseUrl()

    // Ensure binaries directory exists
    if (!fs.existsSync(BINARIES_DIR)) {
      console.log(`Creating binaries directory: ${BINARIES_DIR}`)
      fs.mkdirSync(BINARIES_DIR, { recursive: true })
    }

    // Detect architecture
    const arch = detectArch()
    console.log(`Detected architecture: ${arch}`)

    const platform = `darwin-${arch}`
    console.log(`Platform: ${platform}`)

    // Download stable version string
    console.log('\nFetching stable version...')
    const versionUrl = `${baseUrl}/stable`
    const versionData = await downloadFile(versionUrl)
    const version = versionData.toString().trim()
    console.log(`Latest stable version: ${version}`)

    // Download version manifest
    console.log('\nFetching version manifest...')
    const manifestUrl = `${baseUrl}/${version}/manifest.json`
    const manifestData = await downloadFile(manifestUrl)
    const manifest = JSON.parse(manifestData.toString())

    // Get checksum for this platform
    const platformInfo = manifest.platforms?.[platform]
    if (!platformInfo || !platformInfo.checksum) {
      throw new Error(`No checksum found for platform: ${platform}`)
    }
    const expectedChecksum = platformInfo.checksum
    console.log(`Expected checksum: ${expectedChecksum}`)
    console.log(`Binary size: ${platformInfo.size} bytes`)

    // Download binary
    console.log('\nDownloading Claude Code binary...')
    const binaryUrl = `${baseUrl}/${version}/${platform}/claude`
    const binaryData = await downloadFile(binaryUrl)

    // Verify checksum
    console.log('\nVerifying checksum...')
    const actualChecksum = calculateHash(binaryData)
    if (actualChecksum !== expectedChecksum) {
      throw new Error(
        `Checksum mismatch!\nExpected: ${expectedChecksum}\nActual: ${actualChecksum}`
      )
    }
    console.log('Checksum verified')

    // Save binary
    const binaryPath = path.join(BINARIES_DIR, `claude-${platform}`)
    console.log(`\nSaving binary to: ${binaryPath}`)
    fs.writeFileSync(binaryPath, binaryData)

    // Make executable
    fs.chmodSync(binaryPath, 0o755)
    console.log('Binary saved and made executable')

    // Get version info
    try {
      const versionOutput = execSync(`"${binaryPath}" --version`, { encoding: 'utf8' })
      console.log(`\nVersion: ${versionOutput.trim()}`)
    } catch {
      console.log('\n(Could not determine version)')
    }

    console.log('\nDownload complete!')
    console.log(`Binary location: ${binaryPath}`)
    process.exit(0)
  } catch (error) {
    console.error('\nError:', error.message)
    process.exit(1)
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadClaudeCode()
}

export { downloadClaudeCode }
