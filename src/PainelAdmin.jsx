import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { LogOut, DollarSign, Users, BookOpen, Calendar, Award } from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import AdminFinanceiro from './AdminFinanceiro';
import AdminGestao from './AdminGestao';

export default function PainelAdmin() {
  const { userData, logout } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('usuarios');

  const [financeiro, setFinanceiro] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [avaliacoesBolsistas, setAvaliacoesBolsistas] = useState([]);
  const [presencasBolsistas, setPresencasBolsistas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarTudo = async () => {
    setCarregando(true);
    try {
      const resultados = await Promise.allSettled([
        getDocs(collection(db, 'financeiro')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'cursos')),
        getDocs(collection(db, 'eventos')),
        getDocs(collection(db, 'avaliacoes_bolsistas')),
        getDocs(collection(db, 'presencas_bolsistas')),
      ]);

      const extrair = (res) =>
        res.status === 'fulfilled'
          ? res.value.docs.map((d) => ({ id: d.id, ...d.data() }))
          : [];

      setFinanceiro(extrair(resultados[0]));
      setUsuarios(extrair(resultados[1]));
      setCursos(extrair(resultados[2]));
      setEventos(extrair(resultados[3]));
      setAvaliacoesBolsistas(extrair(resultados[4]));
      setPresencasBolsistas(extrair(resultados[5]));
    } catch (err) {
      console.error('Erro ao carregar dados do admin:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarTudo();
  }, []);

  const abas = [
    { id: 'usuarios', label: 'Alunos, Bolsistas & Profs', icon: Users },
    { id: 'cursos', label: 'Cursos & Turmas', icon: BookOpen },
    { id: 'bolsistas_admin', label: 'Bolsistas & Pareceres', icon: Award },
    { id: 'eventos', label: 'Eventos', icon: Calendar },
    { id: 'financeiro', label: 'Financeiro & Lucros', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="h-1.5 bg-gradient-to-r from-[#4A041C] via-[#D81B60] to-[#4A041C]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-studio.png" alt="No Compasso" className="h-11 object-contain" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D81B60] block">
                Coordenação Geral
              </span>
              <h1 className="text-lg font-bold uppercase font-condensed text-[#4A041C] leading-none">
                No Compasso Studio de Dança
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs font-semibold text-zinc-600">
              Olá, <strong>{userData?.nome}</strong>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-red-50 hover:text-red-700 hover:border-red-200 px-3 py-2 text-xs font-bold uppercase transition"
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto pb-3 pt-1">
          {abas.map((tab) => {
            const Icone = tab.icon;
            const ativa = abaAtiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                  ativa
                    ? 'bg-[#4A041C] text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                <Icone size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {carregando ? (
          <div className="text-center py-20 text-zinc-500 font-semibold">
            Carregando dados do Studio...
          </div>
        ) : abaAtiva === 'financeiro' ? (
          <AdminFinanceiro
            financeiro={financeiro}
            cursos={cursos}
            usuarios={usuarios}
            recarregar={carregarTudo}
          />
        ) : (
          <AdminGestao
            aba={abaAtiva}
            usuarios={usuarios}
            cursos={cursos}
            eventos={eventos}
            financeiro={financeiro}
            avaliacoesBolsistas={avaliacoesBolsistas}
            presencasBolsistas={presencasBolsistas}
            recarregar={carregarTudo}
          />
        )}
      </main>
    </div>
  );
}
