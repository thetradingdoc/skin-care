import { Link } from 'react-router-dom';

import { CTAS, HERO, androidAppUrl, iosAppUrl } from '../content/landingContent';
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

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.18 23.76c.37.21.82.21 1.19-.01l11.29-6.52-2.5-2.5L3.18 23.76zM.54 1.52C.2 1.9 0 2.46 0 3.18v17.64c0 .72.2 1.28.54 1.66l.08.08 9.88-9.88v-.23L.62 1.44l-.08.08zM20.46 10.37l-2.8-1.62-2.79 2.79 2.79 2.79 2.81-1.62c.8-.46.8-1.22-.01-1.34zM4.37.25L15.66 6.77l-2.5 2.5L3.18.26C3.56.04 4.01.04 4.37.25z" />
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

function StoreBadges() {
  const ios = iosAppUrl();
  const android = androidAppUrl();

  return (
    <div className="sc-badges">
      <StoreBadge
        href={ios}
        label="Download on the App Store"
        sub="Download on the"
        name="App Store"
        icon={<AppleIcon />}
      />
      <StoreBadge
        href={android}
        label="Get it on Google Play"
        sub="GET IT ON"
        name="Google Play"
        icon={<GooglePlayIcon />}
      />
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
          fetchPriority="high"
        />
      </div>
      <SiteHeader overlay />
      <div className="sc-hero-split-body">
        <div className="sc-hero-split-copy-wrap">
          <div className="sc-hero-split-copy">
            <h1 className="sc-hero-headline">
              <span className="sc-hero-headline-line">{HERO.titleLine1}</span>
              <span className="sc-hero-headline-line">
                <em>{HERO.titleLine2}</em>
              </span>
            </h1>
            <p className="sc-hero-split-sub">{HERO.subtitle}</p>
            <Link to={CTAS.scan} className="sc-btn sc-btn-dark sc-hero-cta">
              {HERO.ctaLabel}
              <CtaArrow />
            </Link>
            <StoreBadges />
          </div>
        </div>
        <HeroFeatures />
      </div>
    </section>
  );
}
