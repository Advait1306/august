/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config()

const { spawn } = require('child_process')

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

async function buildAndNotarize() {
  try {
    console.log('Building with electron-vite...')
    await runCommand('electron-vite', ['build'])

    console.log('Building and notarizing with electron-builder...')
    await runCommand('electron-builder', ['--mac'], {
      env: {
        ...process.env,
        APPLE_API_KEY: process.env.APPLE_API_KEY,
        APPLE_API_KEY_ID: process.env.APPLE_API_KEY_ID,
        APPLE_API_ISSUER: process.env.APPLE_API_ISSUER
      }
    })

    console.log('Build and notarization completed successfully!')
  } catch (error) {
    console.error('Build failed:', error.message)
    process.exit(1)
  }
}

buildAndNotarize()
