import { Route, Routes } from 'react-router-dom';

import FunnelRouteTracker from './components/FunnelRouteTracker.jsx';
import LandingPage from './pages/LandingPage';
import ScanPage from './pages/ScanPage';
import QuickCheckPage from './pages/QuickCheckPage';
import RevealPage from './pages/RevealPage';
import ConcernsPage from './pages/ConcernsPage';
import ForPage from './pages/ForPage';

export default function App() {
  return (
    <>
      <FunnelRouteTracker />
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/quick-check" element={<QuickCheckPage />} />
      <Route path="/reveal" element={<RevealPage />} />
      <Route path="/concerns" element={<ConcernsPage />} />
      <Route path="/for/:slug" element={<ForPage />} />
      </Routes>
    </>
  );
}
