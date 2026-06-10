import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { CTAS } from '../content/landingContent';
import { publicGet, publicPost } from '../lib/publicApi';
import {
  getConfirmedAge,
  getFaceRead,
  getQuickCheck,
  getSuggestedConcerns,
  setConcernId,
  setMatchJson,
  setSuggestedConcerns,
} from '../lib/skinAgeStorage';

const DEFAULT_CONCERN = 'anti_aging';

const CONCERN_ICONS = {
  anti_aging: '✨',
  acne: '◎',
  hyperpigmentation: '☀️',
  hyperpigmentation_dark_skin: '🌙',
  barrier_repair: '🛡️',
  rosacea: '🌸',
};

export default function ConcernsPage() {
  const [concerns, setConcerns] = useState([]);
  const [selected, setSelected] = useState(DEFAULT_CONCERN);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preselectNote, setPreselectNote] = useState('');
  const [suggestedIds, setSuggestedIds] = useState([]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await publicGet('/api/public/routines/concerns');
        const list = Array.isArray(data?.concerns) ? data.concerns : [];
        setConcerns(list);

        const faceRead = getFaceRead();
        const quickCheck = getQuickCheck();
        const confirmedAge = getConfirmedAge();
        let primary = DEFAULT_CONCERN;
        let suggested = getSuggestedConcerns();

        try {
          const matchRes = await publicPost('/api/public/funnel/match', {
            user_goal: 'track_program',
            face_read: faceRead,
            confirmed_age: confirmedAge,
            quick_check_answers: quickCheck,
          });
          const match = matchRes?.match || matchRes || {};
          suggested = Array.isArray(match.suggested_concern_ids) ? match.suggested_concern_ids : [];
          if (match.primary_suggestion) primary = match.primary_suggestion;
          else if (suggested[0]) primary = suggested[0];
          setSuggestedConcerns(suggested);
          setSuggestedIds(suggested);
          setMatchJson(match);
        } catch {
          if (!suggested.length && list.length) primary = list[0].id;
        }

        if (list.some((c) => c.id === primary)) {
          setSelected(primary);
          const label = list.find((c) => c.id === primary)?.label || primary;
          setPreselectNote(`${label} pre-selected based on your scan`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load concerns.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const goSignup = useCallback(async (primary) => {
    setBusy(true);
    setError(null);
    try {
      setConcernId(primary);
      const faceRead = getFaceRead();
      const confirmedAge = getConfirmedAge();
      const quickCheck = getQuickCheck();
      try {
        const match = await publicPost('/api/public/funnel/match', {
          user_goal: 'track_program',
          face_read: faceRead,
          confirmed_age: confirmedAge,
          concern_chip: primary,
          concern_chips: [primary],
          quick_check_answers: quickCheck,
        });
        setMatchJson(match?.match || match || null);
      } catch {
        /* keep prior match */
      }
      window.location.href = CTAS.signup;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }, []);

  const continueNext = useCallback(() => {
    void goSignup(selected || DEFAULT_CONCERN);
  }, [goSignup, selected]);

  const selectedRow = concerns.find((c) => c.id === selected);

  if (loading) {
    return (
      <FunnelShell step={4}>
        <div className="sc-funnel-inner">
          <p className="sc-funnel-sub">Loading…</p>
        </div>
      </FunnelShell>
    );
  }

  return (
    <FunnelShell step={4}>
      <div className="sc-funnel-inner">
        <Link to="/reveal" className="sc-funnel-back">
          ← Back
        </Link>
        <span className="sc-funnel-tag">Your plan</span>
        <h1 className="sc-funnel-title" style={{ fontSize: '1.15rem' }}>
          {suggestedIds.length >= 2 ? 'We spotted two things' : 'Choose your focus'}
        </h1>
        <p className="sc-funnel-sub">Pick your primary concern to focus on first</p>

        {error ? <p className="sc-funnel-error">{error}</p> : null}

        <div className="sc-concern-grid">
          {concerns.map((c) => {
            const active = selected === c.id;
            return (
              <button
                key={c.id}
                type="button"
                className={`sc-concern-card${active ? ' sc-concern-card--pick' : ''}`}
                onClick={() => setSelected(c.id)}>
                <span className="sc-concern-card-icon" aria-hidden="true">
                  {CONCERN_ICONS[c.id] || '•'}
                </span>
                <span className="sc-concern-card-name">{c.label}</span>
                <span className="sc-concern-card-dur">{c.total_weeks || 12} weeks</span>
              </button>
            );
          })}
        </div>

        {preselectNote ? <p className="sc-concern-hint">{preselectNote}</p> : null}

        <button type="button" className="sc-btn sc-btn-dark sc-btn-block" disabled={busy} onClick={continueNext}>
          {busy
            ? 'Saving…'
            : `Start ${selectedRow?.label?.toLowerCase() || 'plan'} plan`}
        </button>
      </div>
    </FunnelShell>
  );
}
