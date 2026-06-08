import { Route, Routes } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import ScanPage from './pages/ScanPage';
import RevealPage from './pages/RevealPage';
import ConcernsPage from './pages/ConcernsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/reveal" element={<RevealPage />} />
      <Route path="/concerns" element={<ConcernsPage />} />
    </Routes>
  );
}
