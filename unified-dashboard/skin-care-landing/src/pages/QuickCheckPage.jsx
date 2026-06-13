import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { isLiveFaceRead } from '../lib/faceReadApi';
import {
  getFaceRead,
  getQuickCheck,
  setQuickCheck,
  setWatchOnlyOnboarding,
} from '../lib/skinAgeStorage';

const SKIN_FEEL_OPTS = ['Tight / dry', 'Normal', 'Oily', 'Irritated'];

const ROUTINE_HABIT_OPTS = [
  { id: 'yes_regularly', label: 'Yes, regularly' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'not_really', label: 'Not really' },
  { id: 'starting_fresh', label: "I'm starting fresh" },
];

const ROUTINE_TIME_OPTS = [
  { id: 'morning', label: 'Morning' },
  { id: 'evening', label: 'Evening' },
  { id: 'spf', label: 'SPF most days' },
  { id: 'actives', label: 'Actives' },
];

const TRIGGER_OPTS = ['Makeup', 'New product', 'Stress', 'Weather', 'Nothing'];

const HABITS_WITH_SUB = new Set(['yes_regularly', 'sometimes']);

function restoreLegacyQuickCheck(saved) {
  if (!saved || typeof saved !== 'object') return null;
  if (saved.routine_habit) {
    return {
      skin_feel: saved.skin_feel || null,
      routine_habit: saved.routine_habit,
      routine_times: Array.isArray(saved.routine_times) ? saved.routine_times : [],
      recent_trigger: saved.recent_trigger || null,
    };
  }
  const pm = String(saved.pm_routine || '').trim();
  if (!pm) return { skin_feel: saved.skin_feel || null, routine_habit: null, routine_times: [], recent_trigger: null };
  if (pm === 'Skipped') {
    return { skin_feel: saved.skin_feel || null, routine_habit: 'not_really', routine_times: [], recent_trigger: null };
  }
  if (pm === 'Partial') {
    return { skin_feel: saved.skin_feel || null, routine_habit: 'sometimes', routine_times: [], recent_trigger: null };
  }
  if (pm === 'Full routine') {
    return {
      skin_feel: saved.skin_feel || null,
      routine_habit: 'yes_regularly',
      routine_times: ['evening'],
      recent_trigger: null,
    };
  }
  return { skin_feel: saved.skin_feel || null, routine_habit: null, routine_times: [], recent_trigger: null };
}

export default function QuickCheckPage() {
  const navigate = useNavigate();
  const [skinFeel, setSkinFeel] = useState(null);
  const [routineHabit, setRoutineHabit] = useState(null);
  const [routineTimes, setRoutineTimes] = useState([]);
  const [recentTrigger, setRecentTrigger] = useState(null);

  useEffect(() => {
    const fr = getFaceRead();
    if (!isLiveFaceRead(fr)) {
      navigate('/scan', { replace: true });
      return;
    }
    const restored = restoreLegacyQuickCheck(getQuickCheck());
    if (restored?.skin_feel) setSkinFeel(restored.skin_feel);
    if (restored?.routine_habit) setRoutineHabit(restored.routine_habit);
    if (restored?.routine_times?.length) setRoutineTimes(restored.routine_times);
    if (restored?.recent_trigger) setRecentTrigger(restored.recent_trigger);
  }, [navigate]);

  const selectHabit = useCallback((id) => {
    setRoutineHabit(id);
    if (!HABITS_WITH_SUB.has(id)) {
      setRoutineTimes([]);
    }
  }, []);

  const toggleRoutineTime = useCallback((id) => {
    setRoutineTimes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }, []);

  const persistAndContinue = useCallback(
    (watchOnly = false) => {
      setWatchOnlyOnboarding(watchOnly);
      setQuickCheck({
        skin_feel: skinFeel,
        routine_habit: watchOnly ? 'not_really' : routineHabit,
        routine_times: HABITS_WITH_SUB.has(routineHabit) ? routineTimes : [],
        recent_trigger: recentTrigger,
        watch_only: watchOnly,
      });
      navigate('/reveal');
    },
    [navigate, recentTrigger, routineHabit, routineTimes, skinFeel],
  );

  const continueNext = () => persistAndContinue(false);

  const trackOnly = () => {
    if (!skinFeel) return;
    persistAndContinue(true);
  };

  const needsSubChips = HABITS_WITH_SUB.has(routineHabit);
  const subChipsOk = !needsSubChips || routineTimes.length > 0;
  const canContinue = Boolean(skinFeel && routineHabit && subChipsOk);

  return (
    <FunnelShell step={2}>
      <div className="sc-funnel-inner">
        <Link to="/scan" className="sc-funnel-back">
          ← Back
        </Link>
        <span className="sc-funnel-tag">Quick check</span>
        <h1 className="sc-funnel-title" style={{ fontSize: '1.15rem' }}>
          A few quick questions
        </h1>
        <p className="sc-funnel-sub">Tap your answers — takes a few seconds</p>

        <div className="sc-q-card">
          <div className="sc-q-title">
            <span aria-hidden="true">💧</span>
            <span>How does your skin feel today?</span>
          </div>
          <div className="sc-q-opts">
            {SKIN_FEEL_OPTS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`sc-q-opt${skinFeel === opt ? ' sc-q-opt--sel' : ''}`}
                onClick={() => setSkinFeel(opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="sc-q-card">
          <div className="sc-q-title">
            <span aria-hidden="true">☀️</span>
            <span>Do you use a skincare routine?</span>
          </div>
          <p className="sc-q-hint">Morning, evening, or just getting started — no wrong answer.</p>
          <div className="sc-q-opts">
            {ROUTINE_HABIT_OPTS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`sc-q-opt${routineHabit === opt.id ? ' sc-q-opt--sel' : ''}`}
                onClick={() => selectHabit(opt.id)}>
                {opt.label}
              </button>
            ))}
          </div>

          {needsSubChips ? (
            <div className="sc-q-sub">
              <p className="sc-q-sub-title">
                When do you usually take care of your skin? <em>(pick any)</em>
              </p>
              <div className="sc-q-opts">
                {ROUTINE_TIME_OPTS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`sc-q-opt${routineTimes.includes(opt.id) ? ' sc-q-opt--sel' : ''}`}
                    onClick={() => toggleRoutineTime(opt.id)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="sc-q-card">
          <div className="sc-q-title">
            <span aria-hidden="true">🔍</span>
            <span>Did something change recently?</span>
          </div>
          <p className="sc-q-hint">Optional — helps us understand your skin right now.</p>
          <div className="sc-q-opts">
            {TRIGGER_OPTS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`sc-q-opt${recentTrigger === opt ? ' sc-q-opt--sel' : ''}`}
                onClick={() => setRecentTrigger(opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="sc-btn sc-btn-dark sc-btn-block"
          disabled={!canContinue}
          onClick={continueNext}>
          See my results →
        </button>

        <p className="sc-funnel-sub" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            className="sc-link"
            disabled={!skinFeel}
            onClick={trackOnly}>
            I just want to track my skin — no routine
          </button>
        </p>
      </div>
    </FunnelShell>
  );
}
