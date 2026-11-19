import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MaintenanceApi } from './maintenance-api';

/**
 * The three calls, at the addresses qits-platform-maintenance serves them at.
 *
 * The assertions worth having are the ones that are invisible on screen when they are wrong:
 * **every path is relative**, because a configured origin would leave the edge's session cookie
 * behind and turn every read into a 401; **the verb is right**, because the one POST here starts
 * real work and a GET that should have been a POST fails silently as a 405; and **a failure reaches
 * the caller whole**, because the pages draw the service's own sentence from it.
 */
describe('MaintenanceApi', () => {
  let api: MaintenanceApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MaintenanceApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the repositories at a relative path, as a bare array', async () => {
    const repositories = api.repositories();

    const request = http.expectOne('/maintenance/api/repositories');
    expect(request.request.method).toBe('GET');
    request.flush([{ name: 'qits-ci', pending: 2, groups: [] }]);

    expect((await repositories).map((repository) => repository.name)).toEqual(['qits-ci']);
  });

  it('starts a scan with a POST carrying the scope, and nothing else', async () => {
    const scan = api.startScan('INTERNAL');

    const request = http.expectOne('/maintenance/api/scans');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ scope: 'INTERNAL' });
    request.flush({ id: 'scan-1' }, { status: 202, statusText: 'Accepted' });

    expect((await scan).id).toBe('scan-1');
  });

  it('names a repository in the scan body only when one was asked for', async () => {
    const scan = api.startScan('ALL', 'qits-ci');

    const request = http.expectOne('/maintenance/api/scans');
    expect(request.request.body).toEqual({ scope: 'ALL', repository: 'qits-ci' });
    request.flush({ id: 'scan-2' }, { status: 202, statusText: 'Accepted' });
    await scan;
  });

  it('lists the bumps for one repository, and for all of them', async () => {
    const mine = api.bumps('qits-ci');
    const listing = http.expectOne((candidate) => candidate.url === '/maintenance/api/bumps');
    expect(listing.request.params.get('repository')).toBe('qits-ci');
    expect(listing.request.params.get('limit')).toBe('20');
    listing.flush([]);
    await mine;

    const all = api.bumps();
    const every = http.expectOne((candidate) => candidate.url === '/maintenance/api/bumps');
    expect(every.request.params.has('repository')).toBe(false);
    every.flush([]);
    await all;
  });

  it('rejects with the service’s own message rather than swallowing it', async () => {
    const repositories = api.repositories();

    http
      .expectOne('/maintenance/api/repositories')
      .flush({ message: 'no' }, { status: 503, statusText: 'Service Unavailable' });

    await expect(repositories).rejects.toMatchObject({ status: 503, error: { message: 'no' } });
  });
});
