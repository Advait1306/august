#!/usr/bin/env node

/**
 * Downloads portable Node.js runtime for bundling with Electron app
 * Usage: node scripts/download-node-runtime.js [version] [platform] [arch]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream, createReadStream } = require('fs');
const zlib = require('zlib');
const tar = require('tar');

const NODE_VERSION = process.argv[2] || 'v20.11.0';
const PLATFORM = process.argv[3] || process.platform; // win32, darwin, linux
const ARCH = process.argv[4] || process.arch; // x64, arm64

const OUTPUT_DIR = path.join(__dirname, '..', 'resources', 'node');

// Platform-specific file extensions and formats
const PLATFORM_CONFIG = {
  win32: { ext: 'zip', format: 'zip' },
  darwin: { ext: 'tar.gz', format: 'tar' },
  linux: { ext: 'tar.gz', format: 'tar' }
};

// Map Node.js platform names
const PLATFORM_MAP = {
  win32: 'win',
  darwin: 'darwin',
  linux: 'linux'
};

async function downloadFile(url, dest) {
  console.log(`Downloading: ${url}`);
  console.log(`Destination: ${dest}`);

  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('Download completed');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function extractTarGz(archivePath, outputDir) {
  console.log(`Extracting tar.gz: ${archivePath}`);

  await pipeline(
    createReadStream(archivePath),
    zlib.createGunzip(),
    tar.extract({
      cwd: outputDir,
      strip: 1 // Remove the top-level directory
    })
  );

  console.log('Extraction completed');
}

async function extractZip(archivePath, outputDir) {
  console.log(`Extracting zip: ${archivePath}`);

  // For Windows, we'll use a simple approach
  // You might want to use a library like 'adm-zip' for production
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(archivePath);

  // Extract and remove top-level directory
  const entries = zip.getEntries();
  const topLevelDir = entries[0].entryName.split('/')[0];

  entries.forEach(entry => {
    if (entry.entryName.startsWith(topLevelDir + '/')) {
      const relativePath = entry.entryName.substring(topLevelDir.length + 1);
      if (relativePath) {
        const targetPath = path.join(outputDir, relativePath);
        if (entry.isDirectory) {
          fs.mkdirSync(targetPath, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, entry.getData());
        }
      }
    }
  });

  console.log('Extraction completed');
}

async function main() {
  const config = PLATFORM_CONFIG[PLATFORM];
  const platformName = PLATFORM_MAP[PLATFORM];

  if (!config) {
    throw new Error(`Unsupported platform: ${PLATFORM}`);
  }

  // Construct download URL
  const filename = `node-${NODE_VERSION}-${platformName}-${ARCH}.${config.ext}`;
  const url = `https://nodejs.org/dist/${NODE_VERSION}/${filename}`;

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Download
  const archivePath = path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(archivePath)) {
    await downloadFile(url, archivePath);
  } else {
    console.log('Archive already exists, skipping download');
  }

  // Extract
  if (config.format === 'tar') {
    await extractTarGz(archivePath, OUTPUT_DIR);
  } else if (config.format === 'zip') {
    await extractZip(archivePath, OUTPUT_DIR);
  }

  // Clean up archive
  fs.unlinkSync(archivePath);

  // Verify extraction
  const nodeBinary = PLATFORM === 'win32' ? 'node.exe' : 'bin/node';
  const nodePath = path.join(OUTPUT_DIR, nodeBinary);

  if (fs.existsSync(nodePath)) {
    console.log(`✓ Node.js runtime successfully prepared at: ${OUTPUT_DIR}`);
    console.log(`  Binary: ${nodePath}`);

    // Make executable on Unix systems
    if (PLATFORM !== 'win32') {
      fs.chmodSync(nodePath, 0o755);
      const npmPath = path.join(OUTPUT_DIR, 'bin/npm');
      const npxPath = path.join(OUTPUT_DIR, 'bin/npx');
      if (fs.existsSync(npmPath)) fs.chmodSync(npmPath, 0o755);
      if (fs.existsSync(npxPath)) fs.chmodSync(npxPath, 0o755);
    }
  } else {
    throw new Error('Node.js binary not found after extraction');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
