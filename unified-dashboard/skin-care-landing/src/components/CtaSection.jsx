import { CTAS, iosAppUrl } from '../content/landingContent';

export default function CtaSection() {
  const appUrl = iosAppUrl();

  return (
    <section className="sc-section sc-cta" aria-labelledby="cta-title">
      <div className="sc-section-inner sc-cta-inner">
        <h2 id="cta-title">Ready to start your routine?</h2>
        <p>Create a free account with your email — no password required.</p>
        <div className="sc-hero-actions">
          <a href={CTAS.signup} className="sc-btn sc-btn-primary">
            Get started free
          </a>
          {appUrl ? (
            <a href={appUrl} className="sc-btn sc-btn-secondary" rel="noopener noreferrer">
              Download on iOS
            </a>
          ) : (
            <span className="sc-ios-soon">iOS app — coming to TestFlight soon</span>
          )}
        </div>
      </div>
    </section>
  );
}
