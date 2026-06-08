import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { CTAS } from '../content/landingContent';
import { publicGet, publicPost } from '../lib/publicApi';
import {
  getFaceRead,
  setConcernId,
  setMatchJson,
} from '../lib/skinAgeStorage';

const MAX_SELECTED = 2;
const DEFAULT_CONCERN = 'anti_aging';

export default function ConcernsPage() {
  const [concerns, setConcerns] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await publicGet('/api/public/routines/concerns');
        const list = Array.isArray(data?.concerns) ? data.concerns : [];
        setConcerns(list);
        if (list.length) setSelected([list[0].id]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load concerns.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTED) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }, []);

  const goSignup = useCallback(async (primary, chips) => {
    setBusy(true);
    setError(null);
    try {
      setConcernId(primary);
      const faceRead = getFaceRead();
      const confirmedAge = sessionStorage.getItem('sc_onboarding_confirmed_age');
      try {
        const match = await publicPost('/api/public/funnel/match', {
          user_goal: 'track_program',
          face_read: faceRead,
          confirmed_age: confirmedAge ? Number(confirmedAge) : null,
          concern_chip: primary,
          concern_chips: chips,
          secondary_concern_ids: chips.slice(1),
        });
        setMatchJson(match?.match || match || null);
      } catch {
        setMatchJson(null);
      }
      window.location.href = CTAS.signup;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }, []);

  const continueNext = useCallback(() => {
    const primary = selected[0] || DEFAULT_CONCERN;
    const chips = selected.length ? selected : [DEFAULT_CONCERN];
    void goSignup(primary, chips);
  }, [goSignup, selected]);

  const skip = useCallback(() => {
    void goSignup(DEFAULT_CONCERN, [DEFAULT_CONCERN]);
  }, [goSignup]);

  if (loading) {
    return (
      <FunnelShell>
        <div className="sc-funnel-inner">
          <p className="sc-funnel-sub">Loading…</p>
        </div>
      </FunnelShell>
    );
  }

  return (
    <FunnelShell>
      <div className="sc-funnel-inner">
        <Link to={getFaceRead() ? '/reveal' : '/scan'} className="sc-funnel-back">
          ← Back
        </Link>
        <h1 className="sc-funnel-title">What should we focus on?</h1>
        <p className="sc-funnel-sub">Pick up to two. We&apos;ll personalize your 12-week track.</p>

        {error ? <p className="sc-funnel-error">{error}</p> : null}

        <div className="sc-concern-chips">
          {concerns.map((c) => {
            const active = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`sc-concern-chip${active ? ' sc-concern-chip-active' : ''}`}
                onClick={() => toggle(c.id)}>
                {c.label}
              </button>
            );
          })}
        </div>

        <button type="button" className="sc-btn sc-btn-dark sc-btn-block" disabled={busy} onClick={continueNext}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
        <button type="button" className="sc-funnel-link" disabled={busy} onClick={skip}>
          Not sure — skip
        </button>
      </div>
    </FunnelShell>
  );
}
