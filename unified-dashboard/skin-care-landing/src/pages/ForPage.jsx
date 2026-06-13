import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

import Footer from '../components/Footer';
import SiteHeader from '../components/SiteHeader';
import { CTAS, HERO } from '../content/landingContent';
import { FOR_PAGES } from '../content/forPagesContent';
import { setDocumentSeo } from '../lib/seo';

export default function ForPage() {
  const { slug } = useParams();
  const page = FOR_PAGES[slug];

  useEffect(() => {
    if (!page) return;
    setDocumentSeo({
      title: page.title,
      description: page.metaDescription,
      path: page.path,
    });
  }, [page]);

  if (!page) {
    return (
      <div className="sc-for-page">
        <SiteHeader />
        <main className="sc-for-main">
          <h1>Page not found</h1>
          <Link to="/">Back home</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="sc-for-page">
      <SiteHeader />
      <main className="sc-for-main">
        <p className="sc-for-kicker">The #1 Skincare Journal</p>
        <h1 className="sc-for-headline">{page.headline}</h1>
        <p className="sc-for-intro">{page.intro}</p>

        {page.sections.map((section) => (
          <section key={section.heading} className="sc-for-section">
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}

        <div className="sc-for-cta-wrap">
          <Link to={CTAS.scan} className="sc-btn sc-btn-dark">
            {page.cta}
          </Link>
          <p className="sc-for-cta-sub">{HERO.subtitle}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
