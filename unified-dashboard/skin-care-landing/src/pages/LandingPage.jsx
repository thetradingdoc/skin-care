import Hero from '../components/Hero';
import StepsSection from '../components/StepsSection';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <StepsSection />
      <section id="blog" className="sc-blog-placeholder" aria-label="Blog coming soon" />
      <Footer />
    </>
  );
}
