import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { postFaceRead } from '../lib/faceReadApi';
import { setFaceRead } from '../lib/skinAgeStorage';

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  }, []);

  const analyzeBlob = useCallback(
    async (blob) => {
      setBusy(true);
      setError(null);
      try {
        const file = blob instanceof File ? blob : new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        const result = await postFaceRead(file);
        setFaceRead(result);
        navigate('/reveal');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Scan failed. Try again.');
      } finally {
        setBusy(false);
      }
    },
    [navigate]
  );

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busy) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (blob) await analyzeBlob(blob);
  }, [analyzeBlob, busy]);

  const onFilePick = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (file) await analyzeBlob(file);
    },
    [analyzeBlob]
  );

  const skip = useCallback(() => {
    navigate('/concerns');
  }, [navigate]);

  if (denied) {
    return (
      <FunnelShell>
        <div className="sc-funnel-inner">
          <Link to="/" className="sc-funnel-back">
            ← Back
          </Link>
          <h1 className="sc-funnel-title">Add a photo</h1>
          <p className="sc-funnel-sub">
            Allow camera access for a live scan, or upload a selfie. Nothing is saved until you create an account.
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
          <button type="button" className="sc-funnel-link" onClick={skip}>
            Skip for now
          </button>
        </div>
      </FunnelShell>
    );
  }

  return (
    <FunnelShell>
      <div className="sc-scan-page">
        <video ref={videoRef} className="sc-scan-video" playsInline muted />
        <div className="sc-scan-overlay">
          <Link to="/" className="sc-scan-back">
            ← Back
          </Link>
          <p className="sc-scan-badge">Skin age estimate</p>
          <h1 className="sc-scan-headline">Find your face age</h1>
          <p className="sc-scan-hint">Center your face in the oval</p>
          <div className="sc-scan-oval-wrap">
            <div className="sc-scan-oval" />
          </div>
          {error ? <p className="sc-scan-error">{error}</p> : null}
          <button
            type="button"
            className="sc-btn sc-btn-dark sc-btn-block"
            disabled={!ready || busy}
            onClick={() => void capture()}>
            {busy ? 'Analyzing…' : 'Scan now'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sc-hidden-input"
            onChange={(e) => void onFilePick(e)}
          />
          <button type="button" className="sc-funnel-link sc-funnel-link-light" onClick={() => fileRef.current?.click()}>
            Upload instead
          </button>
          <button type="button" className="sc-funnel-link sc-funnel-link-light" onClick={skip} disabled={busy}>
            Skip for now
          </button>
          <p className="sc-scan-disclaimer">Skin age estimate · Not a medical diagnosis</p>
        </div>
      </div>
    </FunnelShell>
  );
}
