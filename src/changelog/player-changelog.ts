import { z } from "zod";
import changelogRaw from "../data/player-changelog.json";

const releaseEntrySchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  title: z.string().optional(),
  items: z.array(z.string()),
});

export const playerChangelogSchema = z
  .object({
    currentReleaseId: z.string(),
    /** Git short hash at publish time; used by the draft changelog Cursor command for default diff range. */
    asOfCommit: z.string().optional(),
    releases: z.array(releaseEntrySchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.releases[0].id !== data.currentReleaseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "releases[0].id must equal currentReleaseId (releases are newest-first)",
        path: ["releases", 0, "id"],
      });
    }
  });

export type PlayerReleaseEntry = z.infer<typeof releaseEntrySchema>;

export const playerChangelog = playerChangelogSchema.parse(changelogRaw);

export const CURRENT_RELEASE_ID = playerChangelog.currentReleaseId;

/**
 * Compares two semver-like release ids (`major.minor.patch` numeric segments).
 *
 * @returns negative if `a` &lt; `b`, zero if equal, positive if `a` &gt; `b`
 */
export const compareReleaseId = (a: string, b: string): number => {
  const parse = (s: string): number[] =>
    s.split(".").map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) {
      return da < db ? -1 : 1;
    }
  }
  return 0;
};

/**
 * Returns releases newer than `lastSeenReleaseId`, newest first, capped for UI.
 */
export const getUnseenReleases = (
  lastSeenReleaseId: string | null,
  cap = 3,
): PlayerReleaseEntry[] => {
  if (lastSeenReleaseId === null) {
    return [];
  }
  const unseen = playerChangelog.releases.filter(
    (r) => compareReleaseId(lastSeenReleaseId, r.id) < 0,
  );
  return unseen.slice(0, cap);
};

/**
 * Whether to show What’s new: returning players only (`lastSeen` already set) behind current release.
 */
export const shouldShowWhatsNew = (lastSeenReleaseId: string | null): boolean => {
  if (lastSeenReleaseId === null) {
    return false;
  }
  return compareReleaseId(lastSeenReleaseId, CURRENT_RELEASE_ID) < 0;
};
