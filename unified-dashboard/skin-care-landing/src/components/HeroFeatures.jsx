import { FEATURES } from '../content/landingContent';

function FeatureIcon({ type }) {
  if (type === 'track') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <polyline points="4,28 10,18 16,22 22,12 28,16 34,8" />
        <circle cx="10" cy="18" r="1.5" fill="currentColor" />
        <circle cx="22" cy="12" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (type === 'insights') {
    return (
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <rect x="14" y="4" width="8" height="5" rx="1" />
        <line x1="18" y1="9" x2="18" y2="13" />
        <path d="M12 13h12l-2.5 18H14.5L12 13z" />
        <circle cx="18" cy="28" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <rect x="4" y="6" width="28" height="26" rx="3" />
      <line x1="4" y1="13" x2="32" y2="13" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="24" y1="3" x2="24" y2="9" />
      <polyline points="12,21 16,25 24,18" />
    </svg>
  );
}

export default function HeroFeatures() {
  return (
    <section id="features" className="sc-hero-features">
      <div id="how" className="sc-hero-features-anchor" aria-hidden="true" />
      <div className="sc-hero-features-inner">
        {FEATURES.map((feature, index) => (
          <article
            key={feature.id}
            id={feature.id === 'insights' ? 'insights' : undefined}
            className="sc-hero-feature">
            {index > 0 ? <div className="sc-hero-feature-divider" aria-hidden="true" /> : null}
            <div className="sc-hero-feature-icon">
              <FeatureIcon type={feature.icon} />
            </div>
            <h2 className="sc-hero-feature-title">{feature.title}</h2>
            <p className="sc-hero-feature-body">{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
