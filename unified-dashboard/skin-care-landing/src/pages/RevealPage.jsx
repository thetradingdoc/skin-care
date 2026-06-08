import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import {
  getConfirmedAge,
  getFaceRead,
  setConfirmedAge,
} from '../lib/skinAgeStorage';

export default function RevealPage() {
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState(null);
  const [confirmedAge, setConfirmedAgeState] = useState(null);
  const [editingAge, setEditingAge] = useState(false);
  const [ageInput, setAgeInput] = useState('');

  useEffect(() => {
    const fr = getFaceRead();
    if (!fr?.apparent_age_estimate) {
      navigate('/concerns', { replace: true });
      return;
    }
    setEstimate(fr.apparent_age_estimate);
    const confirmed = getConfirmedAge();
    setConfirmedAgeState(confirmed);
    if (confirmed) setAgeInput(String(confirmed));
  }, [navigate]);

  if (estimate == null) {
    return (
      <FunnelShell>
        <div className="sc-funnel-inner">
          <p className="sc-funnel-sub">Loading your estimate…</p>
        </div>
      </FunnelShell>
    );
  }

  const delta = confirmedAge != null ? confirmedAge - estimate : null;

  const saveAge = () => {
    const n = Number(ageInput);
    if (!Number.isFinite(n) || n < 13 || n > 99) return;
    setConfirmedAge(n);
    setConfirmedAgeState(n);
    setEditingAge(false);
  };

  return (
    <FunnelShell>
      <div className="sc-funnel-inner sc-reveal-inner">
        <Link to="/scan" className="sc-funnel-back">
          ← Back
        </Link>
        <p className="sc-reveal-kicker">Your skin age estimate</p>
        <p className="sc-reveal-number">{estimate}</p>
        <p className="sc-reveal-unit">years</p>

        {delta != null ? (
          <p className="sc-reveal-compare">
            {delta === 0
              ? 'Matches your real age'
              : delta > 0
                ? `${delta} years above your real age`
                : `${Math.abs(delta)} years below your real age`}
          </p>
        ) : null}

        {editingAge ? (
          <div className="sc-reveal-age-edit">
            <label className="sc-funnel-label" htmlFor="real-age">
              Your real age (optional)
            </label>
            <input
              id="real-age"
              type="number"
              min={13}
              max={99}
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              className="sc-funnel-input"
              placeholder="32"
            />
            <button type="button" className="sc-btn sc-btn-dark sc-btn-block" onClick={saveAge}>
              Save
            </button>
          </div>
        ) : (
          <button type="button" className="sc-funnel-link" onClick={() => setEditingAge(true)}>
            {confirmedAge
              ? `Real age: ${confirmedAge} · Edit`
              : 'Add your real age for comparison'}
          </button>
        )}

        <p className="sc-funnel-sub sc-reveal-body">
          This is a wellness estimate from your photo — not a diagnosis. Track daily to see change over time.
        </p>

        <button type="button" className="sc-btn sc-btn-dark sc-btn-block" onClick={() => navigate('/concerns')}>
          Continue
        </button>
      </div>
    </FunnelShell>
  );
}
