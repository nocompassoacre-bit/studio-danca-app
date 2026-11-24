import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import HomePublica from './HomePublica';
import PainelAdmin from './PainelAdmin';
import PainelProfessor from './PainelProfessor';
import PainelBolsista from './PainelBolsista';
import PainelAluno from './PainelAluno';
import InscricaoPublica from './InscricaoPublica';

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
                <PainelProfessor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/aluno/*"
            element={
              <ProtectedRoute allowedRole="aluno">
                <PainelAluno />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bolsista/*"
            element={
              <ProtectedRoute allowedRole="bolsista">
                <PainelBolsista />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
