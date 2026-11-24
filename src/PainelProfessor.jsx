import { useState, useEffect } from 'react';
import {
  addDoc, collection, doc, getDocs, query, updateDoc, where
} from 'firebase/firestore';
import {
  BookOpen, Users, CheckSquare, FileText, MessageSquare,
  Calendar, Clock, Plus, Save, CheckCircle2, XCircle, Send, LogOut, ArrowLeft,
  BarChart3, UserCheck, Edit3, Award, Star, ShieldAlert, Lock
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';

export default function PainelProfessor() {
  const { user, userData, logout } = useAuth();
  const [abaPrincipal, setAbaPrincipal] = useState('turmas'); // 'turmas' | 'bolsistas'
  const [cursos, setCursos] = useState([]);
  const [cursoSelecionado, setCursoSelecionado] = useState(null);
  const [subAba, setSubAba] = useState('chamada');
  const [carregando, setCarregando] = useState(true);

  // Dados da turma aberta
  const [inscritos, setInscritos] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [todasPresencasTurma, setTodasPresencasTurma] = useState([]);
  const [presencasHoje, setPresencasHoje] = useState({});
  const [dataChamada, setDataChamada] = useState(new Date().toISOString().split('T')[0]);
  const [salvandoChamada, setSalvandoChamada] = useState(false);

  // Filtros da aba Panorama & Histórico
  const [alunoFiltroId, setAlunoFiltroId] = useState('');

  // Ementa e Plano de Aula
  const [ementa, setEmenta] = useState('');
  const [salvandoEmenta, setSalvandoEmenta] = useState(false);
  const [tipoPlano, setTipoPlano] = useState('turma');
  const [tituloPlano, setTituloPlano] = useState('');
  const [conteudoPlano, setConteudoPlano] = useState('');

  // Mensagens recebidas dos alunos
  const [mensagens, setMensagens] = useState([]);
  const [respostaTexto, setRespostaTexto] = useState({});

  // =========================================================================
  // ESTADOS DA ABA EXCLUSIVA DE BOLSISTAS (AUTORIZADA PELA COORDENAÇÃO)
  // =========================================================================
  const [bolsistasLista, setBolsistasLista] = useState([]);
  const [bolsistaSelecionadoId, setBolsistaSelecionadoId] = useState('');
  const [avaliacoesBolsistas, setAvaliacoesBolsistas] = useState([]);
  const [atividadesBolsistas, setAtividadesBolsistas] = useState([]);

  // Formulário de lançamento de presença/atividade do bolsista
  const [dataAtivBolsista, setDataAtivBolsista] = useState(new Date().toISOString().split('T')[0]);
  const [tipoAtivBolsista, setTipoAtivBolsista] = useState('Apoio em Turma');
  const [descricaoAtivBolsista, setDescricaoAtivBolsista] = useState('');
  const [statusAtivBolsista, setStatusAtivBolsista] = useState('presente');

  // Formulário de avaliação de desempenho + anotação restrita ao Admin
  const [notaAssiduidade, setNotaAssiduidade] = useState(5);
  const [notaParticipacao, setNotaParticipacao] = useState(5);
  const [notaPontualidade, setNotaPontualidade] = useState(5);
  const [notaPostura, setNotaPostura] = useState(5);
  const [anotacaoAdmin, setAnotacaoAdmin] = useState('');
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState(false);

  const nomeProfessor = userData?.nome || user?.displayName || 'Professor(a)';
  const papeisUsuario = Array.isArray(userData?.roles) ? userData.roles : [userData?.role];
  const temAutorizacaoBolsistas =
    Boolean(userData?.podeAvaliarBolsistas) || papeisUsuario.includes('admin');

  const carregarDadosIniciais = async () => {
    setCarregando(true);
    try {
      const [cursosSnap, msgsSnap] = await Promise.all([
        getDocs(collection(db, 'cursos')),
        getDocs(collection(db, 'mensagens')),
      ]);

      const todosCursos = cursosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const minhasTurmas = todosCursos.filter(
        (c) => c.profId === user.uid || !c.profId
      );
      const idsMinhasTurmas = new Set(minhasTurmas.map((t) => t.id));

      const todasMsgs = msgsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const minhasMsgs = todasMsgs
        .filter(
          (m) =>
            m.destinatarioId === user.uid ||
            (m.cursoId && idsMinhasTurmas.has(m.cursoId))
        )
        .sort((a, b) => (b.dataEnvio || '').localeCompare(a.dataEnvio || ''));

      setCursos(minhasTurmas);
      setMensagens(minhasMsgs);

      if (temAutorizacaoBolsistas) {
        await carregarModuloBolsistas();
      }
    } catch (err) {
      console.error('Erro ao carregar painel do professor:', err);
    } finally {
      setCarregando(false);
    }
  };

  const carregarModuloBolsistas = async () => {
    try {
      const [usersSnap, avalSnap, ativSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'avaliacoes_bolsistas')),
        getDocs(collection(db, 'presencas_bolsistas')),
      ]);

      const todosUsuarios = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const apenasBolsistas = todosUsuarios.filter((u) => {
        const roles = Array.isArray(u.roles) ? u.roles : [u.role];
        return roles.includes('bolsista');
      });

      setBolsistasLista(apenasBolsistas);
      if (apenasBolsistas.length > 0 && !bolsistaSelecionadoId) {
        setBolsistaSelecionadoId(apenasBolsistas[0].id);
      }

      setAvaliacoesBolsistas(avalSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAtividadesBolsistas(ativSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Erro ao carregar dados dos bolsistas:', err);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      carregarDadosIniciais();
    }
  }, [user?.uid, temAutorizacaoBolsistas]);

  const carregarHistoricoPresencas = async (cursoId) => {
    const presSnap = await getDocs(
      query(collection(db, 'presencas'), where('cursoId', '==', cursoId))
    );
    const lista = presSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTodasPresencasTurma(lista);
    return lista;
  };

  const abrirTurma = async (curso) => {
    setCursoSelecionado(curso);
    setEmenta(curso.ementa || '');
    setSubAba('chamada');
    setAlunoFiltroId('');

    try {
      const [matSnap, planSnap, listaPresencas] = await Promise.all([
        getDocs(query(collection(db, 'matriculas'), where('cursoId', '==', curso.id))),
        getDocs(query(collection(db, 'planos_aula'), where('cursoId', '==', curso.id))),
        carregarHistoricoPresencas(curso.id),
      ]);

      const listaInscritos = matSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInscritos(listaInscritos);
      if (listaInscritos.length > 0) {
        setAlunoFiltroId(listaInscritos[0].alunoId);
      }
      setPlanos(planSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const mapaPresenca = {};
      listaPresencas
        .filter((p) => p.data === dataChamada)
        .forEach((p) => {
          mapaPresenca[p.userId] = { id: p.id, status: p.status };
        });
      setPresencasHoje(mapaPresenca);
    } catch (err) {
      console.error('Erro ao abrir turma:', err);
    }
  };

  useEffect(() => {
    if (!cursoSelecionado) return;
    const mapa = {};
    todasPresencasTurma
      .filter((p) => p.data === dataChamada)
      .forEach((p) => {
        mapa[p.userId] = { id: p.id, status: p.status };
      });
    setPresencasHoje(mapa);
  }, [dataChamada, todasPresencasTurma, cursoSelecionado]);

  const marcarPresencaAluno = (alunoId, status) => {
    setPresencasHoje((prev) => ({
      ...prev,
      [alunoId]: { ...(prev[alunoId] || {}), status },
    }));
  };

  const handleSalvarChamada = async () => {
    if (!cursoSelecionado || inscritos.length === 0) return;
    setSalvandoChamada(true);
    try {
      for (const aluno of inscritos) {
        const registro = presencasHoje[aluno.alunoId];
        if (!registro?.status) continue;

        if (registro.id) {
          await updateDoc(doc(db, 'presencas', registro.id), {
            status: registro.status,
            registradoPor: nomeProfessor,
            atualizadoEm: new Date().toISOString(),
          });
        } else {
          await addDoc(collection(db, 'presencas'), {
            cursoId: cursoSelecionado.id,
            cursoTitulo: cursoSelecionado.titulo,
            userId: aluno.alunoId,
            userName: aluno.alunoNome,
            roleParticipante: aluno.roleParticipante || 'aluno',
            data: dataChamada,
            status: registro.status,
            tipoRegistro: 'chamada_professor',
            registradoPor: nomeProfessor,
            criadoEm: new Date().toISOString(),
          });
        }
      }
      await carregarHistoricoPresencas(cursoSelecionado.id);
      alert(`Lista de chamada do dia ${dataChamada.split('-').reverse().join('/')} salva com sucesso!`);
    } catch (err) {
      alert('Erro ao salvar chamada: ' + err.message);
    } finally {
      setSalvandoChamada(false);
    }
  };

  const handleSalvarEmenta = async (e) => {
    e.preventDefault();
    if (!cursoSelecionado) return;
    setSalvandoEmenta(true);
    try {
      await updateDoc(doc(db, 'cursos', cursoSelecionado.id), { ementa });
      alert('Ementa atualizada com sucesso!');
      carregarDadosIniciais();
    } catch (err) {
      alert('Erro ao salvar ementa: ' + err.message);
    } finally {
      setSalvandoEmenta(false);
    }
  };

  const handleCriarPlano = async (e) => {
    e.preventDefault();
    if (!cursoSelecionado) return;
    try {
      await addDoc(collection(db, 'planos_aula'), {
        cursoId: cursoSelecionado.id,
        profId: user.uid,
        profNome: nomeProfessor,
        tipo: tipoPlano,
        titulo: tituloPlano,
        conteudo: conteudoPlano,
        dataCriacao: new Date().toISOString().split('T')[0],
      });
      setTituloPlano('');
      setConteudoPlano('');
      abrirTurma(cursoSelecionado);
    } catch (err) {
      alert('Erro ao registrar plano: ' + err.message);
    }
  };

  const handleResponderMensagem = async (msgId) => {
    const texto = (respostaTexto[msgId] || '').trim();
    if (!texto) return;
    try {
      await updateDoc(doc(db, 'mensagens', msgId), {
        resposta: texto,
        respondidoPor: nomeProfessor,
        dataResposta: new Date().toISOString(),
        lida: true,
      });
      setRespostaTexto((prev) => ({ ...prev, [msgId]: '' }));
      carregarDadosIniciais();
    } catch (err) {
      alert('Erro ao enviar resposta: ' + err.message);
    }
  };

  // =========================================================================
  // HANDLERS DA AVALIAÇÃO E PRESENÇA DE BOLSISTAS
  // =========================================================================
  const handleRegistrarAtividadeBolsista = async (e) => {
    e.preventDefault();
    const bolsistaObj = bolsistasLista.find((b) => b.id === bolsistaSelecionadoId);
    if (!bolsistaObj) return;

    try {
      await addDoc(collection(db, 'presencas_bolsistas'), {
        bolsistaId: bolsistaObj.id,
        bolsistaNome: bolsistaObj.nome,
        data: dataAtivBolsista,
        tipoAtividade: tipoAtivBolsista,
        descricao: descricaoAtivBolsista,
        status: statusAtivBolsista,
        lancadoPorId: user.uid,
        lancadoPorNome: nomeProfessor,
        criadoEm: new Date().toISOString(),
      });
      setDescricaoAtivBolsista('');
      await carregarModuloBolsistas();
      alert('Presença/atividade do bolsista registrada com sucesso!');
    } catch (err) {
      alert('Erro ao registrar presença do bolsista: ' + err.message);
    }
  };

  const handleSalvarAvaliacaoBolsista = async (e) => {
    e.preventDefault();
    const bolsistaObj = bolsistasLista.find((b) => b.id === bolsistaSelecionadoId);
    if (!bolsistaObj) return;

    setSalvandoAvaliacao(true);
    const mediaGeral = Number(
      ((Number(notaAssiduidade) + Number(notaParticipacao) + Number(notaPontualidade) + Number(notaPostura)) / 4).toFixed(1)
    );

    try {
      await addDoc(collection(db, 'avaliacoes_bolsistas'), {
        bolsistaId: bolsistaObj.id,
        bolsistaNome: bolsistaObj.nome,
        assiduidade: Number(notaAssiduidade),
        participacao: Number(notaParticipacao),
        pontualidade: Number(notaPontualidade),
        postura: Number(notaPostura),
        mediaGeral,
        anotacaoRestritaAdmin: anotacaoAdmin.trim(),
        visivelApenasAdmin: true,
        avaliadorId: user.uid,
        avaliadorNome: nomeProfessor,
        dataAvaliacao: new Date().toISOString(),
      });
      setAnotacaoAdmin('');
      await carregarModuloBolsistas();
      alert('Avaliação de desempenho registrada! A anotação foi gravada com sua assinatura para a Coordenação.');
    } catch (err) {
      alert('Erro ao salvar avaliação: ' + err.message);
    } finally {
      setSalvandoAvaliacao(false);
    }
  };

  // =========================================================================
  // CÁLCULOS DE PANORAMA GERAL, POR DATA E POR ALUNO
  // =========================================================================
  const datasUnicasOrdenadas = [...new Set(todasPresencasTurma.map((p) => p.data))].sort(
    (a, b) => b.localeCompare(a)
  );

  const totalRegistrosPresentes = todasPresencasTurma.filter((p) => p.status === 'presente').length;
  const taxaGeralTurma =
    todasPresencasTurma.length > 0
      ? Math.round((totalRegistrosPresentes / todasPresencasTurma.length) * 100)
      : 0;

  const resumoPorAluno = inscritos.map((aluno) => {
    const regs = todasPresencasTurma.filter((p) => p.userId === aluno.alunoId);
    const presencas = regs.filter((p) => p.status === 'presente').length;
    const faltas = regs.filter((p) => p.status === 'falta').length;
    const total = presencas + faltas;
    const percentual = total > 0 ? Math.round((presencas / total) * 100) : 0;

    return {
      ...aluno,
      presencas,
      faltas,
      total,
      percentual,
      historicoDatas: regs.sort((a, b) => b.data.localeCompare(a.data)),
    };
  });

  const alunoSelecionadoDetalhes =
    resumoPorAluno.find((a) => a.alunoId === alunoFiltroId) || resumoPorAluno[0] || null;

  const bolsistaAtivo = bolsistasLista.find((b) => b.id === bolsistaSelecionadoId) || null;
  const atividadesDoBolsista = atividadesBolsistas
    .filter((a) => a.bolsistaId === bolsistaSelecionadoId)
    .sort((a, b) => b.data.localeCompare(a.data));
  const avaliacoesDoBolsista = avaliacoesBolsistas
    .filter((av) => av.bolsistaId === bolsistaSelecionadoId)
    .sort((a, b) => (b.dataAvaliacao || '').localeCompare(a.dataAvaliacao || ''));

  const mediaAcumuladaBolsista =
    avaliacoesDoBolsista.length > 0
      ? (
          avaliacoesDoBolsista.reduce((acc, item) => acc + Number(item.mediaGeral || 0), 0) /
          avaliacoesDoBolsista.length
        ).toFixed(1)
      : '—';

  const presencasBolsistaCount = atividadesDoBolsista.filter((a) => a.status === 'presente').length;
  const taxaPresencaBolsista =
    atividadesDoBolsista.length > 0
      ? Math.round((presencasBolsistaCount / atividadesDoBolsista.length) * 100)
      : 0;

  const naoLidas = mensagens.filter((m) => !m.lida).length;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-12">
      {/* Barra Superior Institucional */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-studio.png" alt="No Compasso" className="h-10 w-10 object-contain" />
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-[#D81B60]">
                Área Pedagógica • Professor(a)
              </span>
              <h1 className="text-base sm:text-lg font-bold uppercase font-condensed text-[#4A041C]">
                No Compasso Studio de Dança
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs font-semibold text-zinc-600">
              Olá, <strong>{nomeProfessor}</strong>
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Navegação Principal (Minhas Turmas vs Avaliação de Bolsistas se autorizado) */}
        {!cursoSelecionado && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAbaPrincipal('turmas')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition ${
                abaPrincipal === 'turmas'
                  ? 'bg-[#4A041C] text-white shadow-sm'
                  : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              <BookOpen size={16} /> Minhas Turmas & Diário
            </button>

            {temAutorizacaoBolsistas && (
              <button
                onClick={() => setAbaPrincipal('bolsistas')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition ${
                  abaPrincipal === 'bolsistas'
                    ? 'bg-gradient-to-r from-[#4A041C] to-[#D81B60] text-white shadow-sm'
                    : 'bg-white text-[#4A041C] border border-[#D81B60]/40 hover:bg-pink-50'
                }`}
              >
                <Award size={16} /> Avaliação & Frequência de Bolsistas
              </button>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA EXCLUSIVA: GESTÃO E AVALIAÇÃO DE BOLSISTAS (PERFIL AUTORIZADO)    */}
        {/* ===================================================================== */}
        {abaPrincipal === 'bolsistas' && temAutorizacaoBolsistas && !cursoSelecionado && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-[#2D0210] via-[#4A041C] to-[#880E4F] rounded-2xl p-6 text-white shadow-md">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[#E5C17B] text-[10px] font-bold uppercase tracking-wider mb-2">
                <ShieldAlert size={12} /> Acesso Autorizado pela Coordenação
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold uppercase font-condensed">
                Acompanhamento & Avaliação de Bolsistas
              </h2>
              <p className="text-xs sm:text-sm text-pink-100 mt-1">
                Lance presenças nas atividades do estúdio, avalie desempenho e registre pareceres técnicos assinados (visíveis apenas para a Coordenação Geral).
              </p>
            </div>

            {bolsistasLista.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-500">
                Nenhum usuário com perfil de Bolsista cadastrado no sistema ainda.
              </div>
            ) : (
              <>
                {/* Seletor de Bolsista + Resumo de Desempenho */}
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  <div className="lg:col-span-5">
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
                      Selecione o(a) Bolsista
                    </label>
                    <select
                      value={bolsistaSelecionadoId}
                      onChange={(e) => setBolsistaSelecionadoId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-3 text-sm font-bold text-[#4A041C]"
                    >
                      {bolsistasLista.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-7 grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="block text-[10px] font-bold uppercase text-zinc-500">Frequência Atividades</span>
                      <span className="text-2xl font-bold font-condensed text-emerald-700">
                        {taxaPresencaBolsista}%
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="block text-[10px] font-bold uppercase text-zinc-500">Média Geral (1 a 5)</span>
                      <span className="text-2xl font-bold font-condensed text-[#D81B60]">
                        {mediaAcumuladaBolsista} ★
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="block text-[10px] font-bold uppercase text-zinc-500">Avaliações Feitas</span>
                      <span className="text-2xl font-bold font-condensed text-[#4A041C]">
                        {avaliacoesDoBolsista.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coluna 1: Lançar Presença em Atividades | Coluna 2: Avaliar Critérios + Parecer */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Lançar Presença nas Atividades */}
                  <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4 h-fit">
                    <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                      <CheckSquare size={18} className="text-[#D81B60]" /> Lançar Presença em Atividade
                    </h3>

                    <form onSubmit={handleRegistrarAtividadeBolsista} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data</label>
                          <input
                            type="date"
                            required
                            value={dataAtivBolsista}
                            onChange={(e) => setDataAtivBolsista(e.target.value)}
                            className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Situação</label>
                          <select
                            value={statusAtivBolsista}
                            onChange={(e) => setStatusAtivBolsista(e.target.value)}
                            className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-bold"
                          >
                            <option value="presente">✅ Presente</option>
                            <option value="falta">❌ Falta</option>
                            <option value="justificada">⚠️ Falta Justificada</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Tipo de Atividade</label>
                        <select
                          value={tipoAtivBolsista}
                          onChange={(e) => setTipoAtivBolsista(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                        >
                          <option value="Apoio em Turma">Apoio / Monitoria em Turma</option>
                          <option value="Treino / Ensaio Técnico">Treino / Ensaio Técnico</option>
                          <option value="Baile / Evento do Studio">Baile / Evento do Studio</option>
                          <option value="Reunião Pedagógica">Reunião Pedagógica</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                          Observação da Atividade (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Auxiliou na turma de Forró Iniciante..."
                          value={descricaoAtivBolsista}
                          onChange={(e) => setDescricaoAtivBolsista(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-xl bg-[#4A041C] py-3 text-xs font-bold uppercase text-white hover:bg-[#D81B60] transition"
                      >
                        Registrar Presença do Bolsista
                      </button>
                    </form>

                    {/* Histórico recente de atividades do bolsista */}
                    <div className="pt-4 border-t border-zinc-100 space-y-2">
                      <span className="block text-xs font-bold uppercase text-zinc-500">
                        Últimas Atividades ({atividadesDoBolsista.length})
                      </span>
                      {atividadesDoBolsista.length === 0 ? (
                        <p className="text-xs text-zinc-400">Nenhuma atividade lançada ainda.</p>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {atividadesDoBolsista.map((at) => (
                            <div key={at.id} className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-[#4A041C]">
                                  {at.data.split('-').reverse().join('/')} • {at.tipoAtividade}
                                </span>
                                <span
                                  className={
                                    at.status === 'presente'
                                      ? 'text-emerald-700'
                                      : at.status === 'falta'
                                      ? 'text-red-600'
                                      : 'text-amber-700'
                                  }
                                >
                                  {at.status.toUpperCase()}
                                </span>
                              </div>
                              {at.descricao && <p className="text-zinc-600 mt-1">{at.descricao}</p>}
                              <span className="block text-[10px] text-zinc-400 mt-1">
                                Lançado por: {at.lancadoPorNome}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Avaliar Desempenho + Anotação Restrita aos Administradores */}
                  <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-5">
                    <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                      <Star size={18} className="text-[#D81B60]" /> Avaliar Desempenho de {bolsistaAtivo?.nome}
                    </h3>

                    <form onSubmit={handleSalvarAvaliacaoBolsista} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: 'Assiduidade', val: notaAssiduidade, set: setNotaAssiduidade },
                          { label: 'Participação & Proatividade', val: notaParticipacao, set: setNotaParticipacao },
                          { label: 'Pontualidade', val: notaPontualidade, set: setNotaPontualidade },
                          { label: 'Comprometimento & Postura', val: notaPostura, set: setNotaPostura },
                        ].map((crit) => (
                          <div key={crit.label} className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
                            <div className="flex justify-between text-xs font-bold text-zinc-700 mb-2">
                              <span>{crit.label}</span>
                              <span className="text-[#D81B60]">{crit.val} / 5</span>
                            </div>
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4, 5].map((num) => (
                                <button
                                  type="button"
                                  key={num}
                                  onClick={() => crit.set(num)}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                                    crit.val >= num
                                      ? 'bg-[#D81B60] text-white border-[#D81B60]'
                                      : 'bg-white text-zinc-500 border-zinc-300'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-900">
                          <Lock size={14} className="text-amber-700" />
                          Anotação / Parecer Técnico (Visível APENAS para a Coordenação Geral)
                        </label>
                        <p className="text-[11px] text-amber-800">
                          Esta observação ficará registrada com o seu nome (<strong>{nomeProfessor}</strong>) e poderá ser lida exclusivamente pelos administradores do estúdio.
                        </p>
                        <textarea
                          rows="3"
                          required
                          placeholder="Descreva a evolução, postura em aula, pontos fortes ou pontos de atenção do bolsista..."
                          value={anotacaoAdmin}
                          onChange={(e) => setAnotacaoAdmin(e.target.value)}
                          className="w-full rounded-xl border border-amber-300 bg-white p-3 text-sm text-zinc-900"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={salvandoAvaliacao}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4A041C] to-[#D81B60] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:brightness-110"
                      >
                        <Save size={16} />
                        {salvandoAvaliacao ? 'Registrando Avaliação...' : 'Salvar Avaliação & Anotação Assinada'}
                      </button>
                    </form>

                    {/* Histórico de avaliações anteriores */}
                    <div className="pt-4 border-t border-zinc-100 space-y-3">
                      <span className="block text-xs font-bold uppercase text-zinc-500">
                        Histórico de Avaliações Registradas ({avaliacoesDoBolsista.length})
                      </span>

                      {avaliacoesDoBolsista.length === 0 ? (
                        <p className="text-xs text-zinc-400">Nenhuma avaliação registrada para este bolsista ainda.</p>
                      ) : (
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {avaliacoesDoBolsista.map((av) => (
                            <div key={av.id} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="font-bold text-[#4A041C]">
                                  Avaliador: {av.avaliadorNome}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-[#D81B60] text-white font-bold">
                                  Média: {av.mediaGeral} / 5
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600">
                                <span>Assiduidade: <strong>{av.assiduidade}</strong></span> •
                                <span>Participação: <strong>{av.participacao}</strong></span> •
                                <span>Pontualidade: <strong>{av.pontualidade}</strong></span> •
                                <span>Postura: <strong>{av.postura}</strong></span>
                              </div>
                              {av.anotacaoRestritaAdmin && (
                                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950">
                                  <strong>Parecer restrito à Coordenação:</strong> {av.anotacaoRestritaAdmin}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* ABA PADRÃO: MINHAS TURMAS E DIÁRIO DE CLASSE                          */}
        {/* ===================================================================== */}
        {abaPrincipal === 'turmas' && !cursoSelecionado && (
          <>
            <div className="bg-gradient-to-r from-[#2D0210] via-[#4A041C] to-[#880E4F] rounded-2xl p-6 text-white shadow-md">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#E5C17B]">
                Portal Docente
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold uppercase font-condensed mt-1">
                Minhas Turmas & Diário de Classe
              </h2>
              <p className="text-xs sm:text-sm text-pink-100 mt-1">
                Selecione uma turma abaixo para fazer a chamada, consultar o panorama de frequência ou registrar planos de aula.
              </p>
            </div>

            {carregando ? (
              <p className="text-sm text-zinc-500">Carregando suas turmas...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {cursos.map((curso) => (
                  <div
                    key={curso.id}
                    className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded bg-[#4A041C] text-white text-[10px] font-bold uppercase">
                          {curso.frente || 'Dança de Salão'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded bg-pink-50 text-[#D81B60] text-[10px] font-bold uppercase">
                          {curso.tipoLabel || curso.tipo}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold uppercase font-condensed text-zinc-900">
                        {curso.titulo}
                      </h3>
                      <div className="mt-3 space-y-1 text-xs text-zinc-600">
                        <p className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-[#D81B60]" /> {curso.dataInfo}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock size={14} className="text-[#D81B60]" /> {curso.horaInicio || '19:00'} às {curso.horarioFim || '21:00'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => abrirTurma(curso)}
                      className="mt-5 w-full rounded-xl bg-[#4A041C] py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#D81B60] transition"
                    >
                      Abrir Diário da Turma
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Caixa de Mensagens dos Alunos */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                  <MessageSquare size={20} className="text-[#D81B60]" /> Dúvidas e Mensagens dos Alunos
                </h3>
                {naoLidas > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-[#D81B60] text-white text-[11px] font-bold">
                    {naoLidas} nova(s)
                  </span>
                )}
              </div>

              {mensagens.length === 0 ? (
                <p className="text-sm text-zinc-400 py-4">Nenhuma mensagem enviada pelos alunos até o momento.</p>
              ) : (
                <div className="space-y-3">
                  {mensagens.map((msg) => (
                    <div key={msg.id} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#4A041C]">
                          {msg.remetenteNome} {msg.cursoTitulo ? `• Turma: ${msg.cursoTitulo}` : ''}
                        </span>
                        <span className="text-zinc-400">
                          {msg.dataEnvio ? new Date(msg.dataEnvio).toLocaleDateString('pt-BR') : ''}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-800">{msg.texto}</p>

                      {msg.resposta ? (
                        <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                          <strong>Sua resposta:</strong> {msg.resposta}
                        </div>
                      ) : (
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Escreva sua resposta para o aluno..."
                            value={respostaTexto[msg.id] || ''}
                            onChange={(e) =>
                              setRespostaTexto((prev) => ({ ...prev, [msg.id]: e.target.value }))
                            }
                            className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-xs bg-white"
                          />
                          <button
                            onClick={() => handleResponderMensagem(msg.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#4A041C] px-4 py-2 text-xs font-bold uppercase text-white hover:bg-[#D81B60]"
                          >
                            <Send size={13} /> Responder
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================================================================== */}
        {/* VISÃO INTERNA DA TURMA SELECIONADA                                    */}
        {/* ===================================================================== */}
        {cursoSelecionado && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
              <button
                onClick={() => setCursoSelecionado(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500 hover:text-[#4A041C] mb-3"
              >
                <ArrowLeft size={15} /> Voltar para minhas turmas
              </button>

              <h2 className="text-2xl sm:text-3xl font-bold uppercase font-condensed text-zinc-900">
                {cursoSelecionado.titulo}
              </h2>
              <p className="text-xs text-zinc-600 mt-1">
                {cursoSelecionado.dataInfo} • {cursoSelecionado.horaInicio || '19:00'} às {cursoSelecionado.horarioFim || '21:00'} • {inscritos.length} participante(s)
              </p>

              <div className="flex gap-2 mt-5 pt-4 border-t border-zinc-100 overflow-x-auto">
                <button
                  onClick={() => setSubAba('chamada')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
                    subAba === 'chamada' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <CheckSquare size={15} /> Lista de Chamada
                </button>
                <button
                  onClick={() => setSubAba('panorama')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
                    subAba === 'panorama' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <BarChart3 size={15} /> Panorama & Histórico ({datasUnicasOrdenadas.length} dias)
                </button>
                <button
                  onClick={() => setSubAba('planos')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
                    subAba === 'planos' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <FileText size={15} /> Planos de Aula ({planos.length})
                </button>
                <button
                  onClick={() => setSubAba('ementa')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
                    subAba === 'ementa' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  <BookOpen size={15} /> Ementa da Turma
                </button>
              </div>
            </div>

            {subAba === 'chamada' && (
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                      <Users size={20} className="text-[#D81B60]" /> Frequência da Aula
                    </h3>
                    <p className="text-xs text-zinc-500">Marque Presente ou Falta para cada participante da turma.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase text-zinc-600">Data da Aula:</label>
                    <input
                      type="date"
                      value={dataChamada}
                      onChange={(e) => setDataChamada(e.target.value)}
                      className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                </div>

                {inscritos.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-8 text-center">Nenhum aluno matriculado nesta turma ainda.</p>
                ) : (
                  <>
                    <div className="divide-y divide-zinc-100">
                      {inscritos.map((aluno) => {
                        const statusAtual = presencasHoje[aluno.alunoId]?.status || '';
                        return (
                          <div
                            key={aluno.id}
                            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-sm text-zinc-900">{aluno.alunoNome}</span>
                              <span className="ml-2 px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[10px] font-bold uppercase">
                                {aluno.roleParticipante || 'aluno'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => marcarPresencaAluno(aluno.alunoId, 'presente')}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold uppercase border transition ${
                                  statusAtual === 'presente'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-zinc-600 border-zinc-300 hover:bg-emerald-50'
                                }`}
                              >
                                <CheckCircle2 size={14} /> Presente
                              </button>
                              <button
                                type="button"
                                onClick={() => marcarPresencaAluno(aluno.alunoId, 'falta')}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold uppercase border transition ${
                                  statusAtual === 'falta'
                                    ? 'bg-red-600 text-white border-red-600'
                                    : 'bg-white text-zinc-600 border-zinc-300 hover:bg-red-50'
                                }`}
                              >
                                <XCircle size={14} /> Falta
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={salvandoChamada}
                      onClick={handleSalvarChamada}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#4A041C] px-6 py-3 text-xs font-bold uppercase text-white hover:bg-[#D81B60] transition"
                    >
                      <Save size={15} /> {salvandoChamada ? 'Salvando Frequência...' : 'Salvar Lista de Chamada'}
                    </button>
                  </>
                )}
              </div>
            )}

            {subAba === 'panorama' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-zinc-500">Aulas com Chamada</span>
                    <p className="text-3xl font-bold font-condensed text-[#4A041C] mt-1">
                      {datasUnicasOrdenadas.length} <span className="text-sm font-normal text-zinc-500">dia(s)</span>
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-zinc-500">Assiduidade Média da Turma</span>
                    <p className="text-3xl font-bold font-condensed text-emerald-700 mt-1">
                      {taxaGeralTurma}%
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                    <span className="text-[11px] font-bold uppercase text-zinc-500">Participantes Ativos</span>
                    <p className="text-3xl font-bold font-condensed text-[#D81B60] mt-1">
                      {inscritos.length} <span className="text-sm font-normal text-zinc-500">inscrito(s)</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                    <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] mb-4 flex items-center gap-2">
                      <BarChart3 size={18} className="text-[#D81B60]" /> Panorama Geral por Participante
                    </h3>

                    {resumoPorAluno.length === 0 ? (
                      <p className="text-sm text-zinc-400">Nenhum participante inscrito.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                              <th className="py-2 px-2">Participante</th>
                              <th className="py-2 px-2 text-center">Presenças</th>
                              <th className="py-2 px-2 text-center">Faltas</th>
                              <th className="py-2 px-2 text-right">Frequência</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {resumoPorAluno.map((al) => (
                              <tr
                                key={al.alunoId}
                                onClick={() => setAlunoFiltroId(al.alunoId)}
                                className={`cursor-pointer transition ${
                                  alunoSelecionadoDetalhes?.alunoId === al.alunoId
                                    ? 'bg-pink-50/70'
                                    : 'hover:bg-zinc-50'
                                }`}
                              >
                                <td className="py-3 px-2 font-semibold text-zinc-900">
                                  {al.alunoNome}
                                  <span className="block text-[10px] font-bold uppercase text-zinc-400">
                                    {al.roleParticipante || 'aluno'}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-center font-bold text-emerald-700">
                                  {al.presencas}
                                </td>
                                <td className="py-3 px-2 text-center font-bold text-red-600">
                                  {al.faltas}
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      al.percentual >= 75
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : al.total === 0
                                        ? 'bg-zinc-100 text-zinc-500'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {al.total === 0 ? 'Sem aulas' : `${al.percentual}%`}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                    <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                      <UserCheck size={18} className="text-[#D81B60]" /> Detalhe Específico por Aluno
                    </h3>

                    <select
                      value={alunoFiltroId}
                      onChange={(e) => setAlunoFiltroId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900"
                    >
                      {resumoPorAluno.map((a) => (
                        <option key={a.alunoId} value={a.alunoId}>
                          {a.alunoNome}
                        </option>
                      ))}
                    </select>

                    {alunoSelecionadoDetalhes ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                          <div>
                            <span className="block text-xs text-zinc-500">Aproveitamento Individual</span>
                            <strong className="text-lg font-condensed text-[#4A041C]">
                              {alunoSelecionadoDetalhes.presencas} presença(s) • {alunoSelecionadoDetalhes.faltas} falta(s)
                            </strong>
                          </div>
                          <span className="text-xl font-bold font-condensed text-[#D81B60]">
                            {alunoSelecionadoDetalhes.percentual}%
                          </span>
                        </div>

                        {alunoSelecionadoDetalhes.historicoDatas.length === 0 ? (
                          <p className="text-xs text-zinc-400 py-4 text-center">
                            Nenhum registro de presença ou falta para este participante ainda.
                          </p>
                        ) : (
                          <div className="divide-y divide-zinc-100 max-h-64 overflow-y-auto">
                            {alunoSelecionadoDetalhes.historicoDatas.map((reg) => (
                              <div key={reg.id} className="py-2.5 flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-700">
                                  📅 {reg.data.split('-').reverse().join('/')}
                                </span>
                                {reg.status === 'presente' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                    <CheckCircle2 size={12} /> Presente
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                                    <XCircle size={12} /> Falta
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
                  <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                    <Calendar size={18} className="text-[#D81B60]" /> Chamadas Realizadas por Dia
                  </h3>

                  {datasUnicasOrdenadas.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-4">
                      Nenhuma chamada registrada ainda nesta turma. Use a aba "Lista de Chamada" para fazer o primeiro registro.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {datasUnicasOrdenadas.map((dataIso) => {
                        const registrosDoDia = todasPresencasTurma.filter((p) => p.data === dataIso);
                        const qtdPresentes = registrosDoDia.filter((p) => p.status === 'presente').length;
                        const qtdFaltas = registrosDoDia.filter((p) => p.status === 'falta').length;

                        return (
                          <div
                            key={dataIso}
                            className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-[#4A041C]">
                                  📅 {dataIso.split('-').reverse().join('/')}
                                </span>
                                <span className="text-[11px] font-semibold text-zinc-500">
                                  {registrosDoDia.length} registro(s)
                                </span>
                              </div>

                              <div className="flex gap-3 mt-2 text-xs font-bold">
                                <span className="text-emerald-700">✅ {qtdPresentes} presente(s)</span>
                                <span className="text-red-600">❌ {qtdFaltas} falta(s)</span>
                              </div>

                              <div className="mt-2 pt-2 border-t border-zinc-200/80 space-y-1 max-h-28 overflow-y-auto">
                                {registrosDoDia.map((r) => (
                                  <div key={r.id} className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-700 truncate pr-2">{r.userName}</span>
                                    <span
                                      className={
                                        r.status === 'presente'
                                          ? 'text-emerald-700 font-bold'
                                          : 'text-red-600 font-bold'
                                      }
                                    >
                                      {r.status === 'presente' ? 'Presente' : 'Falta'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDataChamada(dataIso);
                                setSubAba('chamada');
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white py-1.5 text-[11px] font-bold uppercase text-zinc-700 hover:bg-[#4A041C] hover:text-white transition"
                            >
                              <Edit3 size={12} /> Editar Chamada deste Dia
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {subAba === 'planos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs h-fit">
                  <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] mb-3 flex items-center gap-1.5">
                    <Plus size={18} /> Novo Plano de Aula
                  </h3>
                  <form onSubmit={handleCriarPlano} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Categoria</label>
                      <select
                        value={tipoPlano}
                        onChange={(e) => setTipoPlano(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                      >
                        <option value="turma">Plano de Aula / Diário</option>
                        <option value="curso">Planejamento Geral do Curso</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Título / Conteúdo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Aula 03 - Giro e Musicalidade"
                        value={tituloPlano}
                        onChange={(e) => setTituloPlano(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Descrição / Passos</label>
                      <textarea
                        rows="5"
                        required
                        value={conteudoPlano}
                        onChange={(e) => setConteudoPlano(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[#D81B60] py-2.5 text-xs font-bold uppercase text-white hover:bg-[#AD1457]"
                    >
                      Salvar Plano
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 space-y-3">
                  {planos.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-400">
                      Nenhum plano registrado para esta turma ainda.
                    </div>
                  ) : (
                    planos.map((pl) => (
                      <div key={pl.id} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-0.5 rounded bg-pink-50 text-[#D81B60] text-[10px] font-bold uppercase">
                            {pl.tipo === 'curso' ? 'Planejamento Geral' : 'Plano de Aula'}
                          </span>
                          <span className="text-xs text-zinc-400">{pl.dataCriacao}</span>
                        </div>
                        <h4 className="font-bold text-zinc-900">{pl.titulo}</h4>
                        <p className="text-sm text-zinc-600 mt-2 whitespace-pre-line">{pl.conteudo}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {subAba === 'ementa' && (
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs max-w-3xl">
                <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C] mb-3">
                  Ementa Programática da Turma
                </h3>
                <form onSubmit={handleSalvarEmenta} className="space-y-4">
                  <textarea
                    rows="7"
                    value={ementa}
                    onChange={(e) => setEmenta(e.target.value)}
                    placeholder="Escreva ou atualize os objetivos técnicos, passos e metodologia desta turma..."
                    className="w-full rounded-xl border border-zinc-300 p-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={salvandoEmenta}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4A041C] px-5 py-2.5 text-xs font-bold uppercase text-white hover:bg-[#D81B60]"
                  >
                    <Save size={15} /> {salvandoEmenta ? 'Salvando...' : 'Salvar Ementa'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
