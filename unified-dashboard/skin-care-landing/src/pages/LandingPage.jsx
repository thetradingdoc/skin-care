import { useEffect } from 'react';

import Hero from '../components/Hero';
import StepsSection from '../components/StepsSection';
import Footer from '../components/Footer';

export default function LandingPage() {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7305/ingest/f9cb3960-7315-4ebc-b907-ebcee7ad8a07', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f7004c' },
      body: JSON.stringify({
        sessionId: 'f7004c',
        hypothesisId: 'H3',
        location: 'LandingPage.jsx:mount',
        message: 'landing_mount',
        data: {
          perfMs: Math.round(performance.now()),
          sinceBoot: Math.round(performance.now() - (window.__scPerf0 || 0)),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, []);
  // #endregion

  return (
    <>
      <Hero />
      <StepsSection />
      <section id="blog" className="sc-blog-placeholder" aria-label="Blog coming soon" />
      <Footer />
    </>
  );
}
