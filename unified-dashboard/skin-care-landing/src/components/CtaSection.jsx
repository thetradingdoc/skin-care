import { CTAS, iosAppUrl, isExternalAppUrl } from '../content/landingContent';

export default function CtaSection() {
  const appUrl = iosAppUrl();
  const isExternal = isExternalAppUrl(appUrl);

  return (
    <section className="sc-section sc-cta" aria-labelledby="cta-title">
      <div className="sc-section-inner sc-cta-inner">
        <h2 id="cta-title">Ready to start your routine?</h2>
        <p>Create a free account with your email — no password required.</p>
        <div className="sc-hero-actions">
          <a href={CTAS.signup} className="sc-btn sc-btn-primary">
            Get started free
          </a>
          {isExternal ? (
            <a href={appUrl} className="sc-btn sc-btn-secondary" target="_blank" rel="noopener noreferrer">
              Download on iOS
            </a>
          ) : (
            <a href={appUrl} className="sc-btn sc-btn-secondary">
              Join the waitlist
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
