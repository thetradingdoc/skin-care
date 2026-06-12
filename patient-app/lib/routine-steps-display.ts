import type { StepState } from '@/components/conflict/RoutineStepRow';
import type { RoutineStepState } from '@/lib/conflict-types';

export type PhaseItem = {
  product_name?: string;
  usage_time?: string;
  goal?: string;
};

export type DisplayRoutineStep = {
  label: string;
  sub?: string;
  state: StepState;
  usage_time?: string;
  product_name?: string;
};

function normTime(t?: string): string {
  return String(t || '').toLowerCase();
}

function stepKey(productName?: string, usageTime?: string): string {
  return `${normTime(usageTime)}::${String(productName || '').trim().toLowerCase()}`;
}

function toRowState(state: RoutineStepState['state']): StepState {
  if (state === 'warn' || state === 'skip') return 'warn';
  if (state === 'done') return 'done';
  return 'todo';
}

export function findEvaluateState(
  states: RoutineStepState[] | undefined,
  item: PhaseItem,
): RoutineStepState | undefined {
  if (!states?.length) return undefined;
  const key = stepKey(item.product_name, item.usage_time);
  return states.find((s) => stepKey(s.product_name || s.label, s.usage_time) === key);
}

export function buildGroupedRoutineSteps(
  phaseItems: PhaseItem[],
  evaluateStates?: RoutineStepState[],
): { am: DisplayRoutineStep[]; pm: DisplayRoutineStep[]; other: DisplayRoutineStep[] } {
  const am: DisplayRoutineStep[] = [];
  const pm: DisplayRoutineStep[] = [];
  const other: DisplayRoutineStep[] = [];

  phaseItems.forEach((item, i) => {
    const evalState = findEvaluateState(evaluateStates, item);
    const row: DisplayRoutineStep = evalState
      ? {
          label: evalState.label,
          sub: evalState.sub,
          state: toRowState(evalState.state),
          usage_time: evalState.usage_time || item.usage_time,
          product_name: evalState.product_name || item.product_name,
        }
      : {
          label: item.product_name || item.usage_time || `Step ${i + 1}`,
          sub: item.goal || (item.usage_time ? String(item.usage_time).toUpperCase() : undefined),
          state: 'todo',
          usage_time: item.usage_time,
          product_name: item.product_name,
        };

    const t = normTime(item.usage_time);
    if (t === 'am') am.push(row);
    else if (t === 'pm') pm.push(row);
    else other.push(row);
  });

  return { am, pm, other };
}
