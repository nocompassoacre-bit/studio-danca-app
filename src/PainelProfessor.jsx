import { useState, useEffect } from 'react';
import {
  addDoc, collection, doc, getDocs, query, updateDoc, where
} from 'firebase/firestore';
import {
  BookOpen, Users, CheckSquare, FileText, MessageSquare,
  Calendar, Clock, Plus, Save, CheckCircle2, XCircle, Send, LogOut, ArrowLeft
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';

export default function PainelProfessor() {
  const { user, userData, logout } = useAuth();
  const [cursos, setCursos] = useState([]);
  const [cursoSelecionado, setCursoSelecionado] = useState(null);
  const [subAba, setSubAba] = useState('chamada');
  const [carregando, setCarregando] = useState(true);

  // Dados da turma aberta
  const [inscritos, setInscritos] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [presencasHoje, setPresencasHoje] = useState({});
  const [dataChamada, setDataChamada] = useState(new Date().toISOString().split('T')[0]);
  const [salvandoChamada, setSalvandoChamada] = useState(false);

  // Ementa e Plano de Aula
  const [ementa, setEmenta] = useState('');
  const [salvandoEmenta, setSalvandoEmenta] = useState(false);
  const [tipoPlano, setTipoPlano] = useState('turma');
  const [tituloPlano, setTituloPlano] = useState('');
  const [conteudoPlano, setConteudoPlano] = useState('');

  // Mensagens recebidas dos alunos
  const [mensagens, setMensagens] = useState([]);
  const [respostaTexto, setRespostaTexto] = useState({});

  const nomeProfessor = userData?.nome || user?.displayName || 'Professor(a)';

  const carregarTurmasEMensagens = async () => {
    setCarregando(true);
    try {
      const [cursosSnap, msgsSnap] = await Promise.all([
        getDocs(collection(db, 'cursos')),
        getDocs(query(collection(db, 'mensagens'), where('destinatarioId', '==', user.uid))),
      ]);

      const todosCursos = cursosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Filtra turmas onde o professor é o titular ou turmas abertas da equipe
      const minhasTurmas = todosCursos.filter(
        (c) => c.profId === user.uid || !c.profId
      );

      setCursos(minhasTurmas);
      setMensagens(msgsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Erro ao carregar painel do professor:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      carregarTurmasEMensagens();
    }
  }, [user?.uid]);

  const abrirTurma = async (curso) => {
    setCursoSelecionado(curso);
    setEmenta(curso.ementa || '');
    setSubAba('chamada');

    try {
      const [matSnap, planSnap, presSnap] = await Promise.all([
        getDocs(query(collection(db, 'matriculas'), where('cursoId', '==', curso.id))),
        getDocs(query(collection(db, 'planos_aula'), where('cursoId', '==', curso.id))),
        getDocs(
          query(
            collection(db, 'presencas'),
            where('cursoId', '==', curso.id),
            where('data', '==', dataChamada)
          )
        ),
      ]);

      const listaInscritos = matSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInscritos(listaInscritos);
      setPlanos(planSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const mapaPresenca = {};
      presSnap.docs.forEach((d) => {
        const p = d.data();
        mapaPresenca[p.userId] = { id: d.id, status: p.status };
      });
      setPresencasHoje(mapaPresenca);
    } catch (err) {
      console.error('Erro ao abrir turma:', err);
    }
  };

  // Recarrega presenças quando o professor troca a data da chamada
  useEffect(() => {
    if (!cursoSelecionado) return;
    const atualizarPresencasData = async () => {
      const presSnap = await getDocs(
        query(
          collection(db, 'presencas'),
          where('cursoId', '==', cursoSelecionado.id),
          where('data', '==', dataChamada)
        )
      );
      const mapa = {};
      presSnap.docs.forEach((d) => {
        const p = d.data();
        mapa[p.userId] = { id: d.id, status: p.status };
      });
      setPresencasHoje(mapa);
    };
    atualizarPresencasData();
  }, [dataChamada, cursoSelecionado]);

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
      carregarTurmasEMensagens();
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
      carregarTurmasEMensagens();
    } catch (err) {
      alert('Erro ao enviar resposta: ' + err.message);
    }
  };

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
        {!cursoSelecionado ? (
          <>
            {/* Visão Geral das Turmas do Professor */}
            <div className="bg-gradient-to-r from-[#2D0210] via-[#4A041C] to-[#880E4F] rounded-2xl p-6 text-white shadow-md">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#E5C17B]">
                Portal Docente
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold uppercase font-condensed mt-1">
                Minhas Turmas & Diário de Classe
              </h2>
              <p className="text-xs sm:text-sm text-pink-100 mt-1">
                Selecione uma turma abaixo para fazer a chamada, atualizar a ementa ou registrar planos de aula.
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
        ) : (
          /* VISÃO INTERNA DA TURMA SELECIONADA */
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
                    subAba === 'chamada' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <CheckSquare size={15} /> Lista de Chamada
                </button>
                <button
                  onClick={() => setSubAba('planos')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
                    subAba === 'planos' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <FileText size={15} /> Planos de Aula ({planos.length})
                </button>
                <button
                  onClick={() => setSubAba('ementa')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
                    subAba === 'ementa' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <BookOpen size={15} /> Ementa da Turma
                </button>
              </div>
            </div>

            {/* SUB-ABA: LISTA DE CHAMADA */}
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

            {/* SUB-ABA: PLANOS DE AULA */}
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

            {/* SUB-ABA: EMENTA */}
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
