import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  
  if (requireAdmin && !userInfo?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
} 