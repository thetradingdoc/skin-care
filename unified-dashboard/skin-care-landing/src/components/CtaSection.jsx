import { CTA_SECTION, CTAS, iosAppUrl, isExternalAppUrl } from '../content/landingContent';

export default function CtaSection() {
  const appUrl = iosAppUrl();
  const isExternal = isExternalAppUrl(appUrl);

  return (
    <section className="sc-section sc-cta" aria-labelledby="cta-title">
      <div className="sc-section-inner sc-cta-inner">
        <h2 id="cta-title">{CTA_SECTION.title}</h2>
        <p>{CTA_SECTION.subtitle}</p>
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
