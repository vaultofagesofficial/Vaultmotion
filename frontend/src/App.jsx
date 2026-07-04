import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import StudioPage from './pages/StudioPage.jsx';
import JobsPage from './pages/JobsPage.jsx';
import JobDetailPage from './pages/JobDetailPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import BatchPage from './pages/BatchPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/studio" replace />} />
          <Route path="studio" element={<StudioPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/:jobId" element={<JobDetailPage />} />
          <Route path="batch" element={<BatchPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
