import type { Route, Routes } from '@angular/router';
import { QitsMainLayout } from '@qits/ui-components';
import { DependenciesRedirect } from './dependencies/dependencies-redirect';
import { NotFound } from './not-found/not-found';

/**
 * Ten addresses, all of them inside the platform chrome; two are `redirectTo` entries and five
 * others — `internal/dependencies`, `dependencies`, `external/dependencies`, `bumps/:id` and
 * `repositories/:name` — are full-page hops out of this application entirely.
 *
 * **The first segment is the SECTION, and it is the organising idea of the whole application.**
 * `internal` is what this platform publishes and can release; `external` is what the world
 * publishes and qits-platform-mirror caches. Both used to carry the same two views — a repository
 * listing and a dependency view — because they were different questions asked by different
 * readers, and because the answer to one of them is a link worth pasting on its own; qits-2330
 * moved the internal dependency view into the landing app and qits-2331 moved the external one
 * there too, so both sections now keep only their repository listing here.
 *
 * **The section reaches the page as route `data`, never as a parameter.** `RepositoriesPage` serves
 * both listings, and a literal in the table is what keeps `/internal` from being one more string a
 * component has to validate; a `:section` parameter would also claim `/anything`, which is the
 * project form's job.
 *
 * **`QitsMainLayout` is the root route component** — the platform's convention, stated in the
 * component's own docs. Mounted this way the bar and the navigation mount once and survive every
 * navigation beneath them; wrapping each page in a tag would rebuild the whole skeleton on every
 * hop. It is an eager import for that reason: it is not a page, it is the frame the pages arrive
 * in, and a frame that loaded in its own chunk would show a blank application while it did.
 *
 * **The path shape used to repeat the API's, noun for noun.** `/maintenance/repositories/qits-ci`
 * matched what `GET /maintenance/api/repositories/qits-ci` answers, section-neutral like the API
 * itself: a repository's page showed both halves of what it pins. `/maintenance/bumps/<id>` matched
 * `GET /maintenance/api/bumps/<id>` the same way. qits-2332 moved the bump page into the landing app
 * and qits-2334 did the same to the repository page, so both addresses are now full-page hops
 * instead (below), and this application answers nothing at either of them directly any more.
 *
 * **A release is addressed by what it is, not by an id this application minted.**
 * `adoption/:repository/:version` is the whole of the adoption journey: a linker — a release
 * request, a CI run, a chat message — has a repository and a version, and the service answers the
 * journey of that pair per request. There is nothing to resolve first and no id to look up, which
 * is why this is a plain page where the release trains needed a resolver component in front of one.
 *
 * **`trains/by-release/:repository/:version` is kept as a redirect to it.** The release trains are
 * retired, but that address is in links qits-projects has already published, and the two carry the
 * same pair of parameters — so the redirect substitutes them and the old link opens the new page.
 * Nothing else under `trains` survives, and nothing is added to bury it: `trains/:id` named a
 * document that no longer exists and falls through to the wildcard, and the bare `trains` is not
 * one of this app's segments any more, so it reads as a project of that name — the same answer any
 * unknown first segment gets, and the one the reader of a stale bookmark can act on.
 *
 * **The dependency views' state was always in query parameters, not a segment.** `?name=@qits/*`
 * on the external search, `?ecosystem=&name=` on the internal one: both held slashes, colons and
 * asterisks, and a query parameter is what let the back button mean "the previous question". Both
 * views have since moved out (below); what each forwards still travels as query parameters, just
 * one hop further on.
 *
 * **`/dependencies`, `internal/dependencies`, `external/dependencies`, `bumps/:id` and
 * `repositories/:name` all later went the other way.** The views they named moved into the landing
 * app — `/dependencies` to `/projects/<slug>/maintenance/dependencies` (qits-2317),
 * `internal/dependencies` to `/projects/<slug>/maintenance/artifacts` (qits-2330),
 * `external/dependencies` to `/projects/<slug>/maintenance/dependencies` (qits-2331), `bumps/:id` to
 * `/projects/<slug>/maintenance/bumps/<id>` (qits-2332), `repositories/:name` to
 * `/projects/<slug>/maintenance/repositories/<name>` (qits-2334) — so all five addresses are now
 * {@link DependenciesRedirect}: a full-page hop to the screen that replaced them. Each route's own
 * `data` says which screen it goes to and which query parameters still mean something there —
 * `?behind=` for the first, `?ecosystem=` and `?name=` for the second, `?name=` for the third, none
 * for the fourth, whose id travels in the path instead, and none for the fifth either, whose name
 * travels the same way — and {@link DependenciesRedirect} drops everything else as something the
 * destination cannot act on. Old bookmarks to any form of any of the five addresses still work; they
 * just do not land on a screen of this application any more.
 *
 * **Every one of these is a deep link a reader will paste.** They survive a reload only because
 * qits-platform-maintenance sets `quarkus.quinoa.enable-spa-routing=true`, which answers an unknown
 * path on this host with `index.html` instead of a 404; the whole `/maintenance` wire prefix is
 * held back from that by `quarkus.quinoa.ignored-path-prefixes`.
 */
const OWN: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'internal' },
  // The address the internal dependency listing had before it moved into the landing app, as
  // `/projects/<slug>/maintenance/artifacts` (qits-2330). Only the coordinate still travels.
  {
    path: 'internal/dependencies',
    pathMatch: 'full',
    component: DependenciesRedirect,
    data: { landingPath: 'maintenance/artifacts', forward: ['ecosystem', 'name'] },
  },
  {
    path: 'internal',
    data: { section: 'INTERNAL' },
    loadComponent: () => import('./repositories/repositories-page').then((m) => m.RepositoriesPage),
  },
  // The address the external dependency search had before it moved into the landing app.
  {
    path: 'external/dependencies',
    pathMatch: 'full',
    component: DependenciesRedirect,
    data: { landingPath: 'maintenance/dependencies', forward: ['name'] },
  },
  {
    path: 'external',
    data: { section: 'EXTERNAL' },
    loadComponent: () => import('./repositories/repositories-page').then((m) => m.RepositoriesPage),
  },
  // The address one repository had before it moved into the landing app, as
  // `/projects/<slug>/maintenance/repositories/<name>` (qits-2334). No query travels.
  {
    path: 'repositories/:name',
    component: DependenciesRedirect,
    data: { landingPath: 'maintenance/repositories/:name', forward: [] },
  },
  // The address one bump had before it moved into the landing app, as
  // `/projects/<slug>/maintenance/bumps/<id>` (qits-2332). No query travels.
  {
    path: 'bumps/:id',
    component: DependenciesRedirect,
    data: { landingPath: 'maintenance/bumps/:id', forward: [] },
  },
  {
    path: 'adoption/:repository/:version',
    loadComponent: () => import('./adoption/adoption-page').then((m) => m.AdoptionPage),
  },
  // The address a release link landed on while the release trains existed. Both parameters carry
  // across into the redirect, so a link published before this change opens the journey it meant.
  {
    path: 'trains/by-release/:repository/:version',
    redirectTo: 'adoption/:repository/:version',
  },
  // The address the dependency search had before it moved into the landing app.
  {
    path: 'dependencies',
    pathMatch: 'full',
    component: DependenciesRedirect,
    data: { landingPath: 'maintenance/dependencies', forward: ['behind'] },
  },
];

/**
 * The same addresses under a project slug — `/qits/internal` beside `/internal`.
 *
 * **Order is the whole guard.** The literal routes above are matched first, so `internal`,
 * `external`, `repositories`, `dependencies`, `bumps`, `adoption` and the retired `trains` stay
 * this app's own addresses and never read as projects of those names; only what none of them claim
 * falls through to `:project`.
 * Every page but one
 * never reads this parameter: it asks `QITS_SCOPE`, which parses the address the same way in both
 * forms, so one component serves both. {@link DependenciesRedirect} is the exception — it reads
 * `:project` straight off this route rather than through `QITS_SCOPE`, because it has no reason to
 * wait on the project list that token's parsing needs: it is leaving this application either way,
 * so it falls back to `qits` rather than to the unscoped answer `QITS_SCOPE` would give while that
 * list is still loading.
 *
 * This app is project scoped and not repository scoped — or was, while it still had a repository
 * page of its own. That page was about a repository's *pins*, which the inventory keys by name
 * across the whole catalog, so its address stayed `repositories/<name>` rather than becoming the
 * platform's `<category>/<repo>` form; qits-2334 moved the page into the landing app, at the same
 * `repositories/<name>` noun under `/projects/<slug>/maintenance/`, so the address shape outlived
 * the page that used to answer it here.
 */
const SCOPED: Route = { path: ':project', children: OWN };

export const routes: Routes = [
  {
    path: '',
    component: QitsMainLayout,
    children: [...OWN, SCOPED, { path: '**', component: NotFound }],
  },
];
