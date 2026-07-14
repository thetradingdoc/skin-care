import { Link } from 'react-router-dom';

import { CTAS, NAV_LINKS } from '../content/landingContent';
import { LogoWordmark } from './DoveIcon';

function IconAccount() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  );
}

export default function SiteHeader({ minimal = false, overlay = false, hideBrand = false }) {
  return (
    <header
      className={`sc-site-header${overlay ? ' sc-site-header-overlay' : ''}${hideBrand ? ' sc-site-header--no-brand' : ''}`}>
      <div className="sc-site-header-inner">
        {hideBrand ? (
          <div className="sc-brand-lockup sc-brand-lockup--empty" aria-hidden="true" />
        ) : (
          <Link to="/" className="sc-brand-lockup" aria-label="touche home">
            <LogoWordmark className="sc-brand-logo" height={52} />
          </Link>
        )}

        {!minimal ? (
          <nav className="sc-site-nav" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="sc-site-nav-link">
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="sc-site-utils">
          <a href={CTAS.signin} className="sc-site-icon-btn" aria-label="Account">
            <IconAccount />
          </a>
        </div>
      </div>
    </header>
  );
}
