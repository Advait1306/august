# Bundling Node.js Runtime with August

This guide explains how Node.js is bundled with August to enable local MCP servers for all users, regardless of whether they have Node.js installed on their system.

## Why Bundle Node.js?

Local MCP servers often require Node.js/npm/npx to run (e.g., `npx @negokaz/excel-mcp-server`). By bundling a portable Node.js runtime with August, we ensure:

- ✅ All users can use local MCP servers without installing Node.js
- ✅ Consistent Node.js version across all installations
- ✅ No dependency on system PATH configuration
- ✅ Better user experience - it just works!

## How It Works

### 1. Build Time

When you run `npm run build:win`, `build:mac`, or `build:linux`, the build script:

1. Downloads the appropriate Node.js portable binary for the target platform
2. Extracts it to `apps/shell/resources/node/`
3. Electron Builder packages it with the app (uncompressed via `asarUnpack`)

### 2. Runtime

When a user runs August:

1. `find-node-runtime.ts` detects the bundled Node.js in `resources/node/`
2. When a local MCP uses `command: "npx"`, it's resolved to the full path (e.g., `/path/to/resources/node/bin/npx`)
3. The Claude Agent SDK spawns the subprocess with the resolved path
4. MCP server starts successfully!

## Node.js Download URLs

The scripts download from official Node.js distributions:

**Base URL:** `https://nodejs.org/dist/[version]/`

**Platforms:**
- **Windows x64:** `node-[version]-win-x64.zip`
- **Windows ARM64:** `node-[version]-win-arm64.zip`
- **macOS x64:** `node-[version]-darwin-x64.tar.gz`
- **macOS ARM64:** `node-[version]-darwin-arm64.tar.gz` (Apple Silicon)
- **Linux x64:** `node-[version]-linux-x64.tar.gz`
- **Linux ARM64:** `node-[version]-linux-arm64.tar.gz`

**Example:**
```
https://nodejs.org/dist/v20.11.0/node-v20.11.0-darwin-arm64.tar.gz
```

## Building with Bundled Node.js

### Quick Start

```bash
# Build for your current platform with Node.js bundled
cd apps/shell

# macOS/Linux
npm run build:mac
npm run build:linux

# Windows
npm run build:win
```

The Node.js runtime will be automatically downloaded and bundled.

### Manual Download

If you need to manually prepare Node.js:

```bash
# Unix (macOS/Linux)
npm run prepare:node

# Windows
npm run prepare:node:win

# Or specify a version
bash scripts/prepare-node-runtime.sh v22.0.0
```

This downloads and extracts Node.js to `apps/shell/resources/node/`.

### Changing Node.js Version

Edit the version in `package.json`:

```json
{
  "scripts": {
    "prepare:node": "bash scripts/prepare-node-runtime.sh v22.0.0"
  }
}
```

Or pass it as an argument:
```bash
bash scripts/prepare-node-runtime.sh v22.0.0
```

## Directory Structure After Bundling

```
apps/shell/resources/node/
├── bin/               # Unix binaries
│   ├── node          # Node.js executable
│   ├── npm           # npm
│   └── npx           # npx
├── lib/              # Node.js libraries
│   └── node_modules/
├── include/          # C++ headers
└── share/            # Documentation

# Or on Windows:
apps/shell/resources/node/
├── node.exe          # Node.js executable
├── npm.cmd           # npm wrapper
├── npx.cmd           # npx wrapper
└── node_modules/     # npm packages
```

## Build Scripts Overview

### `scripts/prepare-node-runtime.sh` (Unix)
- Downloads appropriate Node.js for current platform/arch
- Extracts to `resources/node/`
- Makes binaries executable
- Cleans up archives

### `scripts/prepare-node-runtime.bat` (Windows)
- Same as above but for Windows
- Uses PowerShell for extraction

### `scripts/download-node-runtime.js` (Cross-platform)
- Node.js script that works on all platforms
- Can specify platform/arch as arguments
- Good for CI/CD pipelines

## Runtime Detection

The `find-node-runtime.ts` utility checks in this order:

1. **Bundled Node.js** (`resources/node/`)
   - Most reliable
   - Version controlled
   - Always available

2. **System Node.js** (from PATH)
   - Fallback option
   - User's installed version
   - May vary

If neither is found, local MCP servers requiring Node.js will fail with a clear error message.

## Debugging

### Check if Node.js is Bundled

After building:

```bash
# macOS/Linux
ls -la dist/mac/August.app/Contents/Resources/node/bin/

# Windows
dir dist\win-unpacked\resources\node\

# Verify version
./dist/mac/August.app/Contents/Resources/node/bin/node --version
```

### Runtime Logs

August logs Node.js detection:

```
[info] Finding Node.js runtime...
[info] Found Node.js runtime: { version: 'v20.11.0', source: 'bundled' }
[info] Resolved MCP command for "excel-mcp": {
  original: 'npx',
  resolved: '/path/to/resources/node/bin/npx'
}
```

Or if not found:
```
[warn] No Node.js runtime found - local MCP servers requiring Node.js will not work
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Prepare Node.js Runtime
  run: |
    cd apps/shell
    npm run prepare:node

- name: Build Application
  run: npm run build:mac
```

### Multi-Platform Builds

```yaml
strategy:
  matrix:
    os: [macos-latest, ubuntu-latest, windows-latest]

- name: Prepare Node.js
  run: |
    if [ "$RUNNER_OS" == "Windows" ]; then
      npm run prepare:node:win
    else
      npm run prepare:node
    fi
  shell: bash
```

## Size Considerations

Bundled Node.js adds approximately:
- **Windows:** ~50 MB (compressed: ~15 MB)
- **macOS:** ~45 MB (compressed: ~13 MB)
- **Linux:** ~43 MB (compressed: ~12 MB)

This is acceptable for most Electron apps. Users get a fully functional MCP environment without any setup.

## Troubleshooting

### "Node.js not found" after bundling

1. Check if `resources/node/` exists in the build output
2. Verify `electron-builder.yml` has `asarUnpack: resources/**`
3. Check file permissions (Unix: executables should be chmod +x)

### "Permission denied" errors (macOS/Linux)

The scripts should make binaries executable, but if not:

```bash
chmod +x resources/node/bin/node
chmod +x resources/node/bin/npm
chmod +x resources/node/bin/npx
```

### Wrong architecture bundled

Make sure you're building on the correct platform, or use the cross-platform script:

```bash
node scripts/download-node-runtime.js v20.11.0 darwin arm64
```

## Alternative: System Node.js Only

If you prefer not to bundle Node.js:

1. Remove the `prepare:node` scripts from package.json
2. Document that Node.js is a system requirement
3. The runtime will fall back to system Node.js automatically

The code will still work - it just requires users to have Node.js installed.

## Version Recommendations

- **Current:** Node.js v20.11.0 LTS (Long Term Support)
- **Future:** Consider v22.x LTS when released
- **Avoid:** Odd-numbered versions (v21, v23) - not LTS

Update the version in `package.json` scripts when upgrading.
