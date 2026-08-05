import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { host } = useAuth();
  
  if (!host) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
