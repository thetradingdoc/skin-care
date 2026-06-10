import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FunnelShell from '../components/FunnelShell';
import { isLiveFaceRead } from '../lib/faceReadApi';
import { getFaceRead, getQuickCheck, setQuickCheck } from '../lib/skinAgeStorage';

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

const HABITS_WITH_SUB = new Set(['yes_regularly', 'sometimes']);

function restoreLegacyQuickCheck(saved) {
  if (!saved || typeof saved !== 'object') return null;
  if (saved.routine_habit) {
    return {
      skin_feel: saved.skin_feel || null,
      routine_habit: saved.routine_habit,
      routine_times: Array.isArray(saved.routine_times) ? saved.routine_times : [],
    };
  }
  const pm = String(saved.pm_routine || '').trim();
  if (!pm) return { skin_feel: saved.skin_feel || null, routine_habit: null, routine_times: [] };
  if (pm === 'Skipped') {
    return { skin_feel: saved.skin_feel || null, routine_habit: 'not_really', routine_times: [] };
  }
  if (pm === 'Partial') {
    return { skin_feel: saved.skin_feel || null, routine_habit: 'sometimes', routine_times: [] };
  }
  if (pm === 'Full routine') {
    return {
      skin_feel: saved.skin_feel || null,
      routine_habit: 'yes_regularly',
      routine_times: ['evening'],
    };
  }
  return { skin_feel: saved.skin_feel || null, routine_habit: null, routine_times: [] };
}

export default function QuickCheckPage() {
  const navigate = useNavigate();
  const [skinFeel, setSkinFeel] = useState(null);
  const [routineHabit, setRoutineHabit] = useState(null);
  const [routineTimes, setRoutineTimes] = useState([]);

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

  const continueNext = () => {
    setQuickCheck({
      skin_feel: skinFeel,
      routine_habit: routineHabit,
      routine_times: HABITS_WITH_SUB.has(routineHabit) ? routineTimes : [],
    });
    navigate('/reveal');
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
          Two quick questions
        </h1>
        <p className="sc-funnel-sub">Tap your answers — takes 5 seconds</p>

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
            <span>Do you follow a skincare routine?</span>
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

        <button
          type="button"
          className="sc-btn sc-btn-dark sc-btn-block"
          disabled={!canContinue}
          onClick={continueNext}>
          See my results →
        </button>
      </div>
    </FunnelShell>
  );
}
