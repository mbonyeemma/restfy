# Restify

A small, **open-source** API client for **macOS** (Electron) and the **browser**—collections, environments, auth, scripts, Postman import. **MIT licensed.** No paywall for the basics; optional self-hostable API for sync/share.

**Author:** [mbonyeemma](https://github.com/mbonyeemma) · **Repo:** [github.com/mbonyeemma/restfy](https://github.com/mbonyeemma/restfy)

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%2B%20web-lightgrey.svg)
![Electron](https://img.shields.io/badge/electron-28-blue.svg)

---

## Download (macOS DMG)

Pre-built disk images are attached to **GitHub Releases** (built in CI on macOS).

1. Open **[Releases](https://github.com/mbonyeemma/restfy/releases)**.
2. Choose the latest **tag** (or the version you want).
3. Download the **`.dmg`** file from the release assets.
4. Open the DMG, drag **Restify** into Applications, launch from there.

**Note:** CI builds are **unsigned** (no Apple Developer ID in GitHub Actions). macOS may show Gatekeeper warnings—you can still open via **System Settings → Privacy & Security** or right-click → Open, depending on your OS version. For a fully trusted build, sign and notarize your own copy from source (see below).

**Use in the browser** (no install): [app.restify.online](https://app.restify.online/)

---

## Repository layout

Everything for the app and API lives under this repo root:

```
.
├── README.md                 # You are here
├── LICENSE                   # MIT
├── CONTRIBUTING.md           # How to contribute
├── docs/
│   └── OPEN_SOURCE.md        # Why MIT, forking, philosophy
├── .github/
│   └── workflows/
│       └── release-mac-dmg.yml   # Builds & uploads DMG on release
├── frontend/                 # Electron + static web UI (main “app”)
│   ├── package.json          # npm scripts, electron-builder
│   ├── main.js               # Electron main process
│   ├── preload.js
│   ├── app.html              # Main client UI
│   ├── docs.html             # Shared collection docs
│   ├── index.html            # Redirect → app.html (static hosts)
│   ├── assets/
│   └── js/                   # Client logic (api-base, state, ui, …)
└── server/                   # Optional Express API (auth, sync, share, proxy)
    ├── package.json
    └── src/
```

The marketing site ([restify.online](https://restify.online/)) is deployed separately; its source may live in another folder or repo (e.g. `promo-website/` in a monorepo checkout).

---

## Quick start (from source)

```bash
git clone https://github.com/mbonyeemma/restfy.git
cd restfy
```

### Web UI (static)

```bash
cd frontend
npm install
npm run dev
```

Opens a local static server (see `package.json` for port) and `app.html`.

### Desktop (Electron)

```bash
cd frontend
npm install
npm run electron
```

### Build DMG locally (macOS only)

```bash
cd frontend
npm install
npm run build:dmg
```

Output: `frontend/dist/` (`.dmg` and related artifacts).

**Version:** The app version lives in `frontend/package.json` (`version`). The web UI also reads `frontend/js/app-version.js` (`RESTIFY_APP_VERSION`)—keep both in sync when you ship a new release.

**In-app updates (macOS):** Packaged builds use [electron-updater](https://www.electron.build/auto-update) against **GitHub Releases**. CI uploads the DMG plus `latest-mac.yml` and `.blockmap` files so the app can detect and download newer tags. After publishing **v1.1.0**, users on **1.0.0** get a background check (~5s after launch), then a prompt to restart when the update is ready. Apple code signing + notarization improves Gatekeeper behavior but is not required for the updater to fetch from GitHub.

### API server (optional)

```bash
cd server
npm install
npm run dev
```

Default port **4000** (see `server/src/config/constants.ts`).

---

## Production domains

| Host | Role |
|------|------|
| [restify.online](https://restify.online/) | Marketing site |
| [app.restify.online](https://app.restify.online/) | Web client |
| [api.restify.online](https://api.restify.online/) | Hosted API |

On `app.restify.online`, `frontend/js/config-domains.js` sets the API base to `https://api.restify.online`. Override with `window.__RESTIFY_API_BASE__` before `api-base.js` if you self-host.

Share links from the API use `RESTIFY_WEB_URL` / `RESTIFY_API_PUBLIC_URL` (or legacy `RESTFY_*`) when set; otherwise production defaults apply when the API sees host `api.restify.online`.

For the marketing site to detect “signed in” via `GET /api/auth/me` with cookies, set **`RESTIFY_AUTH_COOKIE_DOMAIN=.restify.online`** on the API so the auth cookie is shared across `restify.online` and `app.restify.online`.

---

## Data & caching

1. **Browser:** `localStorage` key `restify_data` (legacy `restfy_data` still read).
2. **Electron:** `restify-state.json` under the app user-data directory (with migration from `restfy-state.json`). See Electron docs for `userData` path on your OS.

---

## Contributing

We welcome issues and pull requests. Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** for local setup, PR expectations, and security reporting.

**Deep dive on licensing and open source:** [docs/OPEN_SOURCE.md](docs/OPEN_SOURCE.md)

---

## Importing from Postman

1. In Postman: **File → Export** collection as JSON (v2.1).
2. In Restify: **Import** in the sidebar → choose the file.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute. Copyright mbonyeemma.
