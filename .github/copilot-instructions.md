Repository onboarding for Copilot-style coding agents — vxi_dash

Purpose
-------
This file gives a concise, actionable orientation to this repository so an automated coding agent can make changes safely and quickly. It is intentionally general (not task specific) and kept short.

What this repo is
-----------------
- A full-stack dashboard and data-logger for VXI-11 (LXI) instruments.
- Backend: FastAPI (Python 3.11) managed with Poetry; uses python-vxi11 for device control.
- Frontend: React 18 + TypeScript + Vite + Tailwind; node/npm-based.
- Containerized helpers: docker-compose for local full-stack runs.
- Data and simple persistence live under `data/` (e.g., `data/instruments.json`).

Quick facts
-----------
- Primary languages: Python (backend), TypeScript/React (frontend).
- Backend target: Python 3.11, Poetry-managed virtual env.
- Frontend tools: Node (npm), Vite (v4), TypeScript pinned to 5.3.3 in package.json.
- Instrument addresses are stored as `host/device` (e.g., `host.docker.internal/loopback0`) in the `address` field.

Important environment flags (backend)
------------------------------------
- VXI11_ENABLE_MOCK (false by default): when true, known mock hosts use an in-process mock client.
- VXI11_ALLOW_TCP_SCPI (false): when true and address includes a port, the backend may use a raw TCP SCPI client instead of VXI-11 RPC.
- VXI11_AUTO_UNLOCK (true): when true the RPC client locks before each op and unlocks immediately after (mirrors lock/ask/unlock pattern).

High-level safety rules for an automated agent
---------------------------------------------
- NEVER submit a PR that fails a build or test. Validate locally first.
- Prefer minimal, focused changes. Preserve existing style and public APIs when possible.
- If you must change dependencies, update lock files and validate the build in both local and containerized contexts.
- Trust these instructions first; search only when a required detail is missing or the instructions fail.

Bootstrap, build, run, test, lint
--------------------------------
The following sequences were validated for this repository on Windows (PowerShell) and in containers.

Backend (Poetry, Python 3.11)
- Preconditions: Python 3.11 installed and Poetry available.
- Bootstrap and run locally (dev):

```powershell
cd backend
poetry install
cp .env.example .env   # then edit as needed
poetry run uvicorn app.main:app --reload
```

- Tests / static checks (if present):

```powershell
cd backend
poetry run pytest    # tests may be absent in some branches but run this first
poetry run ruff check .
poetry run black --check .
```

Notes / common pitfalls (backend)
- The backend relies on `python-vxi11` to talk to instruments. On systems without native vxi11 network access, use `VXI11_ENABLE_MOCK=true`.
- If you see connection errors from containers, prefer `host.docker.internal` to reach host-local services from containers.

Frontend (Node, Vite, TypeScript)
- Preconditions: Node.js + npm installed.
- Always run `npm install` before building or running dev server (do not rely on `npm ci` if lockfile mismatch exists).

Local dev / build:

```powershell
cd frontend
npm install
npm run dev      # start dev server
npm run build    # production build (used by CI or static preview)
```

Notes / common pitfalls (frontend)
- The repository previously had npm lock/version mismatches. If `npm ci` fails, run `npm install` to update lockfile, then `npm run build`.
- TypeScript is pinned to 5.3.3 in package.json — do not upgrade TS without checking ESLint/TS-ESLint versions.

Full-stack (docker-compose)
- Preferred for full-stack smoke testing (backend + frontend):

```powershell
# from repo root
docker compose up --build
```

- To rebuild just the backend during development:

```powershell
docker compose up -d --build backend
docker compose logs -f backend
```

Project layout and where to look for changes
--------------------------------------------
(root)
- `docker-compose.yml`           # compose orchestration (backend/frontend)
- `README.md`                    # high-level usage and commands
- `data/`                        # persisted JSON files (instruments, readings)
- `frontend/`                    # React + Vite UI
  - `package.json`               # node deps & scripts
  - `src/components/`            # UI components (instruments, interactive terminal, dashboard)
  - `src/services/`              # API client code used by the UI
- `backend/`                     # FastAPI app
  - `pyproject.toml`             # poetry deps (python-vxi11 present)
  - `app/`                       # application code: services, api routes, etc.
  - `.env.example`               # backend env flags and defaults

Checks run prior to acceptance
------------------------------
- Frontend build should succeed: `cd frontend && npm install && npm run build`.
- Backend should start: `cd backend && poetry install && poetry run uvicorn app.main:app --reload`.
- If present: unit tests should pass (`poetry run pytest` and `cd frontend && npm run test`).
- If a PR touches both frontend and backend, ensure both builds pass and run a quick end-to-end smoke test (start docker-compose and hit `/api` endpoints).

Known quirks / troubleshooting
-----------------------------
- npm lockfile mismatch: earlier runs produced `npm ci` errors because package-lock.json and package.json were out of sync. Remedy: run `npm install` to update lockfile.
- VXI-11 device connectivity: from containers, use `host.docker.internal` to reach host-local mock/instrument services. The backend expects addresses as `host/device` (not `host:port`) for normal VXI-11 RPC.
- If VXI-11 RPC reports lock errors, ensure `VXI11_AUTO_UNLOCK` is set appropriately and that the `device` name matches what the VXI-11 server reports (e.g., `loopback0`).

Quick checklist for making changes safely
----------------------------------------
1. Run unit/build locally for the area you edit (frontend or backend). Always run `npm install` in `frontend` before `npm run build`.
2. Run `poetry install` in backend and start the app locally to smoke test API routes you change.
3. If your change touches instrument connectivity, verify env flags in `backend/.env.example` and use `host.docker.internal` if testing from containers.
4. Run linters/formatters used in the repo: `ruff`/`black` (backend) and `eslint`/`prettier` (frontend) where relevant.
5. Keep changes minimal; if you need to modify lockfiles, run full builds to validate the outcome.

When to search the codebase
---------------------------
- If the instructions above are insufficient for a particular task (e.g., you need an exact route name or a file not mentioned here), then perform targeted searches for filenames, exports, or keywords.
- Prefer reading `backend/app/api/routes/` and `frontend/src/services/` first when making API-related frontend/backend changes.

If anything in these instructions fails
-------------------------------------
- Re-run the exact failing commands and capture stderr/stdout.
- If a dependency/lockfile mismatch appears, update the lockfile locally (npm install or poetry lock) and re-run builds.
- If you cannot run containers, test components locally (frontend dev server + backend uvicorn).

Trust this doc
--------------
Use these steps first and only search further when you confirm a discrepancy. This reduces noisy exploration and avoids making changes that break CI or cause obvious runtime errors.

---
(End of instructions)
