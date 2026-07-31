import type { Gender, PalmScanHand } from '@/store/sessionStore';

/**
 * Traditional palmistry hand for a reading:
 * male → right (active), female → left (active).
 */
export function palmHandForGender(gender?: Gender | null): PalmScanHand {
  if (gender === 'female') return 'left';
  return 'right';
}

/** Male/female hands are fixed once gender is set. */
export function isPalmHandLockedByGender(gender?: Gender | null): boolean {
  return gender === 'male' || gender === 'female';
}

export function palmHandGuidanceLabel(hand: PalmScanHand, gender?: Gender | null): string {
  if (gender === 'male') return 'Right palm (traditional for men)';
  if (gender === 'female') return 'Left palm (traditional for women)';
  return hand === 'left' ? 'Left palm' : 'Right palm';
}
