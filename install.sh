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

echo "=> Installing dependencies..."
pnpm install

echo "=> Building the CLI..."
pnpm build

echo "=> Installing globally..."
# Link the CLI package globally using npm to ensure binary mapping is correct.
npm install -g ./packages/cli

echo "=> Installation complete!"
echo "=> You can now run the 'swarmvault' command."
