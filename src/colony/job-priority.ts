/** Higher number runs first in {@link JobAssignmentSystem}. */
export const JobPriority = {
  adultFeed: 95,
  waterDeliver: 90,
  feedLarvae: 85,
  cleanBrood: 80,
  layEgg: 75,
  build: 65,
  honeyProcess: 55,
  foragePollen: 45,
  forageNectar: 44,
  forageWater: 43,
} as const;
