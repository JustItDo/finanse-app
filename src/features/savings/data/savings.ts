export type SavingsStatus = 'no_goal' | 'behind_plan' | 'goal_met';

export type SavingsProgress = {
  currentSavingsMinor: number;
  goalMinor: number | null;
  remainingMinor: number | null;
  progressRatio: number | null;
  progressPercent: number | null;
  status: SavingsStatus;
};

export function buildSavingsProgress(
  currentSavingsMinor: number,
  goalMinor: number | null,
): SavingsProgress {
  if (goalMinor === null || goalMinor <= 0) {
    return {
      currentSavingsMinor,
      goalMinor: null,
      progressPercent: null,
      progressRatio: null,
      remainingMinor: null,
      status: 'no_goal',
    };
  }

  const remainingMinor = goalMinor - currentSavingsMinor;
  const rawRatio = currentSavingsMinor / goalMinor;
  const progressRatio = Math.max(0, rawRatio);
  const progressPercent = Math.max(0, Math.round(progressRatio * 100));

  return {
    currentSavingsMinor,
    goalMinor,
    progressPercent,
    progressRatio,
    remainingMinor,
    status: currentSavingsMinor >= goalMinor ? 'goal_met' : 'behind_plan',
  };
}
