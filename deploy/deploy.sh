#!/usr/bin/env bash
set -euo pipefail

# Configuration
SERVER_HOST="${BILLING_SERVER_HOST:-192.168.1.231}"
SERVER_USER="${BILLING_SERVER_USER:-root}"
WEB_DIR="${BILLING_WEB_DIR:-/var/www/billing}"
PB_DIR="${BILLING_PB_DIR:-/opt/pocketbase}"
PB_SERVICE="${BILLING_PB_SERVICE:-pocketbase}"

echo "=== Billing Deploy ==="
echo "Server: ${SERVER_USER}@${SERVER_HOST}"
echo "Web dir: ${WEB_DIR}"
echo "PB dir: ${PB_DIR}"
echo ""

# Build frontend
echo "[1/4] Building frontend..."
cd "$(dirname "$0")/../web"
npm run build

# Sync frontend files
echo "[2/4] Syncing frontend to server..."
rsync -avz --delete dist/ "${SERVER_USER}@${SERVER_HOST}:${WEB_DIR}/"

# Sync PocketBase hooks and migrations
echo "[3/4] Syncing PocketBase hooks and migrations..."
rsync -avz ../pocketbase/pb_migrations/ "${SERVER_USER}@${SERVER_HOST}:${PB_DIR}/pb_migrations/"
rsync -avz ../pocketbase/pb_hooks/ "${SERVER_USER}@${SERVER_HOST}:${PB_DIR}/pb_hooks/"

# Restart PocketBase
echo "[4/4] Restarting PocketBase..."
ssh "${SERVER_USER}@${SERVER_HOST}" "systemctl restart ${PB_SERVICE}"

echo ""
echo "Deploy complete!"
echo "Migrations apply automatically on PocketBase startup."
