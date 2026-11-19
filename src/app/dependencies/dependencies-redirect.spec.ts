import { DOCUMENT } from '@angular/common';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideQitsNavigationTree, type QitsNavigation } from '@qits/ui-components';
import { DependenciesRedirect, type DependenciesRedirectData } from './dependencies-redirect';

/**
 * Where an old bookmark to this app's own `/dependencies` and `internal/dependencies` — and their
 * `/<project>/…` forms — lands, now that the views they named live in the landing app.
 *
 * **No router here, on purpose.** The component reads its one route parameter off
 * `ActivatedRoute.snapshot.parent`, which is a plain object this suite can shape directly — mounting
 * the whole route table through a harness would additionally have to stand up `QitsMainLayout` just
 * to reach a page that is leaving before it would ever be drawn.
 *
 * **`DOCUMENT` is a proxy over the real one, not a bare replacement.** jsdom's own
 * `location.replace` cannot be spied on at all, but the real `DOCUMENT` is also what Angular's own
 * test renderer uses to attach and tear down the fixture's root element — a fake carrying nothing
 * but a `location` breaks `TestBed.createComponent` itself before this page gets a chance to run.
 * The proxy forwards every other read straight to `document`, methods bound to it so their native
 * internals still see the object they expect, and answers only `location` itself.
 */
function fakeDocument(replace: (url: string) => void): Document {
  const location = { replace };
  return new Proxy(document, {
    get(target, prop, receiver) {
      if (prop === 'location') return location;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as Document;
}

describe('DependenciesRedirect', () => {
  let replace: ReturnType<typeof vi.fn<(url: string) => void>>;

  /** The route `data` `/dependencies` carries — the shape qits-2317 gave this component first. */
  const DEPENDENCIES_DATA: DependenciesRedirectData = {
    landingPath: 'maintenance/dependencies',
    forward: ['behind'],
  };

  /** The route `data` `internal/dependencies` carries, since qits-2330. */
  const ARTIFACTS_DATA: DependenciesRedirectData = {
    landingPath: 'maintenance/artifacts',
    forward: ['ecosystem', 'name'],
  };

  /** `project` left out is this app's own unscoped address, whose route names no project. */
  function mount(options: {
    readonly data?: DependenciesRedirectData;
    readonly project?: string;
    readonly query?: Readonly<Record<string, string>>;
    readonly navigation?: QitsNavigation;
  }): ComponentFixture<DependenciesRedirect> {
    replace = vi.fn<(url: string) => void>();
    const route = {
      snapshot: {
        data: options.data ?? DEPENDENCIES_DATA,
        queryParamMap: convertToParamMap(options.query ?? {}),
        parent:
          options.project === undefined
            ? null
            : { paramMap: convertToParamMap({ project: options.project }) },
      },
    } as unknown as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: DOCUMENT, useValue: fakeDocument(replace) },
        provideQitsNavigationTree(options.navigation ?? {}),
      ],
    });
    const fixture = TestBed.createComponent(DependenciesRedirect);
    fixture.detectChanges();
    return fixture;
  }

  const LANDING_ORIGIN: QitsNavigation = {
    applications: { 'qits-landing': { origin: 'https://qits.example.test' } },
  };

  describe('/dependencies, forwarding to maintenance/dependencies', () => {
    it('redirects to the landing app’s dependencies screen, forwarding only the lens it still reads', () => {
      mount({
        project: 'qits',
        query: { behind: 'true', ecosystem: 'npm', name: '@qits/*' },
        navigation: LANDING_ORIGIN,
      });

      expect(replace).toHaveBeenCalledOnce();
      expect(replace).toHaveBeenCalledWith(
        'https://qits.example.test/projects/qits/maintenance/dependencies?behind=true',
      );
    });

    it('uses the estate’s only project when the address names none', () => {
      mount({ query: {}, navigation: LANDING_ORIGIN });

      expect(replace).toHaveBeenCalledWith(
        'https://qits.example.test/projects/qits/maintenance/dependencies',
      );
    });

    it('carries the named project across', () => {
      mount({ project: 'acme', query: {}, navigation: LANDING_ORIGIN });

      expect(replace).toHaveBeenCalledWith(
        'https://qits.example.test/projects/acme/maintenance/dependencies',
      );
    });

    it('forwards no query string at all when nothing in the address is the one lens', () => {
      mount({
        project: 'qits',
        query: { ecosystem: 'npm', name: 'x' },
        navigation: LANDING_ORIGIN,
      });

      expect(replace).toHaveBeenCalledWith(
        'https://qits.example.test/projects/qits/maintenance/dependencies',
      );
    });
  });

  describe('internal/dependencies, forwarding to maintenance/artifacts (qits-2330)', () => {
    it('redirects to the landing app’s artifacts screen, forwarding the coordinate and dropping the rest', () => {
      mount({
        data: ARTIFACTS_DATA,
        project: 'qits',
        query: { ecosystem: 'maven', name: 'eu.wohlben.qits:qits-eventstream', x: '1' },
        navigation: LANDING_ORIGIN,
      });

      expect(replace).toHaveBeenCalledOnce();
      expect(replace).toHaveBeenCalledWith(
        'https://qits.example.test/projects/qits/maintenance/artifacts' +
          '?ecosystem=maven&name=eu.wohlben.qits%3Aqits-eventstream',
      );
    });

    it('carries the named project across, under the scoped /<project>/internal/dependencies form', () => {
      mount({
        data: ARTIFACTS_DATA,
        project: 'acme',
        query: { ecosystem: 'npm', name: '@qits/ui-components' },
        navigation: LANDING_ORIGIN,
      });

      expect(replace).toHaveBeenCalledWith(
        'https://qits.example.test/projects/acme/maintenance/artifacts' +
          '?ecosystem=npm&name=%40qits%2Fui-components',
      );
    });

    it('forwards no query string at all when neither half of the coordinate is in the address', () => {
      mount({ data: ARTIFACTS_DATA, project: 'qits', query: {}, navigation: LANDING_ORIGIN });

      expect(replace).toHaveBeenCalledWith(
        'https://qits.example.test/projects/qits/maintenance/artifacts',
      );
    });
  });

  it('waits rather than redirecting to a relative URL when neither origin ever resolves', () => {
    const fixture = mount({ project: 'qits', query: {}, navigation: {} });

    expect(replace).not.toHaveBeenCalled();
    // The message stays up rather than a blank page — it is the whole point of rendering anything.
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'This view moved to the landing app',
    );
  });

  it('falls back to the environment origin where the landing app has none of its own', () => {
    mount({ project: 'qits', query: {}, navigation: { origin: 'https://dev.qits.example' } });

    expect(replace).toHaveBeenCalledWith(
      'https://dev.qits.example/projects/qits/maintenance/dependencies',
    );
  });

  it('shows the destination it is about to leave for, so the line is never just a promise', () => {
    const fixture = mount({ project: 'qits', query: {}, navigation: LANDING_ORIGIN });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'https://qits.example.test/projects/qits/maintenance/dependencies',
    );
  });
});
