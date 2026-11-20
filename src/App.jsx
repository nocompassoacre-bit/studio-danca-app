import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import HomePublica from './HomePublica';
import PainelAdmin from './PainelAdmin';
import InscricaoPublica from './InscricaoPublica';

const PlaceholderPainel = ({ titulo }) => (
  <div className="min-h-screen bg-[#F4F4F6] text-zinc-900 flex items-center justify-center">
    <h1 className="text-3xl font-bold font-condensed text-[#4A041C]">{titulo}</h1>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePublica />} />
          <Route path="/inscricao/:tipo/:id" element={<InscricaoPublica />} />
          
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRole="admin">
                <PainelAdmin />
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
