import { patientGet, patientPatch, patientPost } from '@/lib/patient-api';

export type PatientGoal = {
  id: string;
  goal_type: 'watch_spot' | 'improve_routine' | 'reduce_conflicts';
  target_ref?: string | null;
  status: 'active' | 'completed' | 'dismissed';
  source?: string;
};

export async function fetchGoals(status = 'active'): Promise<PatientGoal[]> {
  const data = await patientGet(`/api/patient/goals?status=${encodeURIComponent(status)}`);
  return Array.isArray(data?.goals) ? data.goals : [];
}

export async function dismissGoal(goalId: string): Promise<PatientGoal | null> {
  const data = await patientPatch(`/api/patient/goals/${encodeURIComponent(goalId)}`, {
    status: 'dismissed',
  });
  return data?.goal ?? null;
}

export async function createGoal(
  goalType: PatientGoal['goal_type'],
  targetRef?: string | null,
): Promise<PatientGoal | null> {
  const data = await patientPost('/api/patient/goals', {
    goal_type: goalType,
    target_ref: targetRef ?? null,
    source: 'user',
  });
  return data?.goal ?? null;
}

export function goalLabel(goalType: PatientGoal['goal_type']): string {
  switch (goalType) {
    case 'watch_spot':
      return 'Track a spot over time';
    case 'improve_routine':
      return 'Improve my routine';
    case 'reduce_conflicts':
      return 'Reduce product conflicts';
    default:
      return 'Skin goal';
  }
}
