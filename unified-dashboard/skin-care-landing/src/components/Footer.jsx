import { CTAS } from '../content/landingContent';
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
        <p className="sc-footer-disclaimer">For wellness tracking only · Not a medical diagnosis</p>
        <p className="sc-footer-copy">&copy; {new Date().getFullYear()} Skin&amp;Care</p>
      </div>
    </footer>
  );
}
