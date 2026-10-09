# Launchpad - Implementation Notes

This document is a high-level map of Launchpad for developers and future maintainers. It supplements the detailed
file-overview comments in the source; it does not list every class or describe every API implementation detail. See
[launchpad-documentation.md](launchpad-documentation.md) for the user-facing guide and [README.md](../README.md) for
setup, deployment, and operational commands.

## At a Glance

| Area | Main files | Responsibility |
|---|---|---|
| Server entry point | `js/server/launchpad-server.ts` | Express middleware, `/api` routes, SSE, static client hosting, and process error policy |
| Mutable server state | `js/server/LaunchpadServerModel.ts` | Remote and local branch knowledge, module list, cache coordination, updates, polling, and cache warming |
| Branch addressing | `js/common/branch-specifiers.ts` | Converts URL-safe branch specifiers to primary, release, or feature branches |
| Runnable metadata | `js/server/runnable-branches.ts` | Builds `BranchInfo` and `RunnableBranchInfo`, including compatibility flags for old releases |
| File serving | `js/server/serve.ts`, `js/server/serve-sources.ts`, `js/server/serve-directory-listing.ts`, `js/server/serve-transformed-content.ts` | Safe raw/transpiled/bundled/live serving from disk or immutable Git objects |
| Builds | `js/server/builds.ts` | Worktree selection, build jobs, atomic artifact publication, pointers, and garbage collection |
| Query parameters | `js/server/query-parameters.ts`, `js/server/workers/extractQueryParameters.ts` | Dependency discovery and QueryStringMachine schema extraction from disk or Git objects |
| Background work | `js/server/worker-pools.ts`, `js/server/workers/` | Piscina pools for transpilation, bundling, modulify, content hashing, and schema extraction |
| Shared API types | `js/types/common-types.ts` | Request/response data shared by server and client |
| Client entry point | `js/client/client.ts` | Global client state, Scenery display, top-level layout, selection, popups, launch, and resizing |
| Module and branch UI | `js/client/ModuleListNode.ts`, `ModuleNode.ts`, `BranchNode.ts` | Search/filtering, branch selection, branch/build status, recent commits, and refreshes |
| Modes and customization | `js/client/ModeSelectionNode.ts`, `js/client/modes/` | Mode catalog, per-mode URL construction, built/unbuilt choice, wrappers, versions, and query parameters |
| Client persistence | `js/client/settings.ts`, `js/client/localStorage.ts`, `js/client/theme.ts` | Browser-local preferences, startup selection restoration, and light/dark theme state |
| Tests | `js/test/launchpad-server-tests.ts` | Non-mutating integration coverage for core `/api` and `/serve` behavior |

## Runtime Shape

Launchpad has two separately built parts:

- The Node server runs TypeScript through `tsx`/Sage and operates on the containing totality checkout.
- The browser client is a SceneryStack single-page application bundled by esbuild into `dist/`. The server serves
  that directory at the root after registering `/api` and `/serve`.

There is no independent database. Persistent server data is limited to caches and the build-pointer file under
`launchpad/cache/`. Browser preferences and the last selected module, branch, and mode are stored in local storage.

### Developer mode and server mode

| Concern | Developer mode (default) | Server mode (`--server`) |
|---|---|---|
| Primary content | Current working copy on disk, including uncommitted changes | Primary checkout on `main` |
| Primary build | Runs in the working copy and always rebuilds | Runs in an isolated detached-SHA worktree |
| Remote refresh | Read-only branch-map refresh about every 60 seconds | Fast main poll plus the full update loop |
| Pull behavior | Only an explicit `POST /api/update` pulls | Pulls automatically when remote main advances |
| Working-copy cleanliness | Polled in the background | Assumed clean; avoids a monorepo-wide `git status` |
| Cache warming | Not run | Runs after startup and relevant ref changes |
| Wildcard CORS | Enabled by default | Disabled by default; enable explicitly with `--cors` |
| Stray process error | Logged; server continues | Process exits so pm2 can restart it |

Release builds use release-branch worktrees in both modes. Feature builds use detached-SHA worktrees except for the
special developer-mode primary case.

## Branch Model

Launchpad uses a slash-free **branch specifier** as one URL segment:

| Specifier | Meaning |
|---|---|
| `primary` | The primary checkout, whatever branch it is on locally (required to be `main` for server updates) |
| `release-{sim}-{version}` | `releases/{sim}/{version}` |
| `feature-{name}` | `features/{name}`, with underscores decoded as slashes |

Feature branch names containing literal underscores cannot be represented and are omitted from the client dropdown.
The client receives primary and release runnable entries from `/api/runnable-branches/:module`. Feature branch names
come from the branch map and their runnable information is fetched lazily after selection.

The server distinguishes two sources of branch truth:

- The remote branch-to-SHA map comes from `git ls-remote`. It drives the dropdown, latest-SHA indicators, and the
  decision to update server-mode main.
- Locally fetched refs drive branch serving, runnable metadata, and builds. This keeps the content actually served
  consistent with the SHA reported by those operations.

`runnable-branches.ts` detects historical release conventions at a SHA. These flags select old versus modern build
paths, PhET-iO query parameter names, Studio/Instance Proxies links, and wrapper locations without attempting to run
old unbuilt toolchains.

## Server State and Refresh

`LaunchpadServerModel` owns the mutable catalog used by routes:

- the remote branch-to-SHA map and current module list;
- cached primary, release, and feature branch information;
- locally fetched ref and worktree state;
- SHA-keyed runnable metadata;
- the single in-flight primary update;
- recently viewed module order and cache-warming generations.

Updates are single-flight. A manual request either starts an observable job, returns the existing job, or attaches a
new job to an update that the server loop already started. A successful pull invalidates branch/serve state, prevents
query-parameter results computed across the pull from being cached, reloads modulify processes lazily, refreshes the
module and branch catalogs, and restarts server-mode cache warming.

Server mode has two complementary loops:

- A fast, single-ref poll checks remote main every few seconds and starts an update quickly.
- The slower update loop refreshes the complete branch map and module list, fetches non-main refs, updates Babel,
  invalidates local state, removes unused SHA worktrees, and schedules cache warming when refs changed.

Developer mode never fetches in its background refresh. It refreshes remote knowledge with `ls-remote`, recomputes
the module list, and invalidates locally derived state so external Git operations become visible.

## HTTP Surface

### Catalog, branch, and build API

| Route | Purpose |
|---|---|
| `GET /api/module-list` | Totality directories and maintained external repositories with relevant feature flags |
| `GET /api/branch-map` | Last known remote totality branch-to-SHA map |
| `GET /api/totality-sha` | Remote SHA for totality main |
| `GET /api/latest-sha/:branch` | Remote SHA for one branch; the branch may include slashes |
| `GET /api/latest-commits/:specifier` | Five locally available commits for the selected branch |
| `GET /api/release-branches` | Release branches derived from the remote branch map |
| `GET /api/runnable-branches/:module` | Primary and release runnable entries for one module |
| `GET /api/runnable-branch/:runnable/:specifier` | One runnable entry, used primarily for lazy feature branches |
| `POST /api/build/:runnable/:specifier` | Start or attach to a build job |
| `GET /api/build-status/:runnable/:specifier` | Built SHA, latest local SHA, freshness, and active job ID |
| `POST /api/update` | Start or attach to a primary-checkout update job |
| `GET /api/update-status` | Whether an update is active and whether it has an observable job |

### Supporting API

| Route | Purpose |
|---|---|
| `GET /api/events/:id` | SSE replay and live output for a build/update job |
| `GET /api/events/log` | Page-lifetime SSE stream of server log events |
| `GET /api/last-notable-events` | Recently retained warnings and errors |
| `GET /api/query-parameters/:module/:specifier` | Extracted and normalized query parameter schemas |
| `GET /api/wrappers` | Known PhET-iO wrapper names |
| `POST /api/reload-modulify` | Lazily restart all modulify child processes |

Async route wrappers forward failures to one opaque central 500 handler. Optional HTTP basic authentication comes
from `launchpad/config.json`. Responses use revalidation-oriented cache control, and compression is enabled except
for SSE streams. Developer mode enables wildcard cross-origin access by default. Server mode requires an explicit
`--cors` option (or `launchpadOptions.cors: true` in `build-local.json`) before sending the wildcard header.

## File-Serving Pipeline

Route registration and URL policy stay in `serve.ts`. After validation, requests flow through three focused services:

- `serve-sources.ts` resolves branch specifiers and adapts disk checkouts/worktrees or immutable Git objects.
- `serve-directory-listing.ts` renders listings and dispatches raw-file fallback through the selected source adapter.
- `serve-transformed-content.ts` owns extension resolution, transpilation, bundling, live modulify, validators, and
  byte-bounded content caches.

`/serve` has five forms:

| Form | Behavior |
|---|---|
| `/serve/raw/:specifier/:file` | Original file contents |
| `/serve/transpile/:specifier/:file` | On-demand TypeScript-family transpilation |
| `/serve/bundle/:specifier/:file` | Transpilation plus bundling for detected `*-main` and `*-tests` entry points |
| `/serve/live/:specifier/:file` | Bundling plus live modulify for the primary checkout |
| `/serve/build/:runnable/:sha-or-specifier/:file` | Published build artifact or directory listing |

Primary and checked-out branches are read from disk. Other branches are read from immutable Git objects at a
locally fetched SHA. `GitCatPool` keeps several `git cat-file --batch` processes alive so Git-backed reads do not
spawn a process per file. Git directory listings use `git ls-tree`.

Release specifiers are rejected by all unbuilt modes. Old releases may depend on obsolete transpiler/build layouts,
so the supported and reproducible path is a release build artifact.

Bundling and modulify require a directory on disk. A Git-backed entry point therefore falls back to transpiled ES
modules, allowing the browser to load the dependency graph. Live modulify is limited to primary because the modulify
workers operate on the primary totality directory.

Path handling is allowlist-based and rejects traversal, control characters, encoded-percent tricks, and unknown
extensions. A `.js` request can resolve to `.js`, `.ts`, `.tsx`, `.jsx`, or `.mts` source.

### Validators and content caches

- Raw disk files use Express file validators. Simple transformed disk files use weak mtime/size ETags and an
  LRU-bounded transform cache.
- Disk bundles use a strong content hash because their dependencies are not tracked independently.
- Git-served content uses a strong `(mode, SHA, path)` ETag. It can return 304 without reading the Git object and is
  cached in a byte-bounded LRU.
- Live-modulified and synthesized virtual files are not validator-backed because their result depends on modulify
  state beyond the requested file.

## Build Pipeline

Builds are deduplicated per `runnable@branchSpecifier` and represented as jobs. Build output is retained up to about
1 MB and replayed when a client attaches. Completed jobs remain attachable briefly before removal.

The build target is selected as follows:

1. Developer-mode `primary` builds in the working copy so local edits are included.
2. Release builds update and use the release branch worktree.
3. Server-mode primary and feature builds snapshot the current SHA and use a detached SHA worktree.

Successful output is copied to a temporary directory and atomically renamed into
`cache/builds/{sha}/{runnable}`. A persisted pointer map resolves each runnable/specifier to its last successful SHA,
so an in-progress rebuild cannot disturb the artifact currently served and multiple specifiers may share one
artifact. Pointer-file writes are serialized within the server and atomically replace the prior file, so concurrent
build completions cannot race over the shared temporary file. Artifacts are revalidated rather than treated as
immutable because rebuilding the same totality SHA can incorporate newer Babel data.

After builds, unused detached-SHA worktrees and artifacts no longer referenced by pointers are removed. Release
worktrees are retained. The implementation assumes one Launchpad builder owns a totality checkout; two server
instances could otherwise disagree about which worktrees are safe to remove.

## Query Parameter Extraction

For primary, Launchpad runs Chipper dependency discovery in the working copy and extracts schemas from files on disk.
For non-primary branches it reconstructs the dependency set from `package.json` and `chipper/build.json`, finds
candidate files with `git grep`, and reads them through `GitCatPool`. Parsing is delegated to a worker in both cases.

Results are cached per dependency/SHA and per runnable/SHA with a one-day TTL. The TTL bounds two known inputs that
are not fully represented by the totality SHA: Babel locale data and primary working-copy edits. Before returning,
Launchpad supplies runtime-derived defaults and valid values for parameters such as brand, locale, color profiles,
and accessibility feature flags.

## Client Architecture

The page-level state in `client.ts` consists of the module list, remote branch map, selected module, search text, and
the currently displayed mode list. The client fetches the initial catalogs at startup and polls the branch map about
once per minute. It only assigns a newly fetched map when its serialized content changed, avoiding unnecessary UI
reconstruction.

The main composition is:

```text
client.ts
├── SearchBoxNode
├── ModuleListNode
└── ModuleNode
    ├── branch ComboBox
    └── BranchNode (runnable) or ModeSelectionNode (non-runnable)
        ├── branch/build/commit information
        └── ModeSelectionNode
            ├── ModeListNode
            └── mode-specific CustomizationNode
```

The single search string has three roles: ordinary words fuzzy-filter modules, dash-prefixed words fuzzy-filter
modes, and a numeric token selects an available release version. Enter activates the current mode globally. Clicking
an already selected module or mode also activates it.

`getModes.ts` assembles runnable modes from package brands, branch compatibility flags, build availability, sim
features, and the advanced setting. `getModuleModes.ts` appends branch-independent tools, documentation, tests, and
repository links; non-runnable modules show only these modes.

Mode customization nodes own URL construction. The common runnable customization chooses built versus unbuilt,
chooses live versus ordinary transpilation, and serializes selected query parameters. Wrapper and deployed-version
modes have specialized nodes.

## Client Lifetime and Persistence

`ModuleNode`, `BranchNode`, query-parameter controls, and list items are transient. They are replaced as selection,
branch data, or search results change. Their global Property listeners, timers, input listeners, and derived
Properties must therefore be released on disposal. Page-level display state and settings Properties live for the
page lifetime.

The UI deliberately disposes replaced Scenery children rather than merely removing them. Async handlers must also
check that their owning node is still current before applying results. This is especially important for commit
fetches, feature-branch fetches, job attachment, query-parameter loading, and freshness polling.

Settings persisted in the browser are launch target (same/new tab), module filtering, color theme, advanced-option
visibility, built/unbuilt preference, live-modulify preference, and favorite query parameters. The most recently
selected module, branch specifier, and mode are restored only during initial page startup.

## Configuration and Operations

Command-line options (or matching `build-local.json` launchpad options) are:

| Option | Default | Meaning |
|---|---:|---|
| `--port` | `45372` | HTTP port |
| `--server` | `false` | Enables automatic updates, cache warming, isolated primary builds, and fail-fast errors |
| `--cors` | `true` in developer mode; `false` in server mode | Sends `Access-Control-Allow-Origin: *` |
| `--cacheModulification` | `true` | Enables disk caching inside the modulify worker layer |
| `--logLevel` | `verbose` (`info` in `npm run local-server`) | Winston threshold: silly through error |

`launchpad/config.json`, when present, can provide basic-auth credentials. `~/.phet/build-local.json` can provide
local build/Launchpad options.

## Testing and Maintenance Invariants

`npm test` starts a developer-mode server on a free port and exercises non-mutating API and serving paths. It avoids
build and update operations because those are slow and mutate checkouts. Repository-wide verification is performed
from the totality root with `./bin/check --fix --skip-phet-io-compare-api`.

When modifying Launchpad, preserve these invariants:

- Release branches are build-only; do not silently route them through the current unbuilt toolchain.
- Remote branch knowledge and locally fetched branch content are different sources of truth; use the one appropriate
  to the operation and keep reported content aligned with what is actually served.
- Cache entries containing branch content must be SHA-keyed or explicitly invalidated after Git state changes.
- A query-parameter computation that overlaps a pull must not be cached.
- A published build pointer changes only after the new artifact is completely in place.
- Build status is a SHA comparison. Working-copy dirtiness is a warning, not part of build freshness.
- Long operations are single-flight jobs so duplicate requests attach instead of starting competing work.
- Every transient client node must release global listeners/timers and ignore late async results after disposal.
- Worker-thread work must remain isolated from Express's event loop; modulify process reloads are coordinated through
  the shared generation value.
