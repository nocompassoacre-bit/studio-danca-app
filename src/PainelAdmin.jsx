import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import {
  LogOut,
  DollarSign,
  Users,
  BookOpen,
  Calendar,
  Award,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
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
  const [detalhesRadarAberto, setDetalhesRadarAberto] = useState(false);

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

  // Radar de mensalidades vencidas ou a vencer em até 7 dias
  const radarMensalidades = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const itensAlerta = (financeiro || [])
      .filter((f) => {
        if (f.tipo !== 'receita' || f.status !== 'pendente' || !f.dataVencimento) {
          return false;
        }
        const venc = new Date(f.dataVencimento + 'T00:00:00');
        if (isNaN(venc.getTime())) return false;
        const diffDias = Math.ceil(
          (venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diffDias <= 7;
      })
      .map((f) => {
        const venc = new Date(f.dataVencimento + 'T00:00:00');
        const diffDias = Math.ceil(
          (venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
        );
        const alunoObj = usuarios.find((u) => u.id === f.alunoId);
        const cursoObj = cursos.find((c) => c.id === f.cursoId);

        return {
          ...f,
          alunoNomeExibicao:
            alunoObj?.nome || f.alunoNomeAvulso || f.alunoNome || 'Aluno(a)',
          cursoNomeExibicao: cursoObj?.titulo || f.tituloItem || 'Turma / Mensalidade',
          diffDias,
          vencimentoBr: f.dataVencimento.split('-').reverse().join('/'),
        };
      })
      .sort((a, b) => a.diffDias - b.diffDias);

    const valorTotal = itensAlerta.reduce(
      (acc, item) => acc + Number(item.valor || 0),
      0
    );

    const vencidasCount = itensAlerta.filter((i) => i.diffDias < 0).length;
    const aVencerCount = itensAlerta.filter((i) => i.diffDias >= 0).length;

    return {
      itens: itensAlerta,
      valorTotal,
      vencidasCount,
      aVencerCount,
    };
  }, [financeiro, usuarios, cursos]);

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
                {tab.id === 'financeiro' && radarMensalidades.itens.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-extrabold">
                    {radarMensalidades.itens.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* RADAR FINANCEIRO: MENSALIDADES VENCIDAS OU PERTO DE VENCER */}
        {!carregando && radarMensalidades.itens.length > 0 && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-300 shadow-xs overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-200 text-amber-950 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                    Radar de Mensalidades — Vencidas ou Perto de Vencer (até 7 dias)
                  </span>
                  <p className="text-xs sm:text-sm text-amber-950 mt-0.5">
                    <strong>{radarMensalidades.itens.length} mensalidade(s)</strong> pendentes
                    ({radarMensalidades.vencidasCount} vencida(s) •{' '}
                    {radarMensalidades.aVencerCount} a vencer) totalizando{' '}
                    <strong>
                      R$ {radarMensalidades.valorTotal.toFixed(2).replace('.', ',')}
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setDetalhesRadarAberto((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-bold uppercase text-amber-950 hover:bg-amber-100 transition"
                >
                  {detalhesRadarAberto ? (
                    <>
                      Ocultar Lista <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      Ver Alunos ({radarMensalidades.itens.length}) <ChevronDown size={14} />
                    </>
                  )}
                </button>

                {abaAtiva !== 'financeiro' && (
                  <button
                    type="button"
                    onClick={() => setAbaAtiva('financeiro')}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#4A041C] px-3.5 py-2 text-xs font-bold uppercase text-white hover:bg-[#D81B60] transition"
                  >
                    Ir ao Financeiro <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {detalhesRadarAberto && (
              <div className="px-4 pb-4 pt-1 border-t border-amber-200/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {radarMensalidades.itens.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs"
                  >
                    <div className="pr-2">
                      <strong className="text-zinc-900 block">
                        {item.alunoNomeExibicao}
                      </strong>
                      <span className="text-[11px] text-zinc-500 block">
                        {item.cursoNomeExibicao}
                      </span>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.diffDias < 0
                            ? 'bg-red-100 text-red-700'
                            : item.diffDias === 0
                            ? 'bg-amber-200 text-amber-950'
                            : 'bg-cyan-50 text-cyan-800'
                        }`}
                      >
                        {item.diffDias < 0
                          ? `Vencida há ${Math.abs(item.diffDias)}d (${item.vencimentoBr})`
                          : item.diffDias === 0
                          ? `Vence hoje (${item.vencimentoBr})`
                          : `Vence em ${item.diffDias}d (${item.vencimentoBr})`}
                      </span>
                    </div>
                    <strong className="text-sm font-bold text-[#4A041C] shrink-0">
                      R$ {Number(item.valor || 0).toFixed(2).replace('.', ',')}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
