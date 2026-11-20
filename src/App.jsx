import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import HomePublica from './HomePublica';

const PlaceholderPainel = ({ titulo }) => (
  <div className="min-h-screen bg-[#0F0F12] text-white flex items-center justify-center">
    <h1 className="text-3xl font-bold font-condensed text-[#D81B60]">{titulo}</h1>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePublica />} />
          
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRole="admin">
                <PlaceholderPainel titulo="Painel Coordenação / Admin (Etapa 2)" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/professor/*"
            element={
              <ProtectedRoute allowedRole="prof">
                <PlaceholderPainel titulo="Painel do Professor (Etapa 3)" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/aluno/*"
            element={
              <ProtectedRoute allowedRole="aluno">
                <PlaceholderPainel titulo="Painel do Aluno (Etapa 3)" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bolsista/*"
            element={
              <ProtectedRoute allowedRole="bolsista">
                <PlaceholderPainel titulo="Portal do Bolsista (Etapa 3)" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
