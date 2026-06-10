import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { computeSkinAge } from '../lib/computeSkinAge';
import { isLiveFaceRead } from '../lib/faceReadApi';
import {
  concernFallbackChips,
  findingIcon,
  fitzpatrickToneLabel,
  severityLabel,
  SEV_COLORS,
  zoneCentroids,
} from '../lib/revealHelpers';
import {
  getConfirmedAge,
  getFacePhotoUrl,
  getFaceRead,
  isQuickCheckDone,
  setConfirmedAge,
  setFaceRead,
} from '../lib/skinAgeStorage';

export default function RevealPage() {
  const navigate = useNavigate();
  const [faceRead, setFaceReadState] = useState(null);
  const [confirmedAge, setConfirmedAgeState] = useState(null);
  const [editingAge, setEditingAge] = useState(false);
  const [ageInput, setAgeInput] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    const fr = getFaceRead();
    if (!isLiveFaceRead(fr)) {
      navigate('/scan', { replace: true });
      return;
    }
    if (!isQuickCheckDone()) {
      navigate('/quick-check', { replace: true });
      return;
    }
    setFaceReadState(fr);
    setPhotoUrl(getFacePhotoUrl());
    const confirmed = getConfirmedAge();
    setConfirmedAgeState(confirmed);
    if (confirmed) setAgeInput(String(confirmed));
  }, [navigate]);

  const faceAge = faceRead?.apparent_age_estimate;
  const concernScores = faceRead?.concern_scores ?? {};
  const allScoresZero = Object.values(concernScores).every((v) => (v ?? 0) === 0);
  const findings = Array.isArray(faceRead?.findings) ? faceRead.findings : [];
  const fallbackChips = useMemo(
    () => (findings.length ? [] : concernFallbackChips(concernScores)),
    [findings.length, concernScores],
  );
  const visionFailed =
    faceRead?.vision_enabled &&
    (Boolean(faceRead?.vision_error) ||
      (findings.length === 0 &&
        !faceRead?.scan_summary &&
        allScoresZero &&
        fallbackChips.length === 0));

  const skinAge = useMemo(
    () => (faceAge != null && !visionFailed ? computeSkinAge(faceAge, concernScores) : null),
    [faceAge, concernScores, visionFailed],
  );
  const zonePolygons = faceRead?.zone_polygons || {};
  const centroids = useMemo(() => zoneCentroids(zonePolygons), [zonePolygons]);

  const retake = () => {
    setFaceRead(null);
    navigate('/scan');
  };

  if (faceAge == null) {
    return (
      <FunnelShell step={3}>
        <div className="sc-funnel-inner">
          <p className="sc-funnel-sub">Loading your estimate…</p>
        </div>
      </FunnelShell>
    );
  }

  const saveAge = () => {
    const n = Number(ageInput);
    if (!Number.isFinite(n) || n < 13 || n > 99) return;
    setConfirmedAge(n);
    setConfirmedAgeState(n);
    setEditingAge(false);
  };

  const zoneDots = !visionFailed
    ? findings.flatMap((f) =>
        (f.zones || []).map((zone) => {
          const c = centroids[zone];
          if (!c) return null;
          return (
            <div
              key={`${f.id}-${zone}`}
              className="sc-zone-dot"
              style={{
                left: `${c.x * 100}%`,
                top: `${c.y * 100}%`,
                background: SEV_COLORS[f.severity] || '#888780',
              }}
              title={f.label}
            />
          );
        }),
      ).filter(Boolean)
    : [];

  return (
    <FunnelShell step={3}>
      <div className="sc-funnel-inner sc-reveal-inner">
        <Link to="/quick-check" className="sc-funnel-back">
          ← Back
        </Link>
        <span className="sc-funnel-tag sc-funnel-tag--coral">Your scan</span>

        <div className={`sc-reveal-photo${visionFailed ? ' sc-reveal-photo--dim' : ''}`}>
          {photoUrl ? (
            <img src={photoUrl} alt="Your scan" className="sc-reveal-photo-img" />
          ) : (
            <span style={{ fontSize: '3rem', opacity: 0.35 }} aria-hidden="true">
              👤
            </span>
          )}
          {zoneDots}
          <div
            className={`sc-reveal-photo-badge${visionFailed ? ' sc-reveal-photo-badge--warn' : ''}`}>
            {visionFailed ? (
              <>
                <i className="ti ti-alert-triangle" aria-hidden="true" /> Needs better lighting
              </>
            ) : (
              <>
                <i className="ti ti-check" aria-hidden="true" /> Scan complete
              </>
            )}
          </div>
        </div>

        {!visionFailed && (
          <div className="sc-score-row">
            <div className="sc-score-card">
              <div className="sc-score-n">{faceAge}</div>
              <div className="sc-score-l">Face age</div>
            </div>
            {skinAge != null && skinAge !== faceAge && (
              <div className="sc-score-card">
                <div className="sc-score-n sc-score-n--warn">{skinAge}</div>
                <div className="sc-score-l">Skin age</div>
                <div className="sc-score-delta">+{skinAge - faceAge} yrs gap</div>
              </div>
            )}
            {faceRead?.fitzpatrick_estimate && (
              <div className="sc-score-card">
                <div className="sc-score-n sc-score-n--sm">{faceRead.fitzpatrick_estimate}</div>
                <div className="sc-score-l">Fitzpatrick</div>
                <div className="sc-score-delta sc-score-delta--muted">
                  {fitzpatrickToneLabel(faceRead.fit_skin_tone, faceRead.fitzpatrick_estimate)}
                </div>
              </div>
            )}
          </div>
        )}

        {!visionFailed && faceRead?.scan_summary ? (
          <p className="sc-reveal-summary">{faceRead.scan_summary}</p>
        ) : null}

        {visionFailed ? (
          <div className="sc-retry-state">
            <div className="sc-retry-icon">
              <i className="ti ti-camera" aria-hidden="true" />
            </div>
            <p className="sc-retry-title">We couldn&apos;t read your skin clearly</p>
            <p className="sc-retry-body">
              Your face was detected but lighting made it hard to spot details. Try again — better
              light gives us a lot more to work with.
            </p>
            <ul className="sc-retry-tips">
              <li>
                <strong>Face a window or lamp</strong> — natural front-light works best
              </li>
              <li>
                <strong>For deep skin tones, avoid backlit or dim rooms</strong> — our model needs
                more contrast
              </li>
              <li>No glasses, hair away from face</li>
              <li>Hold still for 2 seconds before capturing</li>
            </ul>
            <button type="button" className="sc-btn sc-btn-dark sc-btn-block" onClick={retake}>
              <i className="ti ti-refresh" aria-hidden="true" /> Scan again
            </button>
          </div>
        ) : null}

        {!visionFailed && findings.length > 0 ? (
          <>
            <p className="sc-section-label">What we found</p>
            <ul className="sc-findings-list">
              {findings.map((f, i) => {
                const { icon, cls, color } = findingIcon(f.id);
                const description = f.plain_language || f.detail || '';
                return (
                  <li key={f.id || i} className="sc-finding-card">
                    <div className={`sc-finding-icon ${cls}`}>
                      <i className={`ti ${icon}`} style={{ color }} aria-hidden="true" />
                    </div>
                    <div className="sc-finding-body">
                      <p className="sc-finding-title">{f.label || f.id || 'Finding'}</p>
                      {description ? <p className="sc-finding-desc">{description}</p> : null}
                    </div>
                    {f.severity ? (
                      <span className={`sc-sev sc-sev--${f.severity}`}>
                        {severityLabel(f.severity)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {!visionFailed && !findings.length && fallbackChips.length > 0 ? (
          <>
            <p className="sc-section-label">What we found</p>
            <ul className="sc-findings-list sc-findings-list--chips">
              {fallbackChips.map((chip) => (
                <li key={chip.id} className="sc-finding-chip">
                  {chip.label}
                  <span className="sc-finding-chip-score">{chip.severity}/3</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {!visionFailed &&
        Array.isArray(faceRead?.positive_observations) &&
        faceRead.positive_observations.length > 0 ? (
          <div className="sc-positive-row">
            <i className="ti ti-sparkles" aria-hidden="true" />
            <span>{faceRead.positive_observations[0]}</span>
          </div>
        ) : null}

        {!visionFailed && (
          <>
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
              Wellness estimate from your photo — not a diagnosis.
              {findings.length ? ' Findings guide your personalized plan.' : ''}
            </p>

            <button
              type="button"
              className="sc-btn sc-btn-dark sc-btn-block"
              onClick={() => navigate('/concerns')}>
              Build my routine →
            </button>
            <button type="button" className="sc-funnel-link" onClick={retake}>
              That doesn&apos;t look right — scan again
            </button>
          </>
        )}

        {visionFailed ? (
          <div className="sc-skip-row">
            Don&apos;t want to retry?{' '}
            <button type="button" className="sc-link" onClick={() => navigate('/concerns')}>
              Continue with quick-check →
            </button>
          </div>
        ) : null}

        {visionFailed ? (
          <p className="sc-funnel-sub sc-reveal-body sc-reveal-body--bottom">
            Wellness estimate from your photo — not a diagnosis.
          </p>
        ) : null}
      </div>
    </FunnelShell>
  );
}
