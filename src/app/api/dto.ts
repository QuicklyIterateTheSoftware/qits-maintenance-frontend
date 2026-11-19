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

/** How many pins a bump moves — zero for a row the listing sent without its changes. */
export function changeCount(bump: BumpDto): number {
  return bump.changes?.length ?? 0;
}
