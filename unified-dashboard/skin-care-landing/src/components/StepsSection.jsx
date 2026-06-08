import { STEPS } from '../content/landingContent';

export default function StepsSection() {
  return (
    <section className="sc-steps">
      <h2 className="sc-steps-title">{STEPS.title}</h2>
      <p className="sc-steps-sub">{STEPS.subtitle}</p>
      <div className="sc-steps-grid">
        {STEPS.items.map((step) => (
          <article key={step.id} className="sc-step-card">
            <div className="sc-step-num">{step.num}</div>
            <h3 className="sc-step-title">{step.title}</h3>
            <p className="sc-step-desc">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
