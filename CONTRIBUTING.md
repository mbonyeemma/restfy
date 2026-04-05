# Contributing to Restify

Thanks for considering a contribution. This project is maintained by [mbonyeemma](https://github.com/mbonyeemma); community help is welcome.

## Before you start

1. **Open an issue first** for larger changes (new features, refactors, dependency overhauls) so we can agree on direction.
2. **Small fixes** (typos, obvious bugs, docs) can go straight to a PR.
3. **Security issues**: do not file a public issue. Email or use GitHub private vulnerability reporting if enabled on the repo.

## How to run the project locally

```bash
git clone https://github.com/mbonyeemma/restfy.git
cd restfy
cd frontend
npm install
```

| Goal | Command |
|------|---------|
| Web UI (static server) | `npm run dev` or `npm start` |
| Desktop (Electron) | `npm run electron` |
| macOS installer (local) | `npm run build:dmg` → artifacts under `frontend/dist/` |

API server (optional, for cloud/share/sync):

```bash
cd ../server
npm install
npm run dev
```

## Pull request guidelines

- **One topic per PR** — easier to review and merge.
- **Match existing style** — same formatting, naming, and patterns as surrounding code.
- **Describe what and why** in the PR description; link related issues.
- **Test your change** — at least run the app path you touched (web, Electron, or server).

## Areas of the codebase

| Path | What lives there |
|------|------------------|
| `frontend/` | Electron `main.js` / `preload.js`, `app.html`, `docs.html`, `js/*`, `assets/` |
| `server/` | Express API, SQLite, auth, share/proxy routes |
| `.github/workflows/` | CI (e.g. macOS DMG release build) |

## Code of conduct

Be respectful in issues and PRs. Disagreement is fine; harassment is not.

## License

By contributing, you agree your contributions are licensed under the same [MIT License](LICENSE) as the project.
