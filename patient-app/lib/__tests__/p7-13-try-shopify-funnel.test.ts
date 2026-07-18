/**
 * P7.13 — Try-* Shopify money funnel regression (adversarial).
 *
 * Locked path: Shopify/consumer join → try-handoff → try-verdict → try-allergens
 * → try-reveal → Save & continue (sign-in). This must keep making money while the
 * medical-tracker IA (tabs / capture / Progress) rebuilt around it.
 *
 * Bar: same as Phase 6 webhook idempotency — fail if the chain is rewired, stolen
 * by Progress/capture, or false-safe reveal mapping regresses.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  assertTryEvaluateReadyForReveal,
  mapTryRevealPrimary,
  nextTryFunnelStep,
  TRY_FUNNEL_HREFS,
  TRY_FUNNEL_STEPS,
  tryFunnelHref,
} from '@/lib/try-funnel-path';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');
const REPO = join(ROOT, '..');

describe('P7.13 try-* Shopify funnel end-to-end', () => {
  it('locks try-verdict → allergens → reveal → handoff chain (and sign-in exit)', () => {
    expect([...TRY_FUNNEL_STEPS]).toEqual([
      'handoff',
      'verdict',
      'allergens',
      'reveal',
      'sign_in',
    ]);
    expect(nextTryFunnelStep('handoff')).toBe('verdict');
    expect(nextTryFunnelStep('verdict')).toBe('allergens');
    expect(nextTryFunnelStep('allergens')).toBe('reveal');
    expect(nextTryFunnelStep('reveal')).toBe('sign_in');
    expect(nextTryFunnelStep('sign_in')).toBeNull();

    expect(tryFunnelHref('handoff')).toBe('/try-handoff');
    expect(tryFunnelHref('verdict')).toBe('/try-verdict');
    expect(tryFunnelHref('allergens')).toBe('/try-allergens');
    expect(tryFunnelHref('reveal')).toBe('/try-reveal');
    expect(tryFunnelHref('sign_in')).toBe('/sign-in');
    expect(TRY_FUNNEL_HREFS.verdict).toBe('/try-verdict');
  });

  it('each screen still wires the next hop — medical IA must not steal the funnel', () => {
    for (const name of ['try-handoff', 'try-verdict', 'try-allergens', 'try-reveal'] as const) {
      expect(existsSync(join(APP, `${name}.tsx`)), name).toBe(true);
    }

    const handoff = readFileSync(join(APP, 'try-handoff.tsx'), 'utf8');
    expect(handoff).toMatch(/TRY_VERDICT_HREF/);
    expect(handoff).toMatch(/try-handoff/);
    expect(handoff).not.toMatch(/PROGRESS_HREF|CAPTURE_2A_HREF|\/\(tabs\)\/progress/);

    const verdict = readFileSync(join(APP, 'try-verdict.tsx'), 'utf8');
    expect(verdict).toMatch(/TRY_ALLERGENS_HREF/);
    expect(verdict).toMatch(/setPendingTryProduct/);
    expect(verdict).toMatch(/try-verdict-cta/);
    expect(verdict).not.toMatch(/PROGRESS_HREF|CAPTURE_2A_HREF/);

    const allergens = readFileSync(join(APP, 'try-allergens.tsx'), 'utf8');
    expect(allergens).toMatch(/TRY_REVEAL_HREF/);
    expect(allergens).toMatch(/publicEvaluateProducts/);
    expect(allergens).toMatch(/setTryRevealPayload/);
    expect(allergens).toMatch(/getPendingTryProduct/);
    // Failed evaluate must never stash a reveal payload
    expect(allergens).toMatch(/verdict\.success === false/);
    expect(allergens).toMatch(/!verdict\.overall/);
    expect(allergens).not.toMatch(/PROGRESS_HREF|CAPTURE_2A_HREF/);

    const reveal = readFileSync(join(APP, 'try-reveal.tsx'), 'utf8');
    expect(reveal).toMatch(/SIGN_IN_HREF/);
    expect(reveal).toMatch(/reveal-save-cta/);
    expect(reveal).toMatch(/export function mapPrimary/);
    expect(reveal).toMatch(/never.*[Ss]afe|NEVER.*Safe|never render as Safe/);
    expect(reveal).not.toMatch(/PROGRESS_HREF|CAPTURE_2A_HREF/);
  });

  it('false-safe mapPrimary never promotes evaluate failure / unknown to Safe', () => {
    expect(mapTryRevealPrimary({ success: false, error: 'products_required' })).toBe('error');
    expect(mapTryRevealPrimary({ overall: 'unknown' })).toBe('error');
    expect(mapTryRevealPrimary({})).toBe('error');
    expect(mapTryRevealPrimary(null)).toBe('error');
    expect(mapTryRevealPrimary({ message: 'looks fine' })).toBe('error');
    expect(mapTryRevealPrimary({ success: true, overall: 'safe' })).toBe('safe');
    expect(mapTryRevealPrimary({ success: true, overall: 'caution' })).toBe('caution');
    expect(mapTryRevealPrimary({ success: true, overall: 'hard_no', hard_no: true })).toBe(
      'hard_no',
    );
    expect(mapTryRevealPrimary({ overall: 'avoid' })).toBe('hard_no');

    // Must stay in sync with try-reveal.tsx export (adversarial drift check)
    const reveal = readFileSync(join(APP, 'try-reveal.tsx'), 'utf8');
    expect(reveal).toMatch(/if \(overall === 'safe'\) return 'safe'/);
    expect(reveal).toMatch(/if \(!overall \|\| overall === 'unknown'\) return 'error'/);
  });

  it('evaluate gate: failed/ambiguous verdict never ready for reveal stash', () => {
    expect(assertTryEvaluateReadyForReveal(null).ok).toBe(false);
    expect(assertTryEvaluateReadyForReveal({ success: false }).ok).toBe(false);
    expect(assertTryEvaluateReadyForReveal({ success: true }).ok).toBe(false);
    expect(assertTryEvaluateReadyForReveal({ success: true, overall: 'unknown' }).ok).toBe(false);
    expect(assertTryEvaluateReadyForReveal({ success: true, overall: 'safe' }).ok).toBe(true);
    expect(assertTryEvaluateReadyForReveal({ overall: 'hard_no' }).ok).toBe(true);
  });

  it('Shopify/consumer entry still lands on try-handoff / try-verdict — not face-age or Progress', () => {
    const register = readFileSync(
      join(REPO, 'middleware-platform/bootstrap/register-patient-routes.js'),
      'utf8',
    );
    expect(register).toMatch(/\/app\/try-handoff/);
    expect(register).toMatch(/\/app\/try-verdict/);
    expect(register).toMatch(/never default to face-age/);

    const server = readFileSync(join(REPO, 'middleware-platform/server.js'), 'utf8');
    expect(server).toMatch(/redirectToPatientTry|\/app\/try-verdict/);
    expect(server).toMatch(/Funnel signup \/ join CTAs → try-verdict/);

    const layout = readFileSync(join(APP, '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/name="try-verdict"/);
    expect(layout).toMatch(/name="try-allergens"/);
    expect(layout).toMatch(/name="try-reveal"/);
    expect(layout).toMatch(/name="try-handoff"/);

    const index = readFileSync(join(APP, 'index.tsx'), 'utf8');
    // Cold start is Welcome; failsafe must not steal marketing deep links (incl. try-verdict).
    expect(index).toMatch(/WELCOME_HREF/);
    expect(index).not.toMatch(/TRY_VERDICT_HREF/);
    expect(index).toMatch(/Never steal those URLs to Welcome/);
    expect(index).toMatch(/never face-age/);

    const gate = readFileSync(join(ROOT, 'hooks/useOnboardingGate.ts'), 'utf8');
    expect(gate).toMatch(/WELCOME_HREF/);
    expect(gate).not.toMatch(/return TRY_VERDICT_HREF/);

    const routes = readFileSync(join(ROOT, 'constants/routes.ts'), 'utf8');
    expect(routes).toMatch(/TRY_VERDICT_HREF = '\/try-verdict'/);
    expect(routes).toMatch(/WELCOME_HREF = '\/welcome'/);
    expect(routes).toMatch(/TRY_HANDOFF_HREF = '\/try-handoff'/);
    expect(routes).toMatch(/TRY_ALLERGENS_HREF = '\/try-allergens'/);
    expect(routes).toMatch(/TRY_REVEAL_HREF = '\/try-reveal'/);
  });

  it('session keys for product/allergens/reveal payload still named for OTP claim handoff', () => {
    const session = readFileSync(join(ROOT, 'lib/try-verdict-session.ts'), 'utf8');
    expect(session).toMatch(/touche_try_pending_product/);
    expect(session).toMatch(/touche_try_pending_allergens/);
    expect(session).toMatch(/setPendingTryProduct/);
    expect(session).toMatch(/setPendingAllergens/);

    const revealStore = readFileSync(join(ROOT, 'lib/try-reveal-store.ts'), 'utf8');
    expect(revealStore).toMatch(/touche_try_reveal_payload/);
    expect(revealStore).toMatch(/setTryRevealPayload/);
  });
});
