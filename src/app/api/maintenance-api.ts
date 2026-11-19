import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { QITS_API_BASE } from './api-base';
import type { AcceptedDto, AdoptionJourneyDto, BumpDto, RepositoryDto, ScanScope } from './dto';

/**
 * Everything this app says to qits-platform-maintenance, through the edge, at `/maintenance/api`.
 *
 * **Three reads and one write, and the write is the point of the application.** A scan refreshes
 * what the platform pins and what the registries hold, and answers 202: the work is accepted, not
 * finished, and every page re-reads for anything else. Asking for a group's branch by hand is gone
 * with it — `qits-1133` moved that into the `dependency-bump` release-request automation, which this
 * app has no door to and nothing here calls.
 *
 * **`adoptionByRelease` is the one read about the other direction left here.** It traces a release
 * to the end of the chain rather than one hop, out of the bills of materials the platform has
 * actually ingested. Nothing in that half is editable, and it is not polled. (The internal
 * dependency listing read the same bills of materials through `artifacts` and `artifactDependents`,
 * retired with the page itself when it moved to the landing app at qits-2330; the external
 * dependency search read the forward direction through `dependencies`, retired the same way at
 * qits-2331. One bump by id, read through `bump`, was retired the same way at qits-2332. One
 * repository's own pins, dependents and downstream closure, read through `repository`,
 * `repositoryDependents` and `downstream`, went the same way at qits-2334 — the listing `bumps`
 * reads stays, since repositories pages still poll it.)
 *
 * **Every path is relative.** The SPA is served at `/maintenance/` by the service itself, behind
 * the edge that serves `/maintenance/api/…`, so a same-origin absolute path is what lets the
 * browser's session cookie reach the service. A configured origin would move every call
 * cross-origin, leave the cookie behind, and answer 401 with nothing on screen to explain it.
 *
 * **Failures are thrown, not described.** An `HttpErrorResponse` reaching a caller still holds the
 * service's `{"message": …}` body; `ui/loadable.ts` is the one place that body is read.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(QITS_API_BASE);

  /** Every repository in the catalog, with its last scan and its groups. */
  repositories(): Promise<readonly RepositoryDto[]> {
    return firstValueFrom(
      this.http.get<RepositoryDto[]>(`${this.base}/maintenance/api/repositories`),
    );
  }

  /**
   * How far one release has travelled: who is downstream of it, and which of them have taken it.
   *
   * Both halves are query parameters rather than segments: a repository name can hold slashes and
   * colons same as a glob would, and a version is safe in a path but a repository name need not
   * be — the pair is one question, and the service answers 400 to half of it.
   *
   * **There is no 404 to handle.** The answer is derived from the dependency graph rather than read
   * out of a record that a release was tracked, so a release this service has never seen answers
   * with no packages and a wholly pending closure. The one status a caller must still expect is the
   * ordinary failure of a service that is down.
   */
  adoptionByRelease(repository: string, version: string): Promise<AdoptionJourneyDto> {
    return firstValueFrom(
      this.http.get<AdoptionJourneyDto>(`${this.base}/maintenance/api/adoption/by-release`, {
        params: new HttpParams().set('repository', repository).set('version', version),
      }),
    );
  }

  /**
   * Rescan the catalog and refresh the latest versions.
   *
   * `repository` narrows it to one; leaving it out is the whole platform, which is what the two
   * header buttons do. The service queues this on its one worker, so a second press while one is
   * running is a second queued scan rather than an interleaving.
   */
  startScan(scope: ScanScope, repository?: string): Promise<AcceptedDto> {
    const body = repository ? { scope, repository } : { scope };
    return firstValueFrom(this.http.post<AcceptedDto>(`${this.base}/maintenance/api/scans`, body));
  }

  /**
   * Recent bumps, newest first, for one repository or for all of them.
   *
   * The order is the SERVICE's and is not re-sorted here: a client sorting by `startedAt` would
   * disagree with it the moment two bumps share an instant, and the list would reorder itself under
   * the reader's cursor on the next poll.
   */
  bumps(repository?: string, limit = 20): Promise<readonly BumpDto[]> {
    let params = new HttpParams().set('limit', limit);
    if (repository) {
      params = params.set('repository', repository);
    }
    return firstValueFrom(
      this.http.get<BumpDto[]>(`${this.base}/maintenance/api/bumps`, { params }),
    );
  }
}
