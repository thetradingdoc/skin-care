import { CTAS, HERO } from '../content/landingContent';

export default function Hero() {
  return (
    <header className="sc-hero">
      <nav className="sc-nav">
        <a href="/" className="sc-logo-link" aria-label="Skin & Care home">
          <img
            src="/assets/images/logo-panda.svg"
            alt=""
            className="sc-logo-mark"
            width={40}
            height={40}
          />
          <span className="sc-logo-text">Skin &amp; Care</span>
        </a>
        <a href={CTAS.signin} className="sc-nav-link">
          Sign in
        </a>
      </nav>

      <div className="sc-hero-inner">
        <p className="sc-hero-eyebrow">Daily skin tracking</p>
        <h1>{HERO.title}</h1>
        <p className="sc-hero-sub">{HERO.subtitle}</p>
        <div className="sc-hero-actions">
          <a href={CTAS.signup} className="sc-btn sc-btn-primary">
            Get started
          </a>
          <a href={CTAS.signin} className="sc-btn sc-btn-secondary">
            Sign in
          </a>
        </div>
      </div>
    </header>
  );
}
