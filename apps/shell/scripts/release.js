#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const path = require('path')
require('dotenv').config()

/**
 * Release script for automatic publishing to GitHub
 * Based on electron-builder documentation: https://www.electron.build/publish
 */

function log(message) {
  console.log(`[Release] ${message}`)
}

function error(message) {
  console.error(`[Release Error] ${message}`)
}

function execCommand(command, options = {}) {
  log(`Executing: ${command}`)
  return execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    ...options
  })
}

function getCurrentVersion() {
  const packagePath = path.join(__dirname, '../package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  return packageJson.version
}

function bumpVersion(type = 'patch') {
  log(`Bumping version (${type})...`)
  execCommand(`npm version ${type} --no-git-tag-version`)
  return getCurrentVersion()
}

function commitAndTag(version) {
  log(`Committing and tagging version ${version}...`)
  execCommand(`git add -A`)
  execCommand(`git commit -m "chore: bump version to ${version}"`)
  execCommand(`git tag v${version}`)
}

function publishBuild() {
  log('Building and publishing...')

  // Check for GitHub token
  const githubToken = process.env.GITHUB_RELEASE_TOKEN
  if (!githubToken) {
    throw new Error(
      'GITHUB_RELEASE_TOKEN or GH_TOKEN environment variable is required for publishing'
    )
  }

  execCommand('npm run build')

  // Determine platform and run appropriate publish command
  const platform = process.platform

  log(`Publishing for platform: ${platform}`)
  if (platform === 'darwin') {
    execCommand('npm run publish:mac')
  } else if (platform === 'win32') {
    execCommand('npm run publish:win')
  } else if (platform === 'linux') {
    execCommand('npm run publish:linux')
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }
}

function pushToGitHub() {
  log('Pushing to GitHub...')
  execCommand('git push origin')
  execCommand('git push origin --tags')
}

async function main() {
  try {
    // Get arguments
    const args = process.argv.slice(2)
    const versionType = args[0] || 'patch'
    const skipBump = args.includes('--skip-bump')
    const skipPush = args.includes('--skip-push')

    log('Starting release process...')

    // Check if we're in a clean git state
    try {
      execSync('git diff --exit-code', { stdio: 'pipe' })
      execSync('git diff --cached --exit-code', { stdio: 'pipe' })
    } catch {
      error('Publish script can only be run on a clean branch. Please commit or stash your changes.')
      process.exit(1)
    }

    let version
    if (!skipBump) {
      // Bump version
      version = bumpVersion(versionType)
      log(`Version bumped to ${version}`)
    } else {
      version = getCurrentVersion()
      log(`Using current version ${version}`)
    }

    // Build and publish
    publishBuild()

    if (!skipBump) {
      // Commit, tag, and push
      commitAndTag(version)

      if (!skipPush) {
        pushToGitHub()
      } else {
        log('Skipping push to GitHub (--skip-push flag provided)')
      }
    }

    log(`Release ${version} completed successfully!`)
    log('The app should be available for auto-update shortly.')
  } catch (err) {
    error(`Release failed: ${err.message}`)
    process.exit(1)
  }
}

// Show usage if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/release.js [version-type] [options]

Arguments:
  version-type    Version bump type: patch, minor, major (default: patch)

Options:
  --skip-bump     Skip version bump (use current version)
  --skip-push     Skip pushing to GitHub
  --help, -h      Show this help message

Examples:
  node scripts/release.js                 # Bump patch version and release
  node scripts/release.js minor           # Bump minor version and release
  node scripts/release.js --skip-bump     # Release current version without bumping
  node scripts/release.js patch --skip-push  # Bump version but don't push to GitHub

Note:
- On macOS, this will trigger code signing and notarization
- Ensure you have the necessary certificates and environment variables set
- The GitHub token must be set in GITHUB_RELEASE_TOKEN or GH_TOKEN environment variable
- For GitHub releases: export GITHUB_RELEASE_TOKEN=your_token_here
`)
  process.exit(0)
}

main()
