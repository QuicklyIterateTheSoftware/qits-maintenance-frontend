import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { QitsAppLinks } from '@qits/ui-components';

/**
 * What a route pointing at this component hands it through `data`.
 *
 * `landingPath` is the screen under `/projects/<slug>/` the address moved to; `forward` names which
 * of the old address's own query parameters still mean something there. Everything else the old
 * address carried is dropped rather than forwarded as something the destination cannot act on —
 * `/dependencies` named a search by `?ecosystem=&name=` that the landing app's dependencies screen
 * does not have, so only its `?behind=` travels (qits-2317); `/internal/dependencies` named one
 * artifact by the same two parameters, which the artifacts screen reads as its detail, so they do
 * travel there (qits-2330). `/external/dependencies` named the same search `/dependencies` once did,
 * by `?name=` with `?ecosystem=` alongside it, and lands on that same dependencies screen — so only
 * `?name=` travels, the one lens the search still has (qits-2331).
 */
export interface DependenciesRedirectData {
  readonly landingPath: string;
  readonly forward: readonly string[];
}

/**
 * Where an old address of this application's own now goes, now that the screen it named lives in
 * the landing app instead: `/dependencies` to `/projects/<slug>/maintenance/dependencies`
 * (qits-2317), `/internal/dependencies` to `/projects/<slug>/maintenance/artifacts` (qits-2330), and
 * `/external/dependencies` back to `/projects/<slug>/maintenance/dependencies` (qits-2331). All
 * three are the same one hop, differing only in the `data` the route pointing here carries — see
 * {@link DependenciesRedirectData}.
 *
 * **The project comes from the route, not from `QITS_SCOPE`.** Every other page in this
 * application reads the address through that token instead, because it also recognises the
 * project form of the URL grammar once the project list has answered. This page has no such page
 * to wait for: it is leaving the moment it can, so it reads the `:project` segment the route table
 * already matched — present only under the scoped routes in `app.routes.ts` — and falls back to
 * `qits`, the estate's only project, exactly where that segment is absent.
 *
 * **The destination's origin is an async answer, and this screen waits for it rather than
 * guessing.** `QitsAppLinks.origin('qits-landing')` and its `environmentOrigin()` fallback both
 * come from the platform's navigation, fetched after this application started, so `link` is
 * `undefined` until one of them resolves — and stays that way forever on a platform that never
 * answers. A relative address would be wrong on every host but this one, so there is no fallback
 * that guesses it: with neither origin ever landing, this screen keeps saying where the view moved
 * to without acting on it, rather than sending the reader to this host's own `/projects/...`,
 * which nothing here serves.
 *
 * **A full-document navigation, not a router one.** The destination is a different application
 * entirely, so `Router.navigate` would compile a route this SPA does not have and go nowhere;
 * `document.location.replace` leaves no entry for the back button to return to this redirect.
 */
@Component({
  selector: 'app-dependencies-redirect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      This view moved to the landing app:
      @if (link(); as href) {
        <a [href]="href">{{ href }}</a>
      } @else {
        <span>resolving the landing app's address…</span>
      }
    </p>
  `,
})
export class DependenciesRedirect {
  private readonly route = inject(ActivatedRoute);
  private readonly links = inject(QitsAppLinks);
  private readonly document = inject(DOCUMENT);

  /** This route's own `data` — a fixed shape, because every route pointing here declares it. */
  private readonly data = this.route.snapshot.data as DependenciesRedirectData;

  /** The `:project` segment one level up, or `undefined` at this app's own unscoped routes. */
  private readonly project = this.route.snapshot.parent?.paramMap.get('project') ?? 'qits';

  /** The forwarded query string, built once: this page never re-renders on a param change. */
  private readonly query = (() => {
    const params = this.route.snapshot.queryParamMap;
    const forwarded = new URLSearchParams();
    for (const name of this.data.forward) {
      const value = params.get(name);
      if (value !== null) {
        forwarded.set(name, value);
      }
    }
    return forwarded.toString();
  })();

  /** The landing app's screen this address now names, once an origin for it is known. */
  protected readonly link = computed<string | undefined>(() => {
    const origin = this.links.origin('qits-landing') ?? this.links.environmentOrigin();
    if (!origin) {
      return undefined;
    }
    const path = `/projects/${encodeURIComponent(this.project)}/${this.data.landingPath}`;
    const search = this.query ? `?${this.query}` : '';
    return `${origin.replace(/\/+$/, '')}${path}${search}`;
  });

  constructor() {
    effect(() => {
      const link = this.link();
      if (link) {
        this.document.location.replace(link);
      }
    });
  }
}
