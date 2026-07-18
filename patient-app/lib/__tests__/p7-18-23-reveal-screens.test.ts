/**
 * P7.18–P7.23 — Six separate per-tag reveal screens (v10 copy).
 * Rejects a single tag-conditional template (v9 Thesis failure mode).
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REVEAL_DIR = join(__dirname, '../../app/capture/reveal');

const TAGS = ['skin', 'bill', 'rx', 'mark', 'lab', 'other'] as const;

describe('P7.18–23 per-tag reveal screens (separate files)', () => {
  it('each tag has its own screen file (not one switch template)', () => {
    for (const tag of TAGS) {
      const file = join(REVEAL_DIR, `${tag}.tsx`);
      expect(existsSync(file), file).toBe(true);
    }
    const files = readdirSync(REVEAL_DIR).filter((f) => f.endsWith('.tsx'));
    expect(files).toEqual(
      expect.arrayContaining([
        'skin.tsx',
        'bill.tsx',
        'rx.tsx',
        'mark.tsx',
        'lab.tsx',
        'other.tsx',
        '_layout.tsx',
      ]),
    );
    // No shared tag-router screen
    expect(files.some((f) => /\[tag\]|RevealByTag|reveal-template/i.test(f))).toBe(false);
  });

  it('P7.18 skin uses pending-confirm framing, not asserted finding', () => {
    const src = readFileSync(join(REVEAL_DIR, 'skin.tsx'), 'utf8');
    expect(src).toMatch(/P7\.18/);
    expect(src).toMatch(/does that match what you see\?/);
    expect(src).toMatch(/pending confirm|not asserted/i);
    expect(src).toMatch(/Yes, that's right/);
    expect(src).toMatch(/Not quite — let me fix it/);
    expect(src).not.toMatch(/Here's what we found/);
    expect(src).not.toMatch(/switch\s*\(\s*tag/);
  });

  it('P7.19 bill reveal owns Saved — amount to provider copy', () => {
    const src = readFileSync(join(REVEAL_DIR, 'bill.tsx'), 'utf8');
    expect(src).toMatch(/P7\.19/);
    expect(src).toMatch(/Saved —/);
    expect(src).toMatch(/logged to your calendar/);
    expect(src).toMatch(/testID="reveal-5b-bill"/);
    expect(src).not.toMatch(/switch\s*\(\s*tag/);
    expect(src).not.toMatch(/does that match/);
  });

  it('P7.20 rx reveal owns reminder CTAs', () => {
    const src = readFileSync(join(REVEAL_DIR, 'rx.tsx'), 'utf8');
    expect(src).toMatch(/P7\.20/);
    expect(src).toMatch(/want a reminder before it runs out/);
    expect(src).toMatch(/Yes, remind me/);
    expect(src).toMatch(/No thanks/);
    expect(src).toMatch(/testID="reveal-5b-rx"/);
    expect(src).not.toMatch(/switch\s*\(\s*tag/);
  });

  it('P7.21 mark reveal is its own file with compare-over-time copy', () => {
    const src = readFileSync(join(REVEAL_DIR, 'mark.tsx'), 'utf8');
    expect(src).toMatch(/P7\.21/);
    expect(src).toMatch(/Logged as "mark"/);
    expect(src).toMatch(/compare it over time/);
    expect(src).toMatch(/testID="reveal-5b-mark"/);
    expect(src).not.toMatch(/Logged as "other"/);
    expect(src).not.toMatch(/switch\s*\(\s*tag/);
  });

  it('P7.22 lab reveal is its own file with language honesty', () => {
    const src = readFileSync(join(REVEAL_DIR, 'lab.tsx'), 'utf8');
    expect(src).toMatch(/P7\.22/);
    expect(src).toMatch(/translation is coming/);
    expect(src).toMatch(/kept as written/);
    expect(src).toMatch(/testID="reveal-5b-lab"/);
    expect(src).not.toMatch(/switch\s*\(\s*tag/);
  });

  it('P7.23 other reveal is its own file (not mark template)', () => {
    const src = readFileSync(join(REVEAL_DIR, 'other.tsx'), 'utf8');
    expect(src).toMatch(/P7\.23/);
    expect(src).toMatch(/Logged as "other"/);
    expect(src).toMatch(/saved to your calendar/);
    expect(src).toMatch(/testID="reveal-5b-other"/);
    expect(src).not.toMatch(/compare it over time/);
    expect(src).not.toMatch(/Logged as "mark"/);
    expect(src).not.toMatch(/switch\s*\(\s*tag/);
  });

  it('no single-file tag-conditional reveal reintroduced', () => {
    const chrome = readFileSync(
      join(__dirname, '../../components/capture/CaptureRevealChrome.tsx'),
      'utf8',
    );
    expect(chrome).not.toMatch(/tag\s*===|switch\s*\(\s*tag|RecordTag/);
    expect(chrome).toMatch(/no tag switching/);
  });
});
