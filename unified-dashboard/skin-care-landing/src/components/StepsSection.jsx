import { HOW_IT_WORKS } from '../content/landingContent';

function StepIcon({ type }) {
  if (type === 'camera') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <ellipse cx="18" cy="16" rx="10" ry="12" />
        <circle cx="18" cy="16" r="4" />
        <line x1="12" y1="30" x2="24" y2="30" />
      </svg>
    );
  }
  if (type === 'target') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="12" />
        <circle cx="18" cy="18" r="7" />
        <circle cx="18" cy="18" r="2" fill="currentColor" />
        <line x1="18" y1="4" x2="18" y2="8" />
        <line x1="18" y1="28" x2="18" y2="32" />
        <line x1="4" y1="18" x2="8" y2="18" />
        <line x1="28" y1="18" x2="32" y2="18" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <polyline points="4,28 10,18 16,22 22,12 28,16 34,8" />
      <circle cx="10" cy="18" r="1.5" fill="currentColor" />
      <circle cx="22" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function StepsSection() {
  return (
    <section id="how" className="sc-steps" aria-labelledby="sc-how-title">
      <h2 id="sc-how-title" className="sc-steps-how-title">
        How it{' '}
        <span className="sc-steps-how-accent">
          <svg className="sc-steps-how-swoosh" viewBox="0 0 240 56" aria-hidden="true">
            <path
              className="sc-steps-how-swoosh-fill"
              d="M8 34 C56 12, 128 10, 232 28 L228 44 C132 36, 60 48, 10 46 Z"
            />
          </svg>
          <span className="sc-steps-how-word">works</span>
        </span>
      </h2>
      <p className="sc-steps-lead">{HOW_IT_WORKS.title}</p>
      <p className="sc-steps-sub">{HOW_IT_WORKS.subtitle}</p>
      <div className="sc-steps-grid">
        {HOW_IT_WORKS.items.map((step) => (
          <article key={step.id} className="sc-step-card">
            <div className="sc-step-icon">
              <StepIcon type={step.icon} />
            </div>
            <h3 className="sc-step-title">{step.title}</h3>
            <p className="sc-step-desc">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
