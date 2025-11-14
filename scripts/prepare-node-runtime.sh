#!/bin/bash

# Prepares portable Node.js runtime for bundling with Electron
# Usage: ./scripts/prepare-node-runtime.sh [version]

set -e

NODE_VERSION="${1:-v20.11.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/../resources"
NODE_DIR="$RESOURCES_DIR/node"

echo "Preparing Node.js $NODE_VERSION for bundling..."

# Detect platform
case "$(uname -s)" in
    Darwin*)    PLATFORM="darwin" ;;
    Linux*)     PLATFORM="linux" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="win" ;;
    *)          echo "Unsupported platform"; exit 1 ;;
esac

# Detect architecture
case "$(uname -m)" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)          echo "Unsupported architecture"; exit 1 ;;
esac

# Construct download URL
if [ "$PLATFORM" = "win" ]; then
    FILENAME="node-${NODE_VERSION}-win-${ARCH}.zip"
    EXT="zip"
else
    FILENAME="node-${NODE_VERSION}-${PLATFORM}-${ARCH}.tar.gz"
    EXT="tar.gz"
fi

URL="https://nodejs.org/dist/${NODE_VERSION}/${FILENAME}"

# Create directories
mkdir -p "$NODE_DIR"
cd "$RESOURCES_DIR"

# Download if not exists
if [ ! -f "$FILENAME" ]; then
    echo "Downloading from $URL..."
    curl -L -o "$FILENAME" "$URL"
else
    echo "Archive already exists, skipping download"
fi

# Extract
echo "Extracting..."
rm -rf "$NODE_DIR"
mkdir -p "$NODE_DIR"

if [ "$EXT" = "zip" ]; then
    unzip -q "$FILENAME"
    mv node-${NODE_VERSION}-win-${ARCH}/* "$NODE_DIR/"
    rmdir node-${NODE_VERSION}-win-${ARCH}
else
    tar -xzf "$FILENAME"
    mv node-${NODE_VERSION}-${PLATFORM}-${ARCH}/* "$NODE_DIR/"
    rmdir node-${NODE_VERSION}-${PLATFORM}-${ARCH}
fi

# Clean up archive
rm "$FILENAME"

# Verify
if [ "$PLATFORM" = "win" ]; then
    NODE_BINARY="$NODE_DIR/node.exe"
else
    NODE_BINARY="$NODE_DIR/bin/node"
fi

if [ -f "$NODE_BINARY" ]; then
    echo "✓ Node.js runtime successfully prepared at: $NODE_DIR"
    VERSION=$("$NODE_BINARY" --version)
    echo "  Version: $VERSION"
else
    echo "✗ Error: Node.js binary not found at $NODE_BINARY"
    exit 1
fi
