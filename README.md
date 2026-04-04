# Restfy — Free, Open-Source Postman Alternative

A fast, beautiful, lightweight API client for macOS. No account required. No limits. No subscriptions.

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![Electron](https://img.shields.io/badge/electron-28-blue.svg)

## Features

- **Collections & Folders** — Organize requests into nested collections and folders
- **Environments & Variables** — Create environments with `{{variable}}` syntax
- **All Auth Types** — Bearer, Basic, JWT, OAuth 2.0, AWS Signature, Hawk, NTLM, Digest, API Key, Akamai EdgeGrid, ASAP
- **Syntax Highlighting** — JSON/XML coloring with line numbers in request body and response
- **Pre-request & Test Scripts** — JavaScript sandbox with `pm.test()`, `pm.expect()`, `pm.environment`
- **Code Generation** — Generate snippets in JS (Fetch/Axios), Python, Go, PHP, cURL
- **Import & Export** — Import/export Postman collections (v2/v2.1) with full folder support
- **Light & Dark Mode** — Beautiful themes that persist across sessions
- **Auto-generated Headers** — Automatic Content-Type, Accept, User-Agent headers with count badge
- **Request History** — Auto-saved history of all sent requests
- **Collection Runner** — Run all requests in a collection sequentially
- **Beautify** — Format JSON request bodies and responses with one click
- **CORS Bypass** — Desktop app bypasses browser CORS restrictions
- **Keyboard Shortcuts** — Ctrl+N, Ctrl+Enter, Ctrl+S, Ctrl+B, Ctrl+L, and more

## Data & caching

Collections, environments, tabs, and history are stored in two places:

1. **Browser `localStorage`** (`restfy_data`) — fast reads on startup.
2. **Disk cache** — `restfy-state.json` under Electron’s user data directory (e.g. `~/Library/Application Support/restfy/` on macOS).

Saves are **debounced to disk** (~400ms) so edits stay smooth; **quitting or hiding the app** flushes immediately. On launch, the app loads whichever copy is newer (and prefers disk if `localStorage` was cleared but the file still exists). If `localStorage` hits its size limit, the file cache still holds your collections.

## Quick Start

### Run in Development

```bash
git clone https://github.com/mbonyeemma/restfy.git
cd restfy
npm install
npm start
```

### Build for macOS

```bash
npm run build:mac
```

The built `.dmg` and `.zip` will be in the `dist/` folder.

## Project Structure

```
restfy/
├── app.html           # Main UI (HTML + CSS)
├── main.js            # Electron main process
├── preload.js         # Context bridge for IPC
├── package.json       # Project config & build settings
├── assets/
│   └── icon.png       # App / dock / favicon (brand mark)
├── js/
│   ├── utils.js       # Utility functions
│   ├── state.js       # Data model & persistence
│   ├── ui.js          # UI rendering & interaction
│   ├── http.js        # HTTP request execution
│   ├── codegen.js     # Import/export/code generation
│   └── scripts.js     # Pre-request & test script engine
└── promo-website/
    └── index.html     # Landing page
```

## Importing from Postman

1. In Postman: **File > Export** your collection as JSON (v2.1)
2. In Restfy: Click **Import** in the sidebar
3. Drop the `.json` file or click to browse
4. All requests, folders, auth, and body data are imported

## License

MIT — free to use, modify, and distribute.
