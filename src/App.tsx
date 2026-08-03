import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './lib/AppContext';
import PublicPage from './pages/PublicPage';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<PublicPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </AppProvider>
  );
}
