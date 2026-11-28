import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
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
  MessageCircle,
  MessageSquare,
  Send,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import AdminFinanceiro from './AdminFinanceiro';
import AdminGestao from './AdminGestao';
import AdminSolicitacoesBolsa from './AdminSolicitacoesBolsa';

export default function PainelAdmin() {
  const { userData, logout } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('usuarios');

  const [financeiro, setFinanceiro] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [mensagensCoord, setMensagensCoord] = useState([]);
  const [avaliacoesBolsistas, setAvaliacoesBolsistas] = useState([]);
  const [presencasBolsistas, setPresencasBolsistas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [detalhesRadarAberto, setDetalhesRadarAberto] = useState(true);
  const [caixaMensagensAberta, setCaixaMensagensAberta] = useState(false);
  const [respostaCoord, setRespostaCoord] = useState({});

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
        getDocs(collection(db, 'matriculas')),
        getDocs(collection(db, 'mensagens')),
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
      setMatriculas(extrair(resultados[6]));

      const todasMsgs = extrair(resultados[7]);
      const msgsParaCoord = todasMsgs
        .filter(
          (m) =>
            m.destinoTipo === 'coordenacao' ||
            m.destinatarioId === 'coordenacao' ||
            !m.destinatarioId
        )
        .sort((a, b) => (b.dataEnvio || '').localeCompare(a.dataEnvio || ''));
      setMensagensCoord(msgsParaCoord);
    } catch (err) {
      console.error('Erro ao carregar dados do admin:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarTudo();
  }, []);

  // Cruza lançamentos pendentes + matrículas ativas perto do dia de vencimento do curso
  const radarMensalidades = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const mesAtualPrefix = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const chavesJaListadas = new Set();
    const listaFinal = [];

    // 1. Cobranças pendentes explícitas no financeiro
    (financeiro || []).forEach((f) => {
      if (f.tipo !== 'receita' || f.status !== 'pendente' || !f.dataVencimento) return;
      const venc = new Date(f.dataVencimento + 'T00:00:00');
      if (isNaN(venc.getTime())) return;

      const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias <= 7) {
        const alunoObj = usuarios.find((u) => u.id === f.alunoId);
        const cursoObj = cursos.find((c) => c.id === f.cursoId);
        chavesJaListadas.add(`${f.alunoId}_${f.cursoId}`);

        listaFinal.push({
          id: f.id,
          alunoId: f.alunoId,
          alunoNome: alunoObj?.nome || f.alunoNomeAvulso || f.alunoNome || 'Aluno(a)',
          telefone: (alunoObj?.telefone || f.telefone || '').replace(/\D/g, ''),
          cursoTitulo: cursoObj?.titulo || f.tituloItem || 'Turma / Mensalidade',
          valor: Number(f.valor || 0),
          diffDias,
          vencimentoBr: f.dataVencimento.split('-').reverse().join('/'),
          origem: 'Lancamento Financeiro',
        });
      }
    });

    // 2. Matrículas ativas de alunos pagantes cujo dia de vencimento do curso está perto (<= 7 dias) e ainda não foi pago no mês
    (matriculas || []).forEach((mat) => {
      if (mat.status === 'cancelada' || mat.roleParticipante === 'bolsista') return;
      const cursoObj = cursos.find((c) => c.id === mat.cursoId);
      if (!cursoObj || Number(cursoObj.valor || 0) <= 0) return;

      const chave = `${mat.alunoId}_${mat.cursoId}`;
      if (chavesJaListadas.has(chave)) return;

      const alunoObj = usuarios.find((u) => u.id === mat.alunoId);
      const papeis = Array.isArray(alunoObj?.roles) ? alunoObj.roles : [alunoObj?.role];
      if (papeis.includes('bolsista')) return;

      // Verifica se já pagou neste mês
      const jaPagouMes = (financeiro || []).some(
        (f) =>
          f.alunoId === mat.alunoId &&
          f.cursoId === mat.cursoId &&
          f.status === 'pago' &&
          (f.dataPagamento || f.dataVencimento || '').startsWith(mesAtualPrefix)
      );
      if (jaPagouMes) return;

      const diaVenc = Number(cursoObj.diaVencimento) || 5;
      let dataAlvo = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc);
      // Se o dia de vencimento deste mês já passou há mais de 20 dias, calcula o próximo mês
      if ((hoje.getTime() - dataAlvo.getTime()) / (1000 * 60 * 60 * 24) > 20) {
        dataAlvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVenc);
      }

      const diffDias = Math.ceil((dataAlvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias <= 7) {
        listaFinal.push({
          id: `mat_${mat.id}`,
          alunoId: mat.alunoId,
          alunoNome: alunoObj?.nome || mat.alunoNome || 'Aluno(a)',
          telefone: (alunoObj?.telefone || '').replace(/\D/g, ''),
          cursoTitulo: cursoObj.titulo,
          valor: Number(cursoObj.valor || 0),
          diffDias,
          vencimentoBr: dataAlvo.toLocaleDateString('pt-BR'),
          origem: `Vencimento Dia ${String(diaVenc).padStart(2, '0')}`,
        });
      }
    });

    listaFinal.sort((a, b) => a.diffDias - b.diffDias);

    const valorTotal = listaFinal.reduce((acc, item) => acc + item.valor, 0);
    const vencidasCount = listaFinal.filter((i) => i.diffDias < 0).length;
    const aVencerCount = listaFinal.filter((i) => i.diffDias >= 0).length;

    return {
      itens: listaFinal,
      valorTotal,
      vencidasCount,
      aVencerCount,
    };
  }, [financeiro, matriculas, usuarios, cursos]);

  const gerarLinkWhatsAppCobranca = (item) => {
    const fone = item.telefone.startsWith('55') ? item.telefone : `55${item.telefone}`;
    const texto = encodeURIComponent(
      `Olá, ${item.alunoNome}! Tudo bem? Passando para lembrar com carinho da mensalidade da turma *${item.cursoTitulo}* (R$ ${item.valor
        .toFixed(2)
        .replace('.', ',')}), com vencimento em *${item.vencimentoBr}*. Qualquer dúvida, estamos à disposição! — No Compasso Studio de Dança 💃🕺`
    );
    return `https://wa.me/${fone}?text=${texto}`;
  };

  const handleResponderMensagemCoord = async (msgId) => {
    const texto = (respostaCoord[msgId] || '').trim();
    if (!texto) return;
    try {
      await updateDoc(doc(db, 'mensagens', msgId), {
        resposta: texto,
        respondidoPor: userData?.nome || 'Coordenação Geral',
        dataResposta: new Date().toISOString(),
        lida: true,
      });
      setRespostaCoord((prev) => ({ ...prev, [msgId]: '' }));
      carregarTudo();
    } catch (err) {
      alert('Erro ao responder mensagem: ' + err.message);
    }
  };

  const msgsNaoLidasCoord = mensagensCoord.filter((m) => !m.lida && !m.resposta).length;

  const abas = [
    { id: 'usuarios', label: 'Alunos, Bolsistas & Profs', icon: Users },
    { id: 'cursos', label: 'Cursos & Turmas', icon: BookOpen },
    { id: 'bolsistas_admin', label: 'Bolsistas & Pareceres', icon: Award },
    { id: 'solicitacoes_bolsa', label: 'Solicitações de Bolsa', icon: FileCheck2 },
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCaixaMensagensAberta((prev) => !prev)}
              className="relative inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-pink-50 px-3 py-2 text-xs font-bold uppercase text-[#4A041C] transition"
            >
              <MessageSquare size={15} className="text-[#D81B60]" />
              <span className="hidden sm:inline">Mensagens</span>
              {msgsNaoLidasCoord > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#D81B60] text-white text-[10px] font-extrabold">
                  {msgsNaoLidasCoord}
                </span>
              )}
            </button>

            <span className="hidden md:inline text-xs font-semibold text-zinc-600">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* CAIXA DE MENSAGENS ENVIADAS PELOS ALUNOS PARA A COORDENAÇÃO */}
        {!carregando && caixaMensagensAberta && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <MessageSquare size={18} className="text-[#D81B60]" />
                Mensagens dos Alunos para a Coordenação ({mensagensCoord.length})
              </h3>
              <button
                type="button"
                onClick={() => setCaixaMensagensAberta(false)}
                className="text-xs font-bold uppercase text-zinc-400 hover:text-zinc-700"
              >
                Fechar
              </button>
            </div>

            {mensagensCoord.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4">
                Nenhuma mensagem enviada pelos alunos para a coordenação até o momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {mensagensCoord.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-[#4A041C]">{msg.remetenteNome}</strong>
                      <span className="text-[10px] text-zinc-400">
                        {msg.dataEnvio ? new Date(msg.dataEnvio).toLocaleDateString('pt-BR') : ''}
                      </span>
                    </div>
                    <p className="text-zinc-800 bg-white p-2.5 rounded-lg border border-zinc-200">
                      {msg.texto}
                    </p>

                    {msg.resposta ? (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                        <strong>Respondido:</strong> {msg.resposta}
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Escreva a resposta da coordenação..."
                          value={respostaCoord[msg.id] || ''}
                          onChange={(e) =>
                            setRespostaCoord((prev) => ({ ...prev, [msg.id]: e.target.value }))
                          }
                          className="flex-1 rounded-xl border border-zinc-300 px-3 py-1.5 text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleResponderMensagemCoord(msg.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#4A041C] px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-[#D81B60]"
                        >
                          <Send size={12} /> Responder
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RADAR SEMPRE VISÍVEL: MATRÍCULAS & MENSALIDADES PERTO DE VENCER */}
        {!carregando && (
          <div
            className={`rounded-2xl border shadow-xs overflow-hidden ${
              radarMensalidades.itens.length > 0
                ? 'bg-amber-50 border-amber-300'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    radarMensalidades.itens.length > 0
                      ? 'bg-amber-200 text-amber-950'
                      : 'bg-emerald-200 text-emerald-900'
                  }`}
                >
                  {radarMensalidades.itens.length > 0 ? (
                    <AlertTriangle size={20} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </div>
                <div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block ${
                      radarMensalidades.itens.length > 0 ? 'text-amber-900' : 'text-emerald-900'
                    }`}
                  >
                    Radar de Matrículas & Mensalidades (Janela de 7 Dias)
                  </span>
                  {radarMensalidades.itens.length > 0 ? (
                    <p className="text-xs sm:text-sm text-amber-950 mt-0.5">
                      <strong>{radarMensalidades.itens.length} matrícula(s)/mensalidade(s)</strong>{' '}
                      ({radarMensalidades.vencidasCount} vencida(s) •{' '}
                      {radarMensalidades.aVencerCount} perto de vencer) totalizando{' '}
                      <strong>
                        R$ {radarMensalidades.valorTotal.toFixed(2).replace('.', ',')}
                      </strong>
                      .
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-900 mt-0.5">
                      Nenhuma matrícula com mensalidade vencida ou vencendo nos próximos 7 dias.
                    </p>
                  )}
                </div>
              </div>

              {radarMensalidades.itens.length > 0 && (
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setDetalhesRadarAberto((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-bold uppercase text-amber-950 hover:bg-amber-100 transition"
                  >
                    {detalhesRadarAberto ? (
                      <>
                        Recolher <ChevronUp size={14} />
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
                      Financeiro <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {radarMensalidades.itens.length > 0 && detalhesRadarAberto && (
              <div className="px-4 pb-4 pt-2 border-t border-amber-200/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {radarMensalidades.itens.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-white border border-amber-200 flex flex-col justify-between gap-2.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-zinc-900 text-sm block">
                          {item.alunoNome}
                        </strong>
                        <span className="text-[11px] font-semibold text-zinc-600 block">
                          {item.cursoTitulo}
                        </span>
                      </div>
                      <strong className="text-sm font-bold text-[#4A041C] shrink-0">
                        R$ {item.valor.toFixed(2).replace('.', ',')}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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

                      {item.telefone ? (
                        <a
                          href={gerarLinkWhatsAppCobranca(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white transition"
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      ) : (
                        <span className="text-[10px] text-zinc-400">Sem telefone</span>
                      )}
                    </div>
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
        ) : abaAtiva === 'solicitacoes_bolsa' ? (
          <AdminSolicitacoesBolsa recarregarGeral={carregarTudo} />
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
