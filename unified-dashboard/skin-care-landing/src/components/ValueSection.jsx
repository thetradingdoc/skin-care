import { VALUE_BULLETS } from '../content/landingContent';

export default function ValueSection() {
  return (
    <section className="sc-section sc-values" aria-labelledby="values-title">
      <div className="sc-section-inner">
        <h2 id="values-title" className="sc-section-title">
          Your skin journal, simplified
        </h2>
        <ul className="sc-value-grid">
          {VALUE_BULLETS.map((item) => (
            <li key={item.id} className="sc-value-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
