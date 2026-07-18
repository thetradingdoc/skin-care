/**
 * Absent-field copy for confirm / manual TemplateFieldsForm.
 * Document tags (rx/lab/bill) may say "not found in document."
 * Photo tags (skin/mark) and other never use document-extraction language.
 */

export function absentFieldAffordance(tag: string, fieldKey: string): string {
  const t = tag === 'rx' ? 'prescription' : String(tag || '');
  if (t === 'skin') {
    if (fieldKey === 'body_area') return 'which area is this? — tap to enter';
    return 'tap to enter';
  }
  if (t === 'mark') {
    if (fieldKey === 'body_location') return 'where on the body? — tap to enter';
    return 'tap to enter';
  }
  if (t === 'other') return 'tap to enter';
  // bill | prescription | lab — document extraction
  return 'not found in document — tap to enter';
}
