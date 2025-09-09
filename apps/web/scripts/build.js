import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('Building application...');

// Run vite build and TypeScript check
execSync('vite build && tsc --noEmit', { stdio: 'inherit', cwd: projectRoot });

// Generate service worker
execSync('npx workbox-cli generateSW workbox-config.cjs', { stdio: 'inherit', cwd: projectRoot });

// Copy service worker files based on environment
const isVercel = process.env.VERCEL;
const sourceDir = isVercel ? path.join(projectRoot, '.vercel/output/static') : path.join(projectRoot, '.output/public');
const publicDir = path.join(projectRoot, 'public');

console.log(`Copying service worker files from ${sourceDir} to ${publicDir}...`);

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy sw.js files
const swFiles = fs.readdirSync(sourceDir).filter(file => 
  file.startsWith('sw.js') || file.startsWith('workbox-')
);

swFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(publicDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file}`);
  }
});

console.log('Build completed successfully!');