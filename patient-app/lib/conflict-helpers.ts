import { ConflictTokens } from '@/constants/conflictTokens';
import type { VerdictOverall } from '@/lib/conflict-types';

export function bfiColor(bfi: number): string {
  if (bfi >= 80) return ConflictTokens.barrierGreat;
  if (bfi >= 60) return ConflictTokens.barrierOk;
  return ConflictTokens.barrierWarn;
}

export function overallColor(overall: VerdictOverall): string {
  if (overall === 'hard_no' || overall === 'avoid') return ConflictTokens.barrierWarn;
  if (overall === 'caution') return ConflictTokens.barrierOk;
  return ConflictTokens.barrierGreat;
}

export function scoreCardBg(overall: VerdictOverall): string {
  if (overall === 'hard_no' || overall === 'avoid') return ConflictTokens.cardRed;
  if (overall === 'caution') return ConflictTokens.cardAmber;
  return ConflictTokens.cardGreen;
}

export function barrierLabel(bfi: number): string {
  if (bfi >= 80) return 'Barrier looking strong';
  if (bfi >= 60) return 'Barrier under mild stress';
  return 'Barrier under stress';
}

export function productPillLabel(status: string): string {
  if (status === 'hard_no') return 'Hard no';
  if (status === 'conflict') return 'Conflict';
  if (status === 'watch') return 'pH watch';
  if (status === 'safe') return 'Safe';
  return 'Unknown';
}

export function productPillColors(status: string): { bg: string; text: string } {
  if (status === 'hard_no' || status === 'conflict') {
    return { bg: ConflictTokens.cardRed, text: ConflictTokens.cardRedText };
  }
  if (status === 'watch') return { bg: ConflictTokens.cardAmber, text: ConflictTokens.cardAmberText };
  if (status === 'safe') return { bg: ConflictTokens.cardGreen, text: ConflictTokens.cardGreenText };
  return { bg: '#F3F4F6', text: '#6B7280' };
}

export function gridCellColor(bfi: number | null): string {
  if (bfi == null) return '#E5E7EB';
  if (bfi >= 80) return ConflictTokens.barrierGreat;
  if (bfi >= 60) return ConflictTokens.barrierOk;
  return ConflictTokens.barrierWarn;
}

export function verdictTagColor(overall: VerdictOverall | null | undefined): string {
  if (overall === 'hard_no' || overall === 'avoid') return 'rgba(163,45,45,0.85)';
  if (overall === 'caution') return 'rgba(239,159,39,0.85)';
  return 'rgba(29,158,117,0.85)';
}
