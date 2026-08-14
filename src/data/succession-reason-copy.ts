import type { SuccessionReason } from "../colony/meta/meta-progress";

/** Title for the succession (pupa) modal */
export const successionModalTitle = "Is it time for a new queen?";

/** Context shown under the title in the succession modal */
export const successionModalContext: Record<SuccessionReason, string> = {
  hiveExpanded: "The hive has grown strong.",
  queenStarved: "The previous queen was lost to hunger.",
  queenAgedOut: "Another year has ended.",
  queenDiedOther: "The previous queen was lost.",
};

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
