/* eslint-disable @typescript-eslint/no-require-imports */

require('dotenv').config()
const { notarize } = require('@electron/notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename

  console.log('====================')
  console.log('API KEY: ', process.env.APPLE_API_KEY)
  console.log('ISSUER ID ', process.env.APPLE_API_ISSUER)
  console.log('====================')

  return await notarize({
    tool: 'notarytool',
    appBundleId: 'com.sixhuman.jupiter',
    appPath: `${appOutDir}/${appName}.app`,
    appleApiKey: process.env.APPLE_API_KEY, // Absolute path to API key (e.g. `/path/to/AuthKey_X0X0X0X0X0.p8`)
    appleApiKeyId: process.env.APPLE_API_KEY_ID,
    appleApiIssuer: process.env.APPLE_API_ISSUER // Issuer ID (e.g. `d5631714-a680-4b4b-8156-b4ed624c0845`)
  })
}
