import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children, allowedRole }) {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F12] text-white flex items-center justify-center">
        <p className="animate-pulse text-lg tracking-widest uppercase font-condensed text-[#C5A059]">
          Verificando credenciais...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole) {
    const listaRoles = Array.isArray(userData?.roles) && userData.roles.length > 0
      ? userData.roles
      : [userData?.role];

    if (!listaRoles.includes(allowedRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
