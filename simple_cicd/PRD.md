# Pipelane — Simple CI/CD Dashboard PRD

## 1. Overview

Pipelane is a minimal single-page CI/CD dashboard for **one repository** (`acme-corp/platform`) containing **5–7 projects** across three build types: **.NET** (modern, Core/5+), **.NET Framework** (classic, 4.x), and **UI**. The goal is an at-a-glance status view — no deep drill-downs, no noise.

## 2. Goals

- Show current health of every project in the repo on one screen.
- Make build type and pipeline stage progress instantly readable.
- Highlight failures and surface the **last error** even on currently-passing projects.
- Keep the UI dense but calm — Claude Code CLI aesthetic (cream + mono + Claude orange).

## 3. Non-goals

- Multi-repo or org-level views.
- Run logs, artifacts, or deploy approvals (logs linked out, not embedded).
- Editing pipelines in the UI — pipeline config lives in `pipelane.yml` in the repo.
- Real-time streaming updates (static mock; production would poll or SSE).

## 4. Users

A developer or release engineer glancing at the dashboard to answer: *"Is anything broken? What's running? When did it last break? Who last deployed?"*

## 5. Information architecture

```
Topbar        → brand (✻ Pipelane), env switcher (dev/staging/prod), tally
Project list  → sorted by status (failing → running → passing)
  Expanded    (fail / running): full pipeline + history (3 rows) + retry/logs
  Collapsed   (passing): one-liner with mini-pipeline + last build + trigger
```

## 6. Project card

### 6.1 Collapsed (passing)
`[type tag]  name  ●─●─●  sha · author · when · env  [⚙ edit] [▶ trigger]`

Optional `⚠ last fail Xd ago` chip if the project recently broke.

### 6.2 Expanded (failing / running)
- Header: type tag, name, action buttons (`edit`, `logs →`, `↻ retry` or `⠋ running`).
- Full pipeline: `build → test → deploy` with stage states.
- Left border accent: red (fail) or amber (running).
- History list: last 3 builds as rows — sha, who, when, env, status.
  - Fail rows: red tint background + red left-accent.
  - Most recent fail gets a `↪ last error` pill.

### 6.3 Pipeline stages
Uniform across all types: `build → test → deploy`.
States: `done` (green), `running` (amber, pulsing + braille spinner), `fail` (red), `pending` (gray), `skipped` (dim).

## 7. Projects (mock data)

| Project | Type     | Version | Path                   | State    |
|---------|----------|---------|------------------------|----------|
| reports | .NET     | 8.0     | src/Acme.Reports       | failing  |
| worker  | .NET     | 8.0     | src/Acme.Worker        | running  |
| api     | .NET     | 8.0     | src/Acme.Api           | passing  |
| auth    | .NET     | 8.0     | src/Acme.Auth          | passing  |
| web     | UI       | —       | apps/web (Vite)        | passing  |
| admin   | UI       | —       | apps/admin (Next.js)   | passing  |
| legacy  | .NET FW  | 4.6.1   | legacy/Acme.Billing    | passing  |

## 8. Environments

Dropdown switcher in topbar (left-side, next to brand):

- `dev` · auto-deploy
- `staging` · deploy on merge
- `production` · current scope, marked with 🔒

Scope view: changing env changes what status/history you see. Trigger button per card assumes the current env. Production gets a left-accent on the switcher and 🔒 on both pill and menu to prevent accidental prod deploys.

## 9. Project config

Each project defines its pipeline in a `pipelane.yml` file in its own folder:

```yaml
name:    api
type:    dotnet          # dotnet | dotnet-fw | ui
version: "8.0"           # .NET/.NET FW only
path:    src/Acme.Api
branch:  main
env:     production      # hardcoded for now
```

Config modal is **read-only** — shows file path + badge, with toggle between:
- **Visual** view: key/value grid (default, friendly).
- **Raw** view: `$ cat path/pipelane.yml` with syntax-colored YAML.

Below both: **derived pipeline** showing auto-inferred build/test/deploy commands for the type:

- `.NET` → `dotnet restore / build / test / publish`
- `.NET Framework` → `nuget restore / msbuild / vstest.console.exe / msdeploy`
- `UI` → `npm ci / lint / build / test / deploy`

Changing behavior = editing the yaml in the repo and pushing. `edit in repo ↗` link goes to the file.

## 10. Build markers

| Marker | Purpose |
|---|---|
| Left border 3px (red/amber) | Project-level failure/running state, visible at a glance |
| Fail row highlight (red tint + accent) | Historical failures in the history list |
| `↪ last error` pill | Identifies the single most recent failure (even among many) |
| `⚠ last fail Xd ago` chip | On collapsed passing cards that had a recent failure |

## 11. Interactions

- Env switcher: dropdown opens on click, closes on outside-click or Esc.
- `edit` button on each card: opens config modal (read-only) with visual/raw toggle.
- `trigger` / `retry` buttons: visual only (mockup).
- `logs →`: external link placeholder.
- Modal closes on overlay click, `×`, or Esc.
- Card hover: 1px border darken + subtle shadow.

## 12. Visual system

- **Theme**: light cream (`#faf9f5`), warm off-white cards (`#fffefa`).
- **Typography**: JetBrains Mono as primary (mono throughout). Serif only for modal titles if needed.
- **Accent**: Claude orange `#c15f3c` (actions, highlights, cursor, ✻ sparkle).
- **Status colors**: muted ok `#5a8a3a`, fail `#b5422e`, run `#c88328`.
- **Type colors**: `.NET` violet `#7c5aa6`, `.NET FW` slate `#6b7a99`, `UI` teal `#2d7d7a`.
- **Animations**: fade-up on load (staggered), sparkle rotate on ✻ brand, blinking cursor, braille spinner (⠋⠙⠹⠸…) on running stages, horizontal shimmer on running pipeline lines.
- Respects `prefers-reduced-motion`.
- **Layout**: max-width 820px, centered. Single column list (no grid).

## 13. Tech stack (production target)

- **Backend**: ASP.NET Core (8+) — REST endpoints for project list, history, trigger, logs.
- **Frontend**: Angular + TypeScript — SPA for the dashboard, strictly typed against backend DTOs.
- **Deployment**: self-contained, framework-bundled publish. Target machine does **not** need the .NET runtime installed.
  - **Preferred**: single `.exe`:
    ```
    dotnet publish -c Release -r win-x64 --self-contained true \
      /p:PublishSingleFile=true \
      /p:IncludeNativeLibrariesForSelfExtract=true
    ```
  - **Minimum acceptable**: one folder containing the exe + minimal static UI assets.
- **UI hosting**: ASP.NET Core serves the compiled Angular bundle as static files (`ng build --output-path <backend>/wwwroot`) — **the same exe runs both the API and the SPA**. One process, one port, one binary.
- **Config ingestion**: reads `pipelane.yml` files from a configured repo path at startup and on file-watch.
- **State**: in-memory for this iteration; persistence layer is out of scope.

## 14. Tech (current mockup)

Static `index.html` + `styles.css` + `script.js`, no framework. Served by local preview on port 8128. To be re-implemented as Angular + ASP.NET Core per section 13 when productizing; the mockup defines the visual contract and interaction model.

## 15. Out of scope for this iteration

- Authentication and multi-user permissions.
- Persistence across restarts (DB, file store).
- Branch selection (only `main` for now).
- Log streaming or artifact browsing.
- Dark theme (possible, not planned).
- Cross-project deploy orchestration.
- Editing `pipelane.yml` in the UI.
