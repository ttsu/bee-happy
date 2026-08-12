/** Higher number runs first in {@link JobAssignmentSystem}. */
export const JobPriority = {
  adultFeed: 95,
  feedQueen: 94,
  feedLarvae: 85,
  cleanBrood: 80,
  layEgg: 75,
  build: 65,
  clearCellForRetype: 58,
  honeyProcess: 55,
  guardHive: 52,
  foragePollen: 45,
  forageNectar: 44,
} as const;
