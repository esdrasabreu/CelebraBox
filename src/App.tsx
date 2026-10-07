import { Routes, Route, useParams, Navigate } from 'react-router-dom';
import { AppProvider } from './lib/AppContext';
import { AuthProvider, useAuth } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicPage from './pages/PublicPage';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import PaymentStatus from './pages/PaymentStatus';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

function AdminWrapper() {
  const { host, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#ef007e] animate-spin" />
      </div>
    );
  }
  
  if (!host) return <Navigate to="/login" replace />;
  return (
    <AppProvider hostId={host.id}>
      <AdminDashboard />
    </AppProvider>
  );
}

function LoginWrapper() {
  const { host, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#ef007e] animate-spin" />
      </div>
    );
  }
  
  if (host) return <Navigate to="/admin" replace />;
  return <Login />;
}

function PublicWrapper() {
  const { hostId } = useParams<{ hostId: string }>();
  return (
    <AppProvider hostId={hostId || 'default'}>
      <PublicPage />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginWrapper />} />
        <Route path="/admin" element={<AdminWrapper />} />
        <Route path="/e/:hostId" element={<PublicWrapper />} />
        <Route path="/e/:hostId/pagamento/:status" element={<PaymentStatus />} />
      </Routes>
    </AuthProvider>
  );
}
