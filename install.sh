#!/bin/bash
set -e

REPO_URL="https://github.com/negatrait/swarmvault-negafork.git"
INSTALL_DIR="$HOME/.swarmvault-negafork"

echo "=> SwarmVault CLI (negafork) Installation"
echo "=> Installing from $REPO_URL"

# Check dependencies
for cmd in git node; do
  if ! command -v $cmd > /dev/null 2>&1; then
    echo "Error: $cmd is required but not installed."
    kill -INT $$
  fi
done

# Check or install pnpm
if ! command -v pnpm > /dev/null 2>&1; then
  echo "=> pnpm not found. Attempting to install via corepack..."
  if command -v corepack > /dev/null 2>&1; then
    corepack enable pnpm
  else
    echo "Error: pnpm is required but not installed, and corepack is not available."
    echo "Please install pnpm first: https://pnpm.io/installation"
    kill -INT $$
  fi
fi

if [ -d "$INSTALL_DIR" ]; then
  echo "=> Directory $INSTALL_DIR already exists. Updating..."
  cd "$INSTALL_DIR"
  git fetch origin main
  git reset --hard origin/main
else
  echo "=> Cloning repository into $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

OS=$(uname -s)
ARCH=$(uname -m)
echo "=> Detected OS: $OS, Architecture: $ARCH"

if [ "$OS" = "Linux" ]; then
  GOARCH=""
  if [ "$ARCH" = "x86_64" ]; then
    GOARCH="amd64"
  elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    GOARCH="arm64"
  fi

  if [ -n "$GOARCH" ]; then
    echo "=> Attempting to download pre-compiled Go binary for Linux $GOARCH..."
    RELEASE_URL="https://github.com/negatrait/swarmvault-negafork/releases/download/daily/swarmvault-native-linux-${GOARCH}"

    mkdir -p bin
    if curl -sLf "$RELEASE_URL" -o bin/swarmvault-native; then
      echo "=> Downloaded pre-compiled binary successfully."
      chmod +x bin/swarmvault-native
    else
      echo "=> Failed to download pre-compiled binary. Attempting local Go compilation..."
      if command -v go > /dev/null 2>&1; then
        echo "=> Compiling Go binary locally..."
        go build -ldflags="-s -w" -o bin/swarmvault-native ./cmd/swarmvault-native
      else
        echo "=> Warning: Go is not installed. Skipping native binary compilation."
      fi
    fi
  else
    echo "=> Warning: Architecture $ARCH on Linux is not pre-compiled. Attempting local Go compilation..."
    if command -v go > /dev/null 2>&1; then
      mkdir -p bin
      echo "=> Compiling Go binary locally..."
      go build -ldflags="-s -w" -o bin/swarmvault-native ./cmd/swarmvault-native
    else
      echo "=> Warning: Go is not installed. Skipping native binary compilation."
    fi
  fi
else
  echo "=> OS is $OS. Skipping pre-compiled Linux Go binary download. Attempting local Go compilation..."
  if command -v go > /dev/null 2>&1; then
    mkdir -p bin
    echo "=> Compiling Go binary locally..."
    go build -ldflags="-s -w" -o bin/swarmvault-native ./cmd/swarmvault-native
  else
    echo "=> Warning: Go is not installed. Skipping native binary compilation."
  fi
fi

echo "=> Installing dependencies..."
pnpm install

echo "=> Building the CLI..."
pnpm build

echo "=> Installing globally..."
# Link the CLI package globally using npm to ensure binary mapping is correct.
npm install -g ./packages/cli

echo "=> Installation complete!"
echo "=> You can now run the 'swarmvault' command."
