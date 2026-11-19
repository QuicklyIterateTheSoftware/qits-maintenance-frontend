# qits-maintenance-platform-frontend

The maintenance frontend: what every repository in the catalog pins, what the registries have
released since, what the platform's own releases already ship, which maintenance branches are
waiting, and how far each of our own releases has travelled downstream. Served by
qits-platform-maintenance at the root of `maintenance.<env>.<domain>` through Quinoa. Ten
addresses — two pages, two redirects and six full-page hops out to the landing app — all inside
the platform chrome, and each of them reachable under a project slug as well.

**The first segment is the section, and it is the organising idea of the application.** `internal`
is what this platform publishes and can release; `external` is what the world publishes and
qits-platform-mirror caches. Both used to have the same two views, because they were different
questions asked by different readers — internal is release work, external is patching — until
qits-2330 moved the internal dependency view into the landing app and qits-2331 moved the external
one there too; both sections now show only their repository listing here.

- **`/internal`** — every repository, with its internal groups as chips: last scan, status, how
  many pins are behind. One button starts an internal scan.
- **`/external`** — the repository listing of the world's side: every repository, with its
  external pins as chips and how many are behind, the same shape as `/internal` for the other
  direction.
- **`/repositories/<name>`** — no longer a screen of this application. It moved into the landing
  app, at `/projects/<slug>/maintenance/repositories/<name>`, and this address now exists only to
  carry an old bookmark there: no query travels, the name travels in the path, and `<slug>`
  resolves the same way the other hops do (qits-2334). Internal pins and external pins as two
  tables, what those pins drag in underneath them, what the platform already ships that contains
  this repository's artifacts, everything downstream of it to the end of the chain, a panel per
  group naming its branch and state, and the bumps it has had, are now the landing app's to draw.
- **`/bumps/<id>`** — no longer a screen of this application. It moved into the landing app, at
  `/projects/<slug>/maintenance/bumps/<id>`, and this address now exists only to carry an old
  bookmark there: no query travels, the id travels in the path, and `<slug>` resolves the same way
  the dependency addresses do (qits-2332).
- **`/adoption/<repository>/<version>`** — no longer a screen of this application either. It moved
  into the landing app, at `/projects/<slug>/maintenance/adoption/<repository>/<version>`, and this
  address now exists only to carry an old bookmark there: no query travels, both parameters travel
  in the path, and `<slug>` resolves the same way (qits-2333). The left-to-right flowchart the
  address used to draw here — one card per repository downstream of the release, with an arrow in
  from each of its parents, because that is the shape the answer has, a graph and not a tree — is
  now the landing app's to draw.
- **`/`** redirects to `/internal`, and
  **`/trains/by-release/<repository>/<version>`** — the address a release link landed on while the
  release trains existed — redirects to `/adoption/<repository>/<version>`, carrying both of its
  parameters, which itself redirects on to the landing app the same way (qits-2333). Nothing else of
  the trains survives: their listing and one train's id named documents this service no longer
  holds.
- **`/dependencies`** — the search's address when there was only one of them — no longer resolves to
  a screen of this application. The dependency view moved into the landing app, at
  `/projects/<slug>/maintenance/dependencies`, and this address now exists only to carry an old
  bookmark there: it forwards `?behind=`, drops `?ecosystem=` and `?name=` (lenses the landing screen
  does not have), and resolves `<slug>` from the `:project` segment of the address it was given, or
  `qits` where there was none (qits-2317).
- **`/internal/dependencies`** — the internal dependency listing's own address, no longer a screen
  of this application either. It moved into the landing app, at
  `/projects/<slug>/maintenance/artifacts`, and this address now exists only to carry an old bookmark
  there: it forwards `?ecosystem=` and `?name=`, resolving `<slug>` the same way `/dependencies`
  does (qits-2330).
- **`/external/dependencies`** — the world's dependency search's own address, no longer a screen of
  this application either. It moved into the landing app, at the same
  `/projects/<slug>/maintenance/dependencies` that `/dependencies` already redirects to, and this
  address now exists only to carry an old bookmark there: it forwards `?name=`, drops `?ecosystem=`
  (a lens that screen does not have), and resolves `<slug>` the same way the other two do
  (qits-2331).

## The project in the address

This app is **project scoped**: `/qits/internal` is the same page as `/internal`. The literal routes
are matched first, so `internal`, `external`, `repositories`, `dependencies`, `bumps`, `adoption`
and the retired `trains` redirect stay this app's own addresses and never read as projects of those
names. Everything else does: `/trains` on its own is no longer one of them, and reads as a project
of that name — the same answer any unknown first segment gets.

The scope is read from the address by `@qits/ui-components` (`provideQitsScope('project')`), never
from a route parameter, so one component serves both forms. It is drawn in the page header and
changes nothing else: this inventory is the whole catalog's, and the service offers no per-project
query.

## What the pages decide

**Behind is the service's word, never a comparison made here.** Maven, npm and OCI tags order
differently, and a client that decided `2026.8.10` is behind `2026.8.9` would highlight rows the
service is not going to move. The `pending` flag on a pin is the same answer a bump uses, and it is
what the external search highlighted too, before it moved into the landing app (qits-2331) — it
used to compare two strings itself, and disagreed with the branch the service actually writes.

**The service holds the rules; these pages report its answers.** `qits-1133` retired the group panel's
`Create branch now` button — the door it posted to answers `410` now, on its way to `404` — and
moved what it did into the `dependency-bump` release-request automation: a repository's pending pins
move at the fold of an open request, or of the main-only one the dispatcher opens for it. The group
chip on the repositories listing still names a group's branch, state and pending count; the panel
that also linked an active bump while one was running was the repository page's own, and moved into
the landing app with the rest of it at qits-2334.

**The journey was served, not stitched.** The service traced the whole closure downstream of a
release and evaluated the adoption of every step of it per request, which is what let the adoption
page make one call and draw its answer, and let the repository page's downstream section draw its
own the same way — before both moved into the landing app, the adoption page at qits-2333 and the
repository page at qits-2334. It used to be the other way round, before either page existed — the
service stored one train per release and this application walked a train per consumer, ten levels
deep — and that walk is gone with the trains: a client stitching a graph was deciding how far the
answer went, which is the service's question and not a reading's.

**Polling stops.** A page re-reads while something it can see is unfinished, one request in flight
at a time, and stops for good when nothing is. Two seconds for a bump or a scan, and nothing else
polls at all. A poll that fails leaves the last good answer on screen and says so above it.

**A scan is followed by watching the rows it moves.** `POST /scans` answers an id and the contract
has no `GET /scans/{id}`, so "it finished" can only be read off `lastScanAt` — against the server's
own timestamps, never this browser's clock. The wait is bounded at three minutes, after which the
page says so instead of spinning for ever.

**This application handles no token.** Every call is a same-origin path under `/maintenance/api`,
and the edge's session is what authenticates it. That is also why no request sets a `credentials`
option: same-origin sends the cookie by default.

## The contract it consumes

Three calls, pinned in the superproject's `qits-maintenance-plan.md` ("API"). Nine more have been
retired over time, and this application no longer calls any of them:
`POST /repositories/{name}/groups/{group}/bumps` (asking for a group's branch by hand) answers
`410` now and is on its way to `404`, retired by `qits-1133`; `GET /dependencies/dependents` and
`GET /artifacts`, which the internal dependency listing read, went with that page into the landing
app at qits-2330; `GET /dependencies`, which the external dependency search read, went the same way
at qits-2331; `GET /bumps/{id}`, which the bump page read, went the same way at qits-2332;
`GET /adoption/by-release`, which the adoption page read, went the same way at qits-2333; and
`GET /repositories/{name}`, `GET /repositories/{name}/dependents` and
`GET /repositories/{name}/downstream`, which the repository page read, went the same way at
qits-2334.

```
GET  /maintenance/api/repositories                                  → [{name, project, lastScanAt, headSha, status, message, pending, groups:[{name, source, kind, branch, state, headSha, pending}]}]
POST /maintenance/api/scans {scope, repository?}                    → 202 {id}
GET  /maintenance/api/bumps?repository=&limit=20                    → [bump rows]
```

Four things the JSON shape alone does not say, and which these pages depend on:

- **The reads answer bare arrays and bare objects, not envelopes.** No `{items: […]}` wrapper.
- **A bump row spells its group as `group` and its CI ids as `ciEventId` / `ciRunId`**, and may
  carry a `branch`. Without one the page falls back to `maintenance/<group>`.
- **A group's `kind` is null when its globs decide**, which a configured group's do. Such a group is
  drawn with the internal side rather than hidden from both.
- **A bump's `releaseRequestId` is a request id, or one of two sentinels** — `converged` (nothing
  came back to hold on to) and `refused`. Both are rendered as they arrive and never linked. The id
  names an OPEN release request in qits-projects, not a release: the quality gates settle it and Auto
  Release tags it afterwards.

## How it is served

qits-maintenance-platform-service — the repository behind the qits-platform-maintenance application
— carries this repository as a git submodule at `service/src/main/webui` — Quinoa's ui-dir — and
builds it during `mvn package`, serving the bundle at the root of its own host. `baseHref` here is `/` and `quarkus.quinoa.ui-root-path` there is `/`, so there is no segment
left for the two to disagree about. Deep links need `quarkus.quinoa.enable-spa-routing=true` there;
the whole `/maintenance` wire prefix is held back from the SPA by
`quarkus.quinoa.ignored-path-prefixes`. This repository ships no container image of its own.

## Development server

```bash
ng serve
```

Then open `http://localhost:4200/`. `proxy.conf.json` forwards `/maintenance/api`,
`/maintenance/q`, `/main-navigation` and `/projects/api` to an edge on `localhost:8080`, because
`ng serve` puts no edge in front. Without one running the sidebar renders "Navigation unavailable",
which is the intended degraded state rather than a fault.

## Running the checks

```bash
npm run lint && npm test && npm run build
```

The same three, in the same order, are what `.config/qits/ci-event-release-request.yml` runs on a
release request's fold — the one pipeline this repository has, since nothing builds on a push any
more. Note what that pipeline installs from: the npm proxy behind it is qits-platform-mirror, and
the `@qits` scope comes from qits-artifacts — so a run here cannot be green while either service is
down.

Installing on a developer machine needs a registry credential, and it is not in this repository:
`.npmrc` here carries the routing only. `qits help guide --for workstation` sets up the credential
(`qits registry-login --configure`). With the registries unreachable — or the workstation credential
expired, which it is after a re-bootstrap — `npm ci --offline` installs the whole tree from the npm
cache, because this lockfile is the orchestrator SPA's dependency set exactly.

## Running unit tests

```bash
ng test
```

Vitest on jsdom — no browser, which is what lets CI run them. The one thing a spec cannot wait for
is time, so the poll's interval and clock are injected (`QITS_SCHEDULER`) and a spec drives them by
hand. Never a `vi.mock`: a patched module leaks between spec files and makes green depend on the
order they ran in. Check that with `taskset -c 0 npm test`.

## Building

```bash
ng build
```

The bundle lands in `dist/qits-platform-spa-maintenance/browser`, which is the path
`quarkus.quinoa.build-dir` names on the service side.
