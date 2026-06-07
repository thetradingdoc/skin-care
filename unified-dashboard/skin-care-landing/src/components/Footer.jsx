import { CTAS } from '../content/landingContent';

export default function Footer() {
  return (
    <footer className="sc-footer">
      <div className="sc-footer-inner">
        <div className="sc-footer-brand">
          <img
            src="/assets/images/logo-panda.svg"
            alt=""
            className="sc-logo-mark"
            width={32}
            height={32}
          />
          <span>Skin &amp; Care</span>
        </div>
        <div className="sc-footer-links">
          <a href={CTAS.privacy}>Privacy</a>
          <a href={CTAS.terms}>Terms</a>
          <a href={CTAS.signin}>Sign in</a>
        </div>
        <p className="sc-footer-copy">&copy; {new Date().getFullYear()} Skin &amp; Care</p>
      </div>
    </footer>
  );
}
