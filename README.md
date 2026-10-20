# Billing

PWA for managing invoices, timesheets, and expenses — built for independent workers / contractors.

## Requirements

- **Node.js** LTS (22+)
- **PocketBase** ≥ 0.23

## Local development

### 1. Start PocketBase

```bash
./scripts/dev-pocketbase.sh
```

Downloads PocketBase automatically on first run, symlinks migrations and hooks, and starts on `http://127.0.0.1:8090`. Create an admin account at `http://127.0.0.1:8090/_/`.

### 2. (Optional) Email testing with Mailpit

Install [Mailpit](https://mailpit.axllent.org/) and start it. In the PocketBase admin panel, configure SMTP:

- Host: `127.0.0.1`
- Port: `1025`
- No auth

Mailpit UI: `http://127.0.0.1:8025`

### 3. Start the frontend

```bash
cd web
npm install
npm run dev
```

Vite proxies `/api` and `/_` to PocketBase at port 8090. Open `http://localhost:5173`.

## Testing

### Unit tests

```bash
cd web
npm test           # single run
npm run test:watch # watch mode
```

Tests cover: money calculations, date formatting, invoice numbering, IBAN validation, invoice state machine, backup encryption round-trip, and i18n completeness.

### E2E tests (Playwright)

```bash
cd web
npx playwright install
npx playwright test
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript (strict) |
| Build | Vite + vite-plugin-pwa |
| Backend | PocketBase (auth, API, SQLite, hooks, migrations) |
| Offline | Dexie (IndexedDB) + outbox sync pattern |
| Validation | Zod |
| Encryption | WebCrypto (PBKDF2 + AES-256-GCM) |
| Service worker | Workbox (via vite-plugin-pwa) |
| Testing | Vitest (unit), Playwright (E2E) |

## Deploy

### Server setup

1. Install PocketBase on the server (e.g. `/opt/pocketbase`).
2. Copy `deploy/pocketbase.service` to `/etc/systemd/system/` and enable it:
   ```bash
   systemctl enable --now pocketbase
   ```
3. Copy `deploy/nginx.conf` to your nginx sites and reload.
4. Configure SMTP in PocketBase admin for email verification and password reset.

### Deploy script

```bash
BILLING_SERVER_HOST=your-server ./deploy/deploy.sh
```

Builds the frontend, rsyncs dist + PocketBase hooks/migrations, and restarts PocketBase. Migrations apply automatically on startup.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BILLING_SERVER_HOST` | `192.168.1.231` | Server IP or hostname |
| `BILLING_SERVER_USER` | `root` | SSH user |
| `BILLING_WEB_DIR` | `/var/www/billing` | Frontend deploy path |
| `BILLING_PB_DIR` | `/opt/pocketbase` | PocketBase install path |
| `BILLING_PB_SERVICE` | `pocketbase` | systemd service name |

### Registration

- Open registration: set `mm_users` collection's Create API rule to `""` (empty string) in PocketBase admin.
- Close registration: set it to `null`.

### Backup

Back up `/opt/pocketbase/pb_data` daily (the SQLite database and uploaded files).

## Testing on iPhone

1. Open `https://billing.windlog.org` in Safari.
2. Tap Share → Add to Home Screen → Add.
3. Open the app from the home screen (standalone mode).
4. Test offline: enable airplane mode, verify all locally cached data works.
5. Verify no zoom: double-tap and pinch should not zoom the page.

## License

Private.
