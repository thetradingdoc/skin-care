import { useCallback, useEffect, useRef, useState } from 'react';

const SKIN_FEEL_MAP = {
  tight: 'Tight / dry',
  dry: 'Tight / dry',
  normal: 'Normal',
  oily: 'Oily',
  irritated: 'Irritated',
};

const PM_ROUTINE_MAP = {
  full: 'Full routine',
  partial: 'Partial',
  skipped: 'Skipped',
  skip: 'Skipped',
};

function normalizeSkinFeel(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(tight|dry)\b/.test(t)) return 'Tight / dry';
  if (/\boily\b/.test(t)) return 'Oily';
  if (/\b(irritat|red|burn)\b/.test(t)) return 'Irritated';
  if (/\bnormal\b/.test(t)) return 'Normal';
  return null;
}

function normalizePmRoutine(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(full|complete|yes)\b/.test(t)) return 'Full routine';
  if (/\b(partial|some|half)\b/.test(t)) return 'Partial';
  if (/\b(skip|no|forgot)\b/.test(t)) return 'Skipped';
  return null;
}

export function useVoiceAnswer({ onSkinFeel, onPmRoutine }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const recognitionRef = useRef(null);
  const questionRef = useRef('skin_feel');

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(SR));
    if (!SR) return undefined;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setLastTranscript(transcript);
      if (questionRef.current === 'skin_feel') {
        const val = normalizeSkinFeel(transcript);
        if (val) onSkinFeel?.(val);
        questionRef.current = 'pm_routine';
      } else {
        const val = normalizePmRoutine(transcript);
        if (val) onPmRoutine?.(val);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [onSkinFeel, onPmRoutine]);

  const startListening = useCallback((question = 'skin_feel') => {
    const rec = recognitionRef.current;
    if (!rec) return;
    questionRef.current = question;
    setListening(true);
    setLastTranscript('');
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return {
    supported,
    listening,
    lastTranscript,
    startListening,
    stopListening,
    SKIN_FEEL_MAP,
    PM_ROUTINE_MAP,
  };
}
