import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { CTAS } from '../content/landingContent';
import { validateUploadHasFace } from '../lib/faceDetectUpload';
import { postFaceRead } from '../lib/faceReadApi';
import { ensureJourneyId, flushQueuedEvents, trackUIEvent } from '../lib/trackUIEvent.js';
import { getVisitorId } from '../lib/visitorId.js';
import {
  hasPhotoAnalysisConsent,
  setFacePhotoUrl,
  setFaceRead,
  setPhotoAnalysisConsent,
} from '../lib/skinAgeStorage';
import { useFaceGuide } from '../lib/useFaceGuide';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => reject(new Error('Could not read photo'));
    reader.readAsDataURL(file);
  });
}

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [consentOk, setConsentOk] = useState(() => hasPhotoAnalysisConsent());
  const [consentChecked, setConsentChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const guide = useFaceGuide(videoRef, ready && consentOk);

  useEffect(() => {
    if (!consentOk) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        setDenied(true);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [consentOk]);

  const analyzeBlob = useCallback(
    async (blob, previewDataUrl) => {
      setBusy(true);
      setError(null);
      try {
        const file = blob instanceof File ? blob : new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        if (previewDataUrl) {
          setFacePhotoUrl(previewDataUrl);
        } else {
          const url = await readFileAsDataUrl(file);
          if (url) setFacePhotoUrl(url);
        }
        const result = await postFaceRead(file);
        setFaceRead(result);
        navigate('/quick-check');
      } catch (e) {
        if (e instanceof Error && e.code === 'face_read_rejected') {
          setError(e.message);
          return;
        }
        setError(e instanceof Error ? e.message : 'Scan failed. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [navigate]
  );

  const capture = useCallback(async () => {
    trackUIEvent('click_shutter', { camera_type: 'front' });
    const video = videoRef.current;
    if (!video || busy) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (blob) await analyzeBlob(blob, dataUrl);
  }, [analyzeBlob, busy]);

  const onFilePick = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      trackUIEvent('click_upload', { source: 'file_picker' });
      if (!hasPhotoAnalysisConsent()) {
        setError('Please agree to photo analysis before uploading.');
        return;
      }
      setError(null);
      const gate = await validateUploadHasFace(file);
      if (!gate.ok) {
        setError(gate.message);
        e.target.value = '';
        return;
      }
      const url = await readFileAsDataUrl(file);
      await analyzeBlob(file, url || undefined);
      e.target.value = '';
    },
    [analyzeBlob]
  );

  const acceptConsent = () => {
    if (!consentChecked) return;
    setPhotoAnalysisConsent();
    setConsentOk(true);
    trackUIEvent('consent_accepted', { visitor_id: getVisitorId() });
    void (async () => {
      await ensureJourneyId();
      await flushQueuedEvents();
    })();
  };

  if (!consentOk) {
    return (
      <FunnelShell>
        <div className="sc-funnel-inner">
          <Link to="/" className="sc-funnel-back">
            ← Back
          </Link>
          <span className="sc-funnel-tag">Before we scan</span>
          <h1 className="sc-funnel-title">Photo analysis consent</h1>
          <p className="sc-funnel-sub">
            We send your photo securely to generate a wellness skin-age estimate. It is not a medical
            diagnosis. Your scan photo stays in this browser session until you create an account; only
            the estimate is kept if you sign up.
          </p>
          <label className="sc-consent-row">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            />
            <span>
              I agree to photo analysis and have read the{' '}
              <a href={CTAS.privacy} target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          <button
            type="button"
            className="sc-btn sc-btn-dark sc-btn-block"
            disabled={!consentChecked}
            onClick={acceptConsent}>
            Continue to camera
          </button>
        </div>
      </FunnelShell>
    );
  }

  if (denied) {
    return (
      <FunnelShell>
        <div className="sc-funnel-inner">
          <Link to="/" className="sc-funnel-back">
            ← Back
          </Link>
          <h1 className="sc-funnel-title">Add a photo</h1>
          <p className="sc-funnel-sub">
            Allow camera access for a live scan, or upload a selfie. Your photo is analyzed securely;
            only your estimate is stored locally until you create an account.
          </p>
          {error ? <p className="sc-funnel-error">{error}</p> : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sc-hidden-input"
            onChange={(e) => void onFilePick(e)}
          />
          <button type="button" className="sc-btn sc-btn-dark sc-btn-block" onClick={() => fileRef.current?.click()}>
            Upload selfie
          </button>
        </div>
      </FunnelShell>
    );
  }

  const canCapture = ready && !busy && guide.canScan;
  const lightOk = guide.status === 'locked' || guide.status === 'aligning';

  return (
    <div className="sc-scan-page sc-scan-page--mock">
      <video ref={videoRef} className="sc-scan-video" playsInline muted />
      <div className="sc-scan-face-layer" aria-hidden="true">
        <div className={`sc-scan-oval sc-scan-oval--${guide.status}`} />
        {lightOk ? <div className="sc-scan-badge">Good light</div> : null}
      </div>
      <div className="sc-scan-overlay">
        <header className="sc-scan-topbar">
          <Link to="/" className="sc-scan-back">
            ← Back
          </Link>
        </header>

        <div className="sc-scan-copy">
          <p className="sc-scan-hint">{guide.hint || 'Align your face'}</p>
        </div>

        <div className="sc-scan-spacer" aria-hidden="true" />

        {error ? <p className="sc-scan-error">{error}</p> : null}

        <div className="sc-scan-actions">
          <p className="sc-scan-hint" style={{ marginBottom: '0.75rem' }}>
            Keep still · natural light works best
          </p>
          <div className="sc-scan-shutter-wrap">
            <button
              type="button"
              className="sc-scan-shutter"
              disabled={!canCapture}
              aria-label={busy ? 'Analyzing' : 'Capture photo'}
              onClick={() => void capture()}>
              {busy ? '…' : '📷'}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sc-hidden-input"
            onChange={(e) => void onFilePick(e)}
          />
          <p className="sc-scan-upload-link">
            Or{' '}
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
              upload a photo
            </button>
          </p>
          <p className="sc-scan-disclaimer">
            Wellness estimate only · photo analyzed securely · not saved to our servers until you sign up
          </p>
        </div>
      </div>
    </div>
  );
}
