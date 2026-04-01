import type { SuccessionReason } from "../colony/meta/meta-progress";

/** Short labels for lineage connectors and cards */
export const successionReasonShortLabel: Record<SuccessionReason, string> = {
  hiveExpanded: "Hive swarmed",
  queenStarved: "Queen lost to hunger",
  queenAgedOut: "Reign ended",
  queenDiedOther: "Previous queen lost",
};

/** Longer description where space allows */
export const successionReasonDescription: Record<SuccessionReason, string> = {
  hiveExpanded: "The colony chose a new queen.",
  queenStarved: "The previous queen was lost to hunger.",
  queenAgedOut: "The previous queen’s reign ended.",
  queenDiedOther: "The previous queen was lost.",
};
