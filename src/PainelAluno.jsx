import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import {
  BookOpen,
  Calendar,
  Clock,
  Bell,
  BellRing,
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Ticket,
  UserCheck,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';

// Mapeia dias da semana para detectar automaticamente se há aula hoje
const DIAS_SEMANA_MAP = [
  { idx: 0, chaves: ['dom', 'domingo'] },
  { idx: 1, chaves: ['seg', 'segunda'] },
  { idx: 2, chaves: ['ter', 'terca', 'terça'] },
  { idx: 3, chaves: ['qua', 'quarta'] },
  { idx: 4, chaves: ['qui', 'quinta'] },
  { idx: 5, chaves: ['sex', 'sexta'] },
  { idx: 6, chaves: ['sab', 'sáb', 'sabado', 'sábado'] },
];

function verificarAulaProximaHoje(curso, agora) {
  if (!curso || !curso.dataInfo || !curso.horaInicio) return null;

  const diaAtualIdx = agora.getDay();
  const diaConfig = DIAS_SEMANA_MAP.find((d) => d.idx === diaAtualIdx);
  const textoDias = curso.dataInfo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const temAulaHoje = diaConfig?.chaves.some((chave) =>
    textoDias.includes(
      chave.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    )
  );

  if (!temAulaHoje) return null;

  const [hIni, mIni] = (curso.horaInicio || '19:00').split(':').map(Number);
  const [hFim, mFim] = (curso.horarioFim || '21:00').split(':').map(Number);

  const inicioHoje = new Date(agora);
  inicioHoje.setHours(hIni, mIni, 0, 0);

  const fimHoje = new Date(agora);
  fimHoje.setHours(hFim, mFim, 0, 0);

  const diffMinutos = Math.round((inicioHoje.getTime() - agora.getTime()) / 60000);

  // Alerta se faltar entre 0 e 90 minutos para começar, ou se já estiver em andamento
  if (diffMinutos >= 0 && diffMinutos <= 90) {
    return {
      status: 'em_breve',
      minutos: diffMinutos,
      texto:
        diffMinutos === 0
          ? 'Sua aula está começando agora!'
          : `Sua aula começa em ${diffMinutos} minuto(s) (${curso.horaInicio})!`,
    };
  }

  if (agora >= inicioHoje && agora <= fimHoje) {
    return {
      status: 'andamento',
      minutos: 0,
      texto: `Aula em andamento agora (até ${curso.horarioFim || '21:00'})!`,
    };
  }

  return {
    status: 'hoje_mais_tarde',
    minutos: diffMinutos,
    texto: `Você tem aula hoje às ${curso.horaInicio}.`,
  };
}

export default function PainelAluno() {
  const { user, userData } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('turmas'); // 'turmas' | 'novidades' | 'fale_conosco'
  const [carregando, setCarregando] = useState(true);

  const [minhasMatriculas, setMinhasMatriculas] = useState([]);
  const [todosCursos, setTodosCursos] = useState([]);
  const [todosEventos, setTodosEventos] = useState([]);
  const [minhasMensagens, setMinhasMensagens] = useState([]);

  // Relógio em tempo real para avisos de aula
  const [agora, setAgora] = useState(new Date());
  const [permissaoNotif, setPermissaoNotif] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Estados do formulário Fale Conosco
  const [cursoMensagemId, setCursoMensagemId] = useState('');
  const [assuntoMensagem, setAssuntoMensagem] = useState('Dúvida sobre a aula / passos');
  const [textoMensagem, setTextoMensagem] = useState('');
  const [enviandoMsg, setEnviandoMsg] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const carregarDadosAluno = async () => {
    if (!user?.uid) return;
    setCarregando(true);
    try {
      const [matSnap, cursosSnap, eventosSnap, msgsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'matriculas'),
            where('alunoId', '==', user.uid)
          )
        ),
        getDocs(collection(db, 'cursos')),
        getDocs(collection(db, 'eventos')),
        getDocs(
          query(
            collection(db, 'mensagens_alunos'),
            where('alunoId', '==', user.uid)
          )
        ),
      ]);

      const mats = matSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.status !== 'cancelada');

      const cursosLista = cursosSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const eventosLista = eventosSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const msgsLista = msgsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));

      setMinhasMatriculas(mats);
      setTodosCursos(cursosLista);
      setTodosEventos(eventosLista);
      setMinhasMensagens(msgsLista);

      if (mats.length > 0 && !cursoMensagemId) {
        setCursoMensagemId(mats[0].cursoId);
      }
    } catch (err) {
      console.error('Erro ao carregar área do aluno:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosAluno();
  }, [user?.uid]);

  // Cruza matrículas com dados completos dos cursos
  const turmasMatriculadas = useMemo(() => {
    return minhasMatriculas
      .map((mat) => {
        const cursoObj = todosCursos.find((c) => c.id === mat.cursoId);
        if (!cursoObj) return null;
        return {
          ...cursoObj,
          matriculaId: mat.id,
          dataMatricula: mat.dataMatricula,
          alertaHoje: verificarAulaProximaHoje(cursoObj, agora),
        };
      })
      .filter(Boolean);
  }, [minhasMatriculas, todosCursos, agora]);

  // Notificações ativas de aulas prestes a começar
  const alertasAulaComecando = useMemo(() => {
    return turmasMatriculadas.filter(
      (t) =>
        t.alertaHoje &&
        (t.alertaHoje.status === 'em_breve' || t.alertaHoje.status === 'andamento')
    );
  }, [turmasMatriculadas]);

  // Atividades novas disponíveis para inscrição (cursos que o aluno ainda não faz + eventos públicos)
  const novasAtividades = useMemo(() => {
    const idsMatriculados = new Set(minhasMatriculas.map((m) => m.cursoId));

    const cursosAbertos = todosCursos
      .filter(
        (c) =>
          c.ativo !== false &&
          c.inscricaoAberta !== false &&
          !idsMatriculados.has(c.id)
      )
      .map((c) => ({
        ...c,
        categoriaItem: 'curso',
        badge: c.tipoLabel || 'Curso / Turma',
        subtituloData: `${c.dataInfo || ''} • ${c.horaInicio || '19:00'} às ${c.horarioFim || '21:00'}`,
        valorExibicao: Number(c.valor || 0),
      }));

    const eventosAbertos = todosEventos
      .filter((ev) => !ev.apenasEquipeBolsistas && ev.inscricaoAberta !== false)
      .map((ev) => {
        const primeiraData =
          Array.isArray(ev.sessoes) && ev.sessoes.length > 0
            ? ev.sessoes[0].data
            : ev.data;
        return {
          ...ev,
          categoriaItem: 'evento',
          badge: 'Evento / Espetáculo',
          subtituloData: primeiraData
            ? `${primeiraData.split('-').reverse().join('/')} • ${ev.local || 'Studio No Compasso'}`
            : ev.local || 'Studio No Compasso',
          valorExibicao: Number(ev.valorInteira ?? ev.valorIngresso ?? 0),
        };
      });

    return [...eventosAbertos, ...cursosAbertos];
  }, [todosCursos, todosEventos, minhasMatriculas]);

  const ativarNotificacoesNavegador = async () => {
    if (typeof Notification === 'undefined') {
      alert('Seu navegador não suporta notificações push locais.');
      return;
    }
    const perm = await Notification.requestPermission();
    setPermissaoNotif(perm);
    if (perm === 'granted') {
      new Notification('No Compasso Studio de Dança', {
        body: 'Lembretes ativados! Avisaremos quando sua aula estiver prestes a começar.',
      });
    }
  };

  const handleEnviarMensagemProfessor = async (e) => {
    e.preventDefault();
    if (!textoMensagem.trim()) return;

    const turmaAlvo = turmasMatriculadas.find((t) => t.id === cursoMensagemId);
    if (!turmaAlvo) {
      alert('Selecione uma turma matriculada para enviar a mensagem.');
      return;
    }

    setEnviandoMsg(true);
    try {
      await addDoc(collection(db, 'mensagens_alunos'), {
        alunoId: user.uid,
        alunoNome: userData?.nome || user.email,
        alunoTelefone: userData?.telefone || '',
        cursoId: turmaAlvo.id,
        cursoTitulo: turmaAlvo.titulo,
        profId: turmaAlvo.profId || '',
        profNome: turmaAlvo.professoresNomes || 'Professor(a) da Turma',
        assunto: assuntoMensagem,
        mensagem: textoMensagem.trim(),
        status: 'enviada',
        respostaProf: '',
        criadoEm: new Date().toISOString(),
      });

      setTextoMensagem('');
      alert(
        `✅ Mensagem enviada com sucesso para ${turmaAlvo.professoresNomes || 'o(a) professor(a)'}!`
      );
      carregarDadosAluno();
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message);
    } finally {
      setEnviandoMsg(false);
    }
  };

  if (carregando) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">
        Carregando seu painel do aluno...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* CABEÇALHO DE BOAS-VINDAS */}
      <div className="bg-gradient-to-r from-[#4A041C] to-[#D81B60] rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider mb-2">
            Área do Aluno • No Compasso
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-condensed uppercase">
            Olá, {userData?.nome?.split(' ')[0] || 'Dançarino(a)'}!
          </h2>
          <p className="text-xs sm:text-sm text-pink-100 mt-1">
            Acompanhe seus dias de aula, novidades do estúdio e fale direto com seus professores.
          </p>
        </div>

        {permissaoNotif !== 'granted' && (
          <button
            type="button"
            onClick={ativarNotificacoesNavegador}
            className="inline-flex items-center gap-2 rounded-xl bg-white text-[#4A041C] px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-pink-50 transition shrink-0 shadow"
          >
            <Bell size={16} className="text-[#D81B60]" />
            Ativar Alertas de Aula
          </button>
        )}
      </div>

      {/* BANNER DE NOTIFICAÇÃO QUANDO A AULA JÁ VAI COMEÇAR */}
      {alertasAulaComecando.length > 0 && (
        <div className="space-y-2">
          {alertasAulaComecando.map((alertaTurma) => (
            <div
              key={alertaTurma.id}
              className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-400 text-amber-950 shrink-0">
                  <BellRing size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Lembrete de Aula Hoje
                  </span>
                  <h3 className="text-base font-bold text-amber-950">
                    {alertaTurma.titulo} — {alertaTurma.alertaHoje.texto}
                  </h3>
                  <p className="text-xs text-amber-900">
                    Prof. {alertaTurma.professoresNomes} • Local: No Compasso Studio de Dança
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-amber-950 text-white text-xs font-bold uppercase self-start sm:self-center">
                {alertaTurma.horaInicio} às {alertaTurma.horarioFim || '21:00'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* NAVEGAÇÃO SIMPLIFICADA EM 3 ABAS */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
        <button
          type="button"
          onClick={() => setAbaAtiva('turmas')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase transition ${
            abaAtiva === 'turmas'
              ? 'bg-[#4A041C] text-white shadow'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <BookOpen size={16} />
          Minhas Turmas ({turmasMatriculadas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('novidades')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase transition ${
            abaAtiva === 'novidades'
              ? 'bg-[#D81B60] text-white shadow'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <Sparkles size={16} />
          Novas Atividades ({novasAtividades.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('fale_conosco')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold uppercase transition ${
            abaAtiva === 'fale_conosco'
              ? 'bg-[#4A041C] text-white shadow'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <MessageSquare size={16} />
          Fale Conosco
        </button>
      </div>

      {/* ===================================================================== */}
      {/* ABA 1: MINHAS TURMAS MATRICULADAS & DIAS DE AULA                      */}
      {/* ===================================================================== */}
      {abaAtiva === 'turmas' && (
        <div className="space-y-4">
          {turmasMatriculadas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-zinc-700">
                Você ainda não possui matrícula vinculada a nenhuma turma ativa.
              </p>
              <button
                type="button"
                onClick={() => setAbaAtiva('novidades')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D81B60] px-5 py-2.5 text-xs font-bold uppercase text-white hover:bg-[#AD1457]"
              >
                <Sparkles size={15} /> Ver Turmas & Atividades Abertas
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {turmasMatriculadas.map((turma) => (
                <div
                  key={turma.id}
                  className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {turma.cardUrl && (
                      <img
                        src={turma.cardUrl}
                        alt={turma.titulo}
                        className="w-full h-36 object-cover"
                      />
                    )}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-[#4A041C] text-white text-[10px] font-bold uppercase">
                          {turma.frente || 'Dança de Salão'} • {turma.estilo}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 size={12} /> Matriculado
                        </span>
                      </div>

                      <h3 className="text-xl font-bold font-condensed uppercase text-zinc-900">
                        {turma.titulo}
                      </h3>

                      <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 text-xs">
                        <p className="flex items-center gap-2 font-bold text-[#4A041C]">
                          <Calendar size={15} className="text-[#D81B60]" />
                          Dias de Aula: <span className="text-zinc-900">{turma.dataInfo}</span>
                        </p>
                        <p className="flex items-center gap-2 font-bold text-[#4A041C]">
                          <Clock size={15} className="text-[#D81B60]" />
                          Horário:{' '}
                          <span className="text-zinc-900">
                            {turma.horaInicio || '19:00'} às {turma.horarioFim || '21:00'}
                          </span>
                        </p>
                        <p className="flex items-center gap-2 text-zinc-600">
                          <UserCheck size={15} className="text-[#D81B60]" />
                          Professor(a): <strong>{turma.professoresNomes}</strong>
                        </p>
                      </div>

                      {turma.alertaHoje && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs font-bold text-amber-900 flex items-center gap-2">
                          <BellRing size={15} className="text-amber-600 shrink-0" />
                          <span>{turma.alertaHoje.texto}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => {
                        setCursoMensagemId(turma.id);
                        setAbaAtiva('fale_conosco');
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-300 py-2.5 text-xs font-bold uppercase text-zinc-700 hover:bg-[#4A041C] hover:text-white transition"
                    >
                      <MessageSquare size={14} />
                      Enviar Mensagem para {turma.professoresNomes?.split(' ')[0] || 'Prof.'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 2: ANÚNCIOS DE NOVAS ATIVIDADES & INSCRIÇÃO                       */}
      {/* ===================================================================== */}
      {abaAtiva === 'novidades' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C]">
              Novos Cursos, Workshops & Bailes do Studio
            </h3>
            <p className="text-xs text-zinc-500">
              Garanta sua vaga ou ingresso diretamente pelo link oficial de inscrição.
            </p>
          </div>

          {novasAtividades.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-sm text-zinc-500">
              Nenhuma nova atividade extra anunciada no momento. Fique de olho por aqui!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {novasAtividades.map((ativ) => (
                <div
                  key={ativ.id}
                  className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {ativ.cardUrl && (
                      <img
                        src={ativ.cardUrl}
                        alt={ativ.titulo}
                        className="w-full h-44 object-cover"
                      />
                    )}
                    <div className="p-5 space-y-2.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase text-white ${
                          ativ.categoriaItem === 'evento' ? 'bg-[#D81B60]' : 'bg-[#4A041C]'
                        }`}
                      >
                        {ativ.badge}
                      </span>

                      <h4 className="text-xl font-bold font-condensed uppercase text-zinc-900">
                        {ativ.titulo}
                      </h4>

                      <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                        {ativ.categoriaItem === 'evento' ? (
                          <MapPin size={14} className="text-[#D81B60]" />
                        ) : (
                          <Calendar size={14} className="text-[#D81B60]" />
                        )}
                        {ativ.subtituloData}
                      </p>

                      {(ativ.ementa || ativ.descricao) && (
                        <p className="text-xs text-zinc-500 line-clamp-3">
                          {ativ.ementa || ativ.descricao}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-5 pt-0 flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-zinc-400">
                        Investimento
                      </span>
                      <strong className="text-base font-bold text-[#4A041C]">
                        {ativ.valorExibicao === 0
                          ? 'Gratuito'
                          : `R$ ${ativ.valorExibicao.toFixed(2).replace('.', ',')}`}
                      </strong>
                    </div>

                    <Link
                      to={`/inscricao/${ativ.categoriaItem}/${ativ.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] px-4 py-2.5 text-xs font-bold uppercase text-white shadow-sm transition"
                    >
                      {ativ.categoriaItem === 'evento' ? (
                        <>
                          <Ticket size={15} /> Comprar Ingresso
                        </>
                      ) : (
                        <>
                          Inscrever-se <ExternalLink size={14} />
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 3: FALE CONOSCO (MENSAGEM DIRETA PARA O PROFESSOR DA TURMA)       */}
      {/* ===================================================================== */}
      {abaAtiva === 'fale_conosco' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit space-y-4">
            <div className="flex items-center gap-2 text-[#4A041C]">
              <MessageSquare size={20} className="text-[#D81B60]" />
              <h3 className="text-lg font-bold uppercase font-condensed">
                Fale com o Professor da Sua Turma
              </h3>
            </div>

            {turmasMatriculadas.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Você precisa estar matriculado em uma turma para enviar mensagens diretas ao professor responsável.
              </p>
            ) : (
              <form onSubmit={handleEnviarMensagemProfessor} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Selecione sua Turma
                  </label>
                  <select
                    value={cursoMensagemId}
                    onChange={(e) => setCursoMensagemId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900"
                  >
                    {turmasMatriculadas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titulo} — Prof. {t.professoresNomes}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Assunto
                  </label>
                  <select
                    value={assuntoMensagem}
                    onChange={(e) => setAssuntoMensagem(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  >
                    <option value="Dúvida sobre a aula / passos">Dúvida sobre a aula / passos</option>
                    <option value="Aviso de ausência / atraso">Aviso de ausência / atraso</option>
                    <option value="Ensaios / Coreografia">Ensaios / Coreografia</option>
                    <option value="Outro assunto">Outro assunto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Mensagem para o Professor
                  </label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Escreva sua dúvida ou recado aqui..."
                    value={textoMensagem}
                    onChange={(e) => setTextoMensagem(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviandoMsg}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] py-3 text-xs font-bold uppercase tracking-wider text-white transition shadow"
                >
                  <Send size={15} />
                  {enviandoMsg ? 'Enviando...' : 'Enviar Mensagem ao Professor'}
                </button>
              </form>
            )}
          </div>

          {/* HISTÓRICO DE MENSAGENS ENVIADAS */}
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900">
              Mensagens Enviadas ({minhasMensagens.length})
            </h3>

            {minhasMensagens.length === 0 ? (
              <p className="text-xs text-zinc-400 py-8 text-center">
                Você ainda não enviou nenhuma mensagem aos professores.
              </p>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto">
                {minhasMensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#4A041C]">{msg.cursoTitulo}</span>
                      <span className="text-[10px] text-zinc-400">
                        {msg.criadoEm
                          ? new Date(msg.criadoEm).toLocaleDateString('pt-BR')
                          : ''}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-[#D81B60]">
                      Para: Prof. {msg.profNome} • {msg.assunto}
                    </p>
                    <p className="text-zinc-800 bg-white p-2.5 rounded-lg border border-zinc-200">
                      {msg.mensagem}
                    </p>
                    {msg.respostaProf && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                        <strong className="block text-[10px] uppercase text-emerald-800">
                          Resposta do Professor:
                        </strong>
                        {msg.respostaProf}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
