import { JOURNEY_STEPS } from '../content/landingContent';

export default function HeroFeatures() {
  return (
    <section className="sc-hero-features" aria-label="How it works preview">
      <div className="sc-hero-features-inner">
        {JOURNEY_STEPS.items.map((step, index) => (
          <article key={step.id} className="sc-hero-feature">
            {index > 0 ? <div className="sc-hero-feature-divider" aria-hidden="true" /> : null}
            <div className="sc-hero-feature-num" aria-hidden="true">
              {step.num}
            </div>
            <h2 className="sc-hero-feature-title">{step.title}</h2>
            <p className="sc-hero-feature-body">{step.bodyShort}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
