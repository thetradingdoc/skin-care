import { SOCIAL_PROOF } from '../content/landingContent';

export default function SocialProof() {
  return (
    <section className="sc-social" aria-label="What people are saying">
      <div className="sc-proof-row">
        {SOCIAL_PROOF.map((card) => (
          <article key={card.name} className="sc-proof-card">
            <div className="sc-proof-name">{card.name}</div>
            <div className="sc-proof-result">
              <span className="sc-proof-age">{card.skinAge}</span>
              <span className="sc-proof-arrow">skin age</span>
            </div>
            <p className="sc-proof-quote">&ldquo;{card.quote}&rdquo;</p>
          </article>
        ))}
      </div>
    </section>
  );
}
