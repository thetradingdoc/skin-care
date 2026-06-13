import { CTAS, FOOTER_TAGLINE } from '../content/landingContent';
import { FOR_PAGE_SLUGS, FOR_PAGES } from '../content/forPagesContent';
import { LogoWordmark } from './DoveIcon';

export default function Footer() {
  return (
    <footer id="contact" className="sc-footer">
      <div className="sc-footer-inner">
        <div className="sc-footer-brand">
          <LogoWordmark className="sc-brand-logo" height={28} />
        </div>
        <div className="sc-footer-links">
          <a href="/about.html">About</a>
          <a href="/contact.html">Contact</a>
          <a href={CTAS.privacy}>Privacy</a>
          <a href={CTAS.terms}>Terms</a>
          <a href={CTAS.signin}>Sign in</a>
        </div>
        <div className="sc-footer-for">
          <p className="sc-footer-for-label">Journal guides</p>
          <div className="sc-footer-links sc-footer-for-links">
            {FOR_PAGE_SLUGS.map((slug) => (
              <a key={slug} href={FOR_PAGES[slug].path}>
                {FOR_PAGES[slug].navLabel}
              </a>
            ))}
          </div>
        </div>
        <p className="sc-footer-tagline">{FOOTER_TAGLINE}</p>
        <p className="sc-footer-copy">&copy; {new Date().getFullYear()} Skin&amp;Care</p>
      </div>
    </footer>
  );
}
