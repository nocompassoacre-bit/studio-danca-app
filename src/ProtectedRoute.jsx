import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, userData } = useAuth();

  if (!user || !userData) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && userData.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
