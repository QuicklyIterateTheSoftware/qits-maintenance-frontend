import type { QitsBadgeTone } from '@qits/ui-components';

/**
 * What colour a status word is, in one place, for every badge on every page.
 *
 * `QitsBadge` takes a *semantic* tone and never a colour, so this file is a translation between two
 * vocabularies rather than styling. Four enums share it — a repository's scan status, a branch's
 * state, a bump's outcome and an artifact's bill of materials — because they overlap and never
 * collide: `FAILED` means the same thing on a branch, on a bump and on an ingest, and no word
 * appears in two of them with two meanings. Two more used to as well: a dependent's currency,
 * retired with the repository page itself when it moved into the landing app at qits-2334; and a
 * downstream repository's adoption of a release, which shared `PENDING` with the artifact's bill
 * of materials until the adoption page moved the same way at qits-2333 — `PENDING` now belongs to
 * the bill of materials alone, meaning "nothing has happened here yet, and something is expected
 * to".
 *
 * **REQUESTED and RUNNING share the warning tone.** The reader's question is "what is still
 * happening", and a bump queued behind the worker and a bump in flight are the same answer to it.
 *
 * **STALE is a warning, not a failure.** A branch someone rewrote by hand is not broken — the
 * service simply stops pushing to it, and a person owns it now.
 *
 * **MISSING is neutral, and that is the whole point of it.** An artifact with no bill of materials
 * yet is "we cannot say" — and a red badge would read as "something is wrong here", which is a
 * different sentence.
 */
const TONES: Readonly<Record<string, QitsBadgeTone>> = {
  // A repository's last scan.
  OK: 'success',
  ABSENT: 'neutral',
  UNREACHABLE: 'danger',
  CONFIG_ERROR: 'danger',
  // A group's maintenance branch.
  NONE: 'neutral',
  PUSHED: 'info',
  STALE: 'warning',
  RELEASED: 'success',
  // A bump.
  REQUESTED: 'warning',
  RUNNING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  NOTHING_TO_DO: 'neutral',
  // An artifact's bill of materials.
  PENDING: 'warning',
  INGESTED: 'success',
  MISSING: 'neutral',
};

/**
 * The tone for a status word.
 *
 * `neutral` for a status this build has not been taught: a new enum value on the service side must
 * render as a plain grey badge rather than crash a table or silently claim success.
 */
export function toneOf(status: string): QitsBadgeTone {
  return TONES[status] ?? 'neutral';
}
