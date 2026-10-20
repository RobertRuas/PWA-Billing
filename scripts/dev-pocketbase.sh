#!/usr/bin/env bash
set -euo pipefail

PB_VERSION="${PB_VERSION:-0.23.12}"
PB_DIR="$(dirname "$0")/../.pocketbase-dev"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)  PB_ARCH="amd64" ;;
  aarch64|arm64) PB_ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

if [ ! -f "$PB_DIR/pocketbase" ]; then
  echo "Downloading PocketBase v${PB_VERSION} for ${OS}/${PB_ARCH}..."
  mkdir -p "$PB_DIR"
  curl -fsSL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${OS}_${PB_ARCH}.zip" -o "$PB_DIR/pb.zip"
  unzip -o "$PB_DIR/pb.zip" -d "$PB_DIR"
  rm "$PB_DIR/pb.zip"
  chmod +x "$PB_DIR/pocketbase"
fi

echo "PocketBase version:"
"$PB_DIR/pocketbase" --version

# Link migrations and hooks
ln -sf "$(cd "$(dirname "$0")/../pocketbase/pb_migrations" && pwd)" "$PB_DIR/pb_migrations"
ln -sf "$(cd "$(dirname "$0")/../pocketbase/pb_hooks" && pwd)" "$PB_DIR/pb_hooks"

echo ""
echo "Starting PocketBase on http://127.0.0.1:8090"
echo "Admin UI: http://127.0.0.1:8090/_/"
echo ""

cd "$PB_DIR"
./pocketbase serve --http=127.0.0.1:8090
