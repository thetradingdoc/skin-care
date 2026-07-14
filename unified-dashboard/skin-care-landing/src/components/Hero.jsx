import { CTAS, HERO, iosAppUrl } from '../content/landingContent';
import HeroFeatures from './HeroFeatures';
import SiteHeader from './SiteHeader';

function CtaArrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function StoreBadge({ href, label, sub, name, icon }) {
  const inner = (
    <>
      {icon}
      <div className="sc-badge-inner">
        <span className="sc-badge-sub">{sub}</span>
        <span className="sc-badge-name">{name}</span>
      </div>
    </>
  );

  const isExternal = /^https?:\/\//i.test(href);

  return (
    <a
      className="sc-badge"
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={label}>
      {inner}
    </a>
  );
}

function AndroidComingSoon() {
  return (
    <span className="sc-badge sc-badge-android-soon" aria-label="Android coming soon">
      Android coming soon
    </span>
  );
}

function StoreBadges({ className = '' }) {
  const ios = iosAppUrl();

  return (
    <div className={className ? `sc-badges ${className}` : 'sc-badges'}>
      <StoreBadge
        href={ios}
        label="Download on the App Store"
        sub="Download on the"
        name="App Store"
        icon={<AppleIcon />}
      />
      <AndroidComingSoon />
    </div>
  );
}

export default function Hero() {
  return (
    <section className="sc-hero-split">
      <div className="sc-hero-split-media" aria-hidden="true">
        <img
          src="/assets/images/hero-glow.jpg"
          alt=""
          className="sc-hero-photo"
          width={703}
          height={576}
          fetchpriority="high"
        />
      </div>
      <SiteHeader overlay />
      <div className="sc-hero-split-body">
        <div className="sc-hero-split-copy-wrap">
          <div className="sc-hero-split-copy">
            <p className="sc-hero-subtitle">{HERO.eyebrow}</p>
            <h1 className="sc-hero-headline">
              <span className="sc-hero-headline-line">
                {HERO.titleLine1} <em>{HERO.titleLine2a}</em>
              </span>
              <span className="sc-hero-headline-line sc-hero-headline-journal">
                <em>{HERO.titleLine2b}</em>
              </span>
            </h1>
            <p className="sc-hero-split-sub">{HERO.subtitle}</p>
            <a
              href={CTAS.scan}
              className="sc-btn sc-btn-dark sc-hero-cta"
              target="_blank"
              rel="noopener noreferrer">
              {HERO.ctaLabel}
              <CtaArrow />
            </a>
            <div className="sc-hero-pills">
              <span className="sc-hero-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                1 photo a day
              </span>
              <span className="sc-hero-divider" aria-hidden="true">
                |
              </span>
              <span className="sc-hero-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Track changes
              </span>
              <span className="sc-hero-divider" aria-hidden="true">
                |
              </span>
              <span className="sc-hero-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Understand your skin
              </span>
            </div>
          </div>
        </div>
        <div className="sc-hero-bottom">
          <HeroFeatures />
          <StoreBadges className="sc-badges--after-features" />
        </div>
      </div>
    </section>
  );
}
