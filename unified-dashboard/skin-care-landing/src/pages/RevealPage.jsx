import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { computeSkinAge } from '../lib/computeSkinAge';
import {
  HEALTH_SCORE_KEYS,
  HEALTH_SCORE_LABELS,
  meterColor,
  resolveHealthScores,
} from '../lib/computeHealthScores';
import { isLiveFaceRead } from '../lib/faceReadApi';
import {
  buildZoneOverlays,
  concernScoresToFindingCards,
  findingIcon,
  fitzDisplay,
  isVisionFailed,
  scanInsightText,
  severityLabel,
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
  const findings = Array.isArray(faceRead?.findings) ? faceRead.findings : [];
  const visionFailed = isVisionFailed(faceRead);

  const skinAge = useMemo(
    () => (faceAge != null && !visionFailed ? computeSkinAge(faceAge, concernScores) : null),
    [faceAge, concernScores, visionFailed],
  );

  const healthScores = useMemo(
    () => (!visionFailed ? resolveHealthScores(faceRead) : null),
    [faceRead, visionFailed],
  );

  const displayFindings = useMemo(() => {
    if (visionFailed) return [];
    if (findings.length > 0) return findings;
    return concernScoresToFindingCards(concernScores);
  }, [findings, concernScores, visionFailed]);

  const zoneOverlays = useMemo(() => {
    if (visionFailed) return [];
    return buildZoneOverlays(findings, zoneCentroids(faceRead?.zone_polygons));
  }, [findings, faceRead?.zone_polygons, visionFailed]);

  const fitz = useMemo(
    () => fitzDisplay(faceRead?.fitzpatrick_estimate, faceRead?.fit_skin_tone),
    [faceRead?.fitzpatrick_estimate, faceRead?.fit_skin_tone],
  );

  const insight = useMemo(
    () =>
      !visionFailed
        ? scanInsightText(faceRead?.scan_summary, faceRead?.positive_observations)
        : null,
    [faceRead, visionFailed],
  );

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

  const skinDelta = skinAge != null && faceAge != null ? skinAge - faceAge : 0;

  return (
    <FunnelShell step={3}>
      <div className="sc-funnel-inner sc-reveal-inner">
        <div className="sc-reveal-topbar">
          <Link to="/quick-check" className="sc-funnel-back sc-funnel-back--inline">
            <i className="ti ti-arrow-left" aria-hidden="true" /> Back
          </Link>
          <span className="sc-funnel-tag sc-funnel-tag--coral sc-funnel-tag--topbar">Your scan</span>
        </div>

        <div className={`sc-reveal-photo${visionFailed ? ' sc-reveal-photo--dim' : ''}`}>
          {photoUrl ? (
            <img src={photoUrl} alt="Your scan" className="sc-reveal-photo-img" />
          ) : (
            <span className="sc-reveal-photo-placeholder" aria-hidden="true">
              👤
            </span>
          )}
          {zoneOverlays.map((o) => (
            <div key={o.key}>
              <div
                className="sc-zone-dot"
                style={{ left: o.dot.left, top: o.dot.top, background: o.dot.color }}
              />
              <div
                className="sc-zone-line"
                style={{
                  left: o.line.left,
                  top: o.line.top,
                  width: `${o.line.width}px`,
                  transform: `rotate(${o.line.rotate}deg)`,
                }}
              />
              <div
                className="sc-zone-label"
                style={{ top: o.label.top, left: o.label.left, right: o.label.right }}>
                {o.label.text}
              </div>
            </div>
          ))}
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
              {faceRead?.age_unreliable ? (
                <div className="sc-score-note">
                  Estimate may vary on deep skin tones — retake in good light for best results.
                </div>
              ) : null}
            </div>
            {skinAge != null && (
              <div className="sc-score-card">
                <div className={`sc-score-n${skinDelta > 0 ? ' sc-score-n--warn' : ''}`}>{skinAge}</div>
                <div className="sc-score-l">Skin age</div>
                <div className={`sc-score-delta${skinDelta <= 0 ? ' sc-score-delta--ok' : ''}`}>
                  {skinDelta > 0 ? `+${skinDelta} yrs` : skinDelta < 0 ? `${skinDelta} yrs` : 'Aligned'}
                </div>
              </div>
            )}
            {faceRead?.fitzpatrick_estimate && (
              <div className="sc-score-card">
                <div className="sc-score-n sc-score-n--sm">{fitz.short}</div>
                <div className="sc-score-l">{fitz.toneLine || 'tone'}</div>
                {fitz.skinLine ? (
                  <div className="sc-score-delta sc-score-delta--muted">{fitz.skinLine}</div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {!visionFailed && insight ? <p className="sc-scan-insight">{insight}</p> : null}

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
            <button type="button" className="sc-btn-reveal-primary" onClick={retake}>
              <i className="ti ti-refresh" aria-hidden="true" /> Scan again
            </button>
          </div>
        ) : null}

        {!visionFailed && displayFindings.length > 0 ? (
          <>
            <p className="sc-section-label">What we found</p>
            <ul className="sc-findings-list">
              {displayFindings.map((f, i) => {
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

        {!visionFailed && healthScores ? (
          <>
            <p className="sc-section-label">Skin health score</p>
            {HEALTH_SCORE_KEYS.map((key) => {
              const value = healthScores[key];
              const color = meterColor(value);
              return (
                <div key={key} className="sc-score-meter">
                  <div className="sc-meter-label">{HEALTH_SCORE_LABELS[key]}</div>
                  <div className="sc-meter-bar">
                    <div
                      className="sc-meter-fill"
                      style={{ width: `${value}%`, background: color }}
                    />
                  </div>
                  <div className="sc-meter-val" style={{ color }}>
                    {value}
                  </div>
                </div>
              );
            })}
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
                <button type="button" className="sc-btn-reveal-primary" onClick={saveAge}>
                  Save
                </button>
              </div>
            ) : (
              <button type="button" className="sc-real-age-row" onClick={() => setEditingAge(true)}>
                <i className="ti ti-calendar" aria-hidden="true" />
                <span className="sc-real-age-label">Add your real age for comparison</span>
                <span className="sc-real-age-action">
                  {confirmedAge ? `Age ${confirmedAge} · Edit` : 'Enter age →'}
                </span>
              </button>
            )}

            <div className="sc-cta-block">
              <button
                type="button"
                className="sc-btn-reveal-primary"
                onClick={() => navigate('/concerns')}>
                Build my routine →
              </button>
              <button type="button" className="sc-btn-reveal-secondary" onClick={retake}>
                That doesn&apos;t look right — scan again
              </button>
            </div>

            <p className="sc-reveal-disclaimer">
              Wellness estimate from your photo — not a medical diagnosis.
            </p>
          </>
        )}

        {visionFailed ? (
          <>
            <hr className="sc-reveal-divider" />
            <div className="sc-skip-row">
              Don&apos;t want to retry?{' '}
              <button type="button" className="sc-link" onClick={() => navigate('/concerns')}>
                Continue with quick-check →
              </button>
            </div>
            <p className="sc-reveal-disclaimer">Wellness estimate from your photo — not a diagnosis.</p>
          </>
        ) : null}
      </div>
    </FunnelShell>
  );
}
