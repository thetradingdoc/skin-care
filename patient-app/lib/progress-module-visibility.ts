/**
 * Progress module visibility (pure) — T9-billonly skin hide rule.
 * Keep free of patient-api / RN imports so unit tests stay light.
 */

export type ProgressModuleAggregates = {
  skin?: unknown;
  bill?: unknown;
  rx?: unknown;
  mark?: unknown;
};

/**
 * T9-billonly: skin module is hidden (not empty shell) when aggregates omit skin.
 * Backend only includes `skin` when skin facts exist (P5.09).
 */
export function progressShowsSkinModule(
  aggregates: ProgressModuleAggregates | null | undefined,
): boolean {
  return Boolean(aggregates?.skin);
}

export function progressShowsBillModule(
  aggregates: ProgressModuleAggregates | null | undefined,
): boolean {
  return Boolean(aggregates?.bill);
}
