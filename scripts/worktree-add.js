#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const ENV_PATTERNS = ['.env', '.env.local', '.env.development', '.env.production', '.env.development.local', '.env.production.local']

function findEnvFiles(dir, root = dir) {
  const results = []

  try {
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry)

      // Skip node_modules, .git, and worktree directories
      if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.conductor')) {
        continue
      }

      try {
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          results.push(...findEnvFiles(fullPath, root))
        } else if (ENV_PATTERNS.some(pattern => entry === pattern || entry.startsWith('.env'))) {
          results.push({
            absolute: fullPath,
            relative: relative(root, fullPath)
          })
        }
      } catch {
        // Skip files we can't access
      }
    }
  } catch {
    // Skip directories we can't access
  }

  return results
}

function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('Usage: npm run worktree:add <path> <branch>')
    console.error('Example: npm run worktree:add ./my-feature feature-branch')
    process.exit(1)
  }

  const [worktreePath, branch] = args
  const absoluteWorktreePath = join(process.cwd(), worktreePath)

  // Run git worktree add
  console.log(`Creating worktree at ${worktreePath} with branch ${branch}...`)
  try {
    execSync(`git worktree add ${worktreePath} ${branch}`, { stdio: 'inherit' })
  } catch (error) {
    console.error('Failed to create worktree')
    process.exit(1)
  }

  // Find and copy env files
  console.log('\nCopying .env files...')
  const envFiles = findEnvFiles(ROOT)

  // Filter out files that are inside the new worktree path
  const filesToCopy = envFiles.filter(f => !f.absolute.startsWith(absoluteWorktreePath))

  let copied = 0
  for (const file of filesToCopy) {
    const destPath = join(absoluteWorktreePath, file.relative)
    const destDir = dirname(destPath)

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }

    try {
      copyFileSync(file.absolute, destPath)
      console.log(`  Copied: ${file.relative}`)
      copied++
    } catch (error) {
      console.error(`  Failed to copy: ${file.relative}`)
    }
  }

  console.log(`\nDone! Copied ${copied} .env file(s) to ${worktreePath}`)
}

main()
