#!/bin/bash
set -e

# ==============================================================================
# 1. GIT ALIGNMENT & DRIFT RESOLUTION (SELF-CONTAINED)
# ==============================================================================
# Since this script is merged to main, Jules can call it immediately. The script
# then immediately re-aligns the entire workspace with your active staging branch.

echo "=== Configuring Git workspace to match origin/staging ==="
git config --global --unset core.hooksPath
git config remote.origin.fetch "+refs/heads/staging:refs/remotes/origin/staging"
git fetch --depth 1 origin staging
git reset --hard origin/staging
git submodule update --init --recursive --depth 1

# ==============================================================================
# 2. SURGICAL RUNTIME UPGRADES (NODE 24 LTS & GO 1.25)
# ==============================================================================
# Installing directly to /usr/local ensures all runtimes are globally available 
# across all task-execution shells spawned by the Jules agent.

echo "=== Upgrading Node.js to latest Node 24 LTS globally ==="
NODE_VERSION=$(curl -s "https://nodejs.org/dist/index.json" | grep -oE '"version":"v24\.[0-9]+\.[0-9]+"' | head -n 1 | cut -d'"' -f4)
if [ -z "$NODE_VERSION" ]; then
  NODE_VERSION="v24.17.0"
fi
echo "Installing Node.js $NODE_VERSION..."
curl -sSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz" -o node.tar.xz
sudo tar -C /usr/local --strip-components=1 -xJf node.tar.xz
rm node.tar.xz

echo "=== Upgrading Go to latest Go 1.25 globally ==="
GO_VERSION=$(curl -s "https://go.dev/dl/?mode=json" | grep -oE 'go1\.25\.[0-9]+' | head -n 1)
if [ -z "$GO_VERSION" ]; then
  GO_VERSION="go1.25.5"
fi
echo "Installing Go $GO_VERSION..."
curl -sSL "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz" -o go.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go.tar.gz
rm go.tar.gz

export PATH=$PATH:/usr/local/go/bin
export GOPATH=$HOME/go

# ==============================================================================
# 3. TOOL INSTALLATIONS
# ==============================================================================
echo "=== Installing development tools ==="
curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b $(go env GOPATH)/bin
export PATH=$PATH:$(go env GOPATH)/bin

if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

# ==============================================================================
# 4. COMPILING & SNAPSHOT CACHE WARMUPS
# ==============================================================================
# Warm up all compilation, module, lint, and test caches so they are baked 
# into the environment snapshot, minimizing Jules' future task duration.

echo "=== Running dependency installation ==="
pnpm install

echo "=== Pre-compiling TypeScript monorepo ==="
pnpm build

echo "=== Pre-warming ESLint & test caches ==="
pnpm lint || true
pnpm test -- --run || true

# Note: "pnpm live:smoke:heuristic" is deliberately skipped due to environment limits.

echo "=== Warming up Go module & compilation caches ==="
go mod download
go build ./...
go test -run=^$ ./...
golangci-lint run ./... || true

echo "=== Populating local database schemas and search indexes ==="
pnpm exec swarmvault demo --no-serve || true

echo "=== All runtimes upgraded, caches warmed, and VM snapshot is ready! ==="