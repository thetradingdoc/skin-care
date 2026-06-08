import { Link } from 'react-router-dom';
import { CTAS, FINAL_CTA } from '../content/landingContent';

export default function FinalCta() {
  return (
    <section className="sc-final">
      <h2>{FINAL_CTA.title}</h2>
      <p>{FINAL_CTA.subtitle}</p>
      <Link to={CTAS.scan} className="sc-final-btn">
        {FINAL_CTA.buttonLabel}
      </Link>
      <div className="sc-final-disclaimer">
        {FINAL_CTA.disclaimer} ·{' '}
        <a href={CTAS.privacy}>Privacy Policy</a>
      </div>
    </section>
  );
}
