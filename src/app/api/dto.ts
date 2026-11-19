/**
 * What qits-platform-maintenance answers, spelled as the pinned contract spells it
 * (`qits-maintenance-plan.md`, "API").
 *
 * **The reads are bare JSON, not envelopes.** The contract writes
 * `GET /repositories → [{name, …}]`, so an array is what arrives and an array is what this app
 * parses. Several sibling explorers unwrap a `{items: […]}` wrapper; this one does not, and a
 * service that grew one would break these pages silently — which is why the API spec asserts the
 * shape rather than trusting it.
 *
 * **A widened enum must not break a page.** Every status here is a union for the compiler's sake,
 * and every place that colours one falls back to neutral for a word this build has not been taught.
 */

/** How the last scan of a repository ended. */
export type RepositoryStatus = 'OK' | 'ABSENT' | 'UNREACHABLE' | 'CONFIG_ERROR';

/** Where a group's maintenance branch stands. `STALE` means someone rewrote it by hand. */
export type BranchState = 'NONE' | 'PUSHED' | 'STALE' | 'RELEASED' | 'FAILED';

/** A bump's outcome. `NOTHING_TO_DO` is a success with no commit behind it. */
export type BumpStatus = 'REQUESTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'NOTHING_TO_DO';

/**
 * What asked for a bump: the service's own cron, or a person pressing the button this page used to
 * offer. `qits-1133` retired that button — a group's pending changes now move through the
 * `dependency-bump` release-request automation instead — so `MANUAL` is only ever a historical row
 * from before the cutover, never a fresh one.
 */
export type BumpTrigger = 'SCHEDULED' | 'MANUAL';

/** How much of the inventory a scan refreshes. */
export type ScanScope = 'INTERNAL' | 'EXTERNAL' | 'ALL';

/**
 * Which half of the inventory something belongs to — the one distinction this application is
 * organised around.
 *
 * Internal is what the platform publishes and can release; external is what the world publishes and
 * qits-platform-mirror caches. A screen answers one of those questions at a time, because the two
 * have different readers: "what of ours is stale here" is a release question, "what of the world's
 * is stale here" is a patching one.
 */
export type InventorySection = 'INTERNAL' | 'EXTERNAL';

/** Whether the repository asked for a grouping, or was given the fallback one. */
export type GroupSource = 'CONFIG' | 'DEFAULT';

/**
 * Whether a downstream repository has taken a release yet.
 *
 * **Two words and no third one.** `ADOPTED` means one of that repository's own releases carries a
 * version of the subject at least as new as the one asked about; `PENDING` means none does — which
 * includes the repository that has not been released since, the one whose bill of materials has not
 * been ingested, and the one nothing can be said about. A `PENDING` row is not a failure and is
 * never drawn as one: it is the ordinary state of a downstream repository an hour after a release.
 *
 * The service evaluates this per request against the bills of materials it holds, so a row can move
 * from `PENDING` to `ADOPTED` between two reads of this page and never the other way.
 */
export type AdoptionState = 'ADOPTED' | 'PENDING';

/**
 * One maintenance group of a repository, and the branch it bumps on.
 *
 * `kind` and `source` are two different questions. `source` says whether the repository asked for
 * this grouping; `kind` says HOW it claims — by the pins' kind, or by globs the repository wrote.
 * A configured group claims by globs and so names no kind, which is why `kind` is nullable and why
 * `groupSection` — not a bare comparison — is what decides which screen shows it.
 */
export interface GroupDto {
  readonly name: string;
  readonly source?: GroupSource | null;
  readonly kind?: InventorySection | null;
  readonly branch: string;
  readonly state: BranchState;
  readonly headSha?: string | null;
  readonly pending: number;
}

/**
 * Which section a group is drawn under.
 *
 * A group that names no kind claims by globs of its own, and there is no honest way to sort it into
 * one world — so it is shown with the internal side, where the platform's own releases are, rather
 * than being hidden from both. The same fallback covers a `kind` this build has not been taught.
 */
export function groupSection(group: GroupDto): InventorySection {
  return group.kind === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL';
}

/** A repository as the overview lists it: the last scan, and what is waiting to move. */
export interface RepositoryDto {
  readonly name: string;
  /** The project that owns it in the catalog, or null for a repository no project claims. */
  readonly project?: string | null;
  readonly lastScanAt: string | null;
  /** The commit the pins below were read at, or null when nothing has been read yet. */
  readonly headSha?: string | null;
  readonly status: RepositoryStatus;
  readonly message: string | null;
  readonly pending: number;
  readonly groups: readonly GroupDto[];
}

/** One line of a bump: the pin it moves, and where that pin is written. */
export interface BumpChangeDto {
  readonly ecosystem: string;
  readonly manifestPath: string;
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly location: string;
}

/**
 * A bump: the branch a group's pending changes were asked to land on, and how that went.
 *
 * `branch` is optional because the contract's row does not name it; where it is absent the branch
 * is `maintenance/<group>`, which is the one the service derives from the group anyway.
 *
 * `changes` is optional for a duller reason: the listing may leave it out to keep its rows small,
 * and a page that counted it blind would break on the day it does.
 *
 * `releaseRequestId` is what qits-projects answered when the branch was offered for release. It is
 * the id of an OPEN release request — the gates settle it and Auto Release tags it afterwards — or
 * one of two sentinel words the service writes in its place, or null for a bump that never got that
 * far.
 */
export interface BumpDto {
  readonly id: string;
  readonly repository: string;
  readonly group: string;
  readonly branch?: string | null;
  readonly environment: string | null;
  readonly trigger: BumpTrigger;
  readonly ciEventId: string | null;
  readonly ciRunId: string | null;
  /** Every run this bump started, newest last — `ciRunId` is the one a reader is sent to. */
  readonly ciRunIds?: readonly string[] | null;
  /** The CI configuration the run was read from. */
  readonly configPath?: string | null;
  /** The run's own status, which is qits-ci's word and not this service's. */
  readonly ciRunStatus?: string | null;
  readonly status: BumpStatus;
  readonly changes?: readonly BumpChangeDto[];
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly message: string | null;
  readonly releaseRequestId: string | null;
  /**
   * What qits-projects last said about that request — `PENDING`, `READY`, `RELEASED`,
   * `FINALIZED`, `OBSOLETE`, `WITHDRAWN`, `REJECTED`, `FAILED`, `CONFLICTED` — or null on a bump
   * nothing has asked about.
   *
   * **It is why a repository can be pending with nothing being built.** A bump writes a branch and
   * main does not move until the release lands, so the dispatcher holds the repository until it
   * does; a request that was REJECTED is one that is never landing, and until this field existed
   * that was invisible from every screen.
   */
  readonly releaseState?: string | null;
  /** qits-projects' own sentence about it — usually the gating run that went red. */
  readonly releaseDetail?: string | null;
  /** When the two above were read. */
  readonly releaseStateAt?: string | null;
}

/** What a 202 carries: the id of the work that was accepted, and nothing else. */
export interface AcceptedDto {
  readonly id: string;
}

/** A bump that has stopped. Only the other two are worth polling. */
export function isBumpTerminal(status: BumpStatus): boolean {
  return status !== 'REQUESTED' && status !== 'RUNNING';
}

/** One thing a release published, which is what the repositories below it pin. */
export interface AdoptionPackageDto {
  readonly ecosystem: string;
  readonly name: string;
}

/**
 * One repository downstream of a release, and whether it has taken it.
 *
 * **Every adopter IS a repository**, unlike the consumers of the release trains this replaced:
 * the closure is traced over the inventory, so there is no application-named end. `repositoryStatus`
 * is the catalog's word about it — `ABSENT` for one that left the catalog — and null where the
 * inventory holds no row at all, which is the one case a link to a repository page is not drawn.
 *
 * `adoptedVersion` is that repository's OWN release that first carried a new-enough copy of the
 * subject, and `adoptedAt` is when that release happened; both are null while the state is
 * `PENDING`.
 *
 * **`via` names the PARENTS at `depth - 1` — all of them, name-ascending — and never a path.** Two
 * upstreams can both lead to one repository (a service that pins a library directly AND submodules
 * a frontend carrying it), and `DownstreamResolver` collects every one of them; at depth 1 the sole
 * parent is the subject repository itself. That is what a `PENDING` adopter is read with — a
 * repository three hops down is waiting on the ones above it, not on this release — and it is why
 * the journey is drawn as a graph with one card per repository and an edge in from each parent,
 * rather than as a tree that would have to copy the repository under each of them.
 */
export interface AdopterDto {
  readonly repository: string;
  readonly catalogId: string | null;
  readonly repositoryStatus: RepositoryStatus | null;
  readonly archetype: string | null;
  readonly depth: number;
  readonly via: readonly string[];
  readonly state: AdoptionState;
  readonly adoptedVersion: string | null;
  readonly adoptedAt: string | null;
}

/**
 * One release, and how far it has travelled — `GET /adoption/by-release?repository=&version=`.
 *
 * **The whole journey arrives in one answer.** The service folds the closure and the adoption of
 * every step of it per request; there is nothing to stitch here and nothing to follow. That is a
 * change from the release trains this replaced, where the client walked a train per consumer.
 *
 * **There is no 404.** A release the log knows nothing about answers with empty `packages` and
 * whatever the closure says, every row `PENDING` — because the question is asked of the dependency
 * graph rather than of a record that a release was tracked.
 */
export interface AdoptionJourneyDto {
  readonly repository: string;
  readonly catalogId: string | null;
  readonly version: string;
  readonly packages: readonly AdoptionPackageDto[];
  readonly adopters: readonly AdopterDto[];
}
