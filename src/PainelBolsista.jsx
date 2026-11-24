import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import {
  LogOut,
  Award,
  Clock,
  CheckSquare,
  TrendingUp,
  BookOpen,
  UserCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import SegurancaSenhaCard from './SegurancaSenhaCard';

function calcularVigenciaBolsa(dataInicio, vigenciaMeses, dataFimExplicita) {
  if (!dataInicio && !dataFimExplicita) return null;

  let dataFimObj = null;
  if (dataFimExplicita) {
    dataFimObj = new Date(dataFimExplicita + 'T23:59:59');
  } else if (dataInicio && vigenciaMeses) {
    dataFimObj = new Date(dataInicio + 'T00:00:00');
    dataFimObj.setMonth(dataFimObj.getMonth() + Number(vigenciaMeses));
  }

  if (!dataFimObj || isNaN(dataFimObj.getTime())) return null;

  const hoje = new Date();
  const inicioObj = dataInicio ? new Date(dataInicio + 'T00:00:00') : hoje;

  const diffMs = dataFimObj.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const totalDuracaoMs = Math.max(1, dataFimObj.getTime() - inicioObj.getTime());
  const decorridoMs = Math.max(0, hoje.getTime() - inicioObj.getTime());
  const percentualConcluido = Math.min(
    100,
    Math.max(0, Math.round((decorridoMs / totalDuracaoMs) * 100))
  );

  const mesesRestantes = Math.floor(Math.abs(diasRestantes) / 30);
  const diasSobra = Math.abs(diasRestantes) % 30;

  let textoTempo = '';
  if (diasRestantes < 0) {
    textoTempo = `Ciclo encerrado há ${Math.abs(diasRestantes)} dia(s)`;
  } else if (diasRestantes === 0) {
    textoTempo = 'Último dia da vigência atual';
  } else if (mesesRestantes > 0) {
    textoTempo = `Restam ${mesesRestantes} mês(es) e ${diasSobra} dia(s)`;
  } else {
    textoTempo = `Restam ${diasRestantes} dia(s)`;
  }

  return {
    dataFimBr: dataFimObj.toLocaleDateString('pt-BR'),
    diasRestantes,
    percentualConcluido,
    textoTempo,
    expirada: diasRestantes < 0,
    alertaProximo: diasRestantes >= 0 && diasRestantes <= 30,
  };
}

export default function PainelBolsista() {
  const { user, userData, logout } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('visao_geral');
  const [carregando, setCarregando] = useState(true);

  const [presencas, setPresencas] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [cursos, setCursos] = useState([]);

  // Formulário de Check-in / Registro de Atividade
  const [dataAtividade, setDataAtividade] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [tipoAtividade, setTipoAtividade] = useState('Apoio em Turma');
  const [descricaoAtividade, setDescricaoAtividade] = useState('');
  const [registrandoCheckin, setRegistrandoCheckin] = useState(false);

  const carregarDadosBolsista = async () => {
    if (!user?.uid) return;
    setCarregando(true);
    try {
      const resultados = await Promise.allSettled([
        getDocs(
          query(
            collection(db, 'presencas_bolsistas'),
            where('bolsistaId', '==', user.uid)
          )
        ),
        getDocs(
          query(
            collection(db, 'avaliacoes_bolsistas'),
            where('bolsistaId', '==', user.uid)
          )
        ),
        getDocs(collection(db, 'cursos')),
      ]);

      const extrair = (res) =>
        res.status === 'fulfilled'
          ? res.value.docs.map((d) => ({ id: d.id, ...d.data() }))
          : [];

      const listaPres = extrair(resultados[0]).sort((a, b) =>
        (b.data || '').localeCompare(a.data || '')
      );
      const listaAval = extrair(resultados[1]).sort((a, b) =>
        (b.dataAvaliacao || '').localeCompare(a.dataAvaliacao || '')
      );
      const listaCursos = extrair(resultados[2]).filter((c) => c.ativo !== false);

      setPresencas(listaPres);
      setAvaliacoes(listaAval);
      setCursos(listaCursos);
    } catch (err) {
      console.error('Erro ao carregar portal do bolsista:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosBolsista();
  }, [user?.uid]);

  const handleRegistrarPresenca = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;
    setRegistrandoCheckin(true);
    try {
      await addDoc(collection(db, 'presencas_bolsistas'), {
        bolsistaId: user.uid,
        bolsistaNome: userData?.nome || 'Bolsista',
        data: dataAtividade,
        tipoAtividade,
        descricao: descricaoAtividade.trim(),
        status: 'presente',
        lancadoPorId: user.uid,
        lancadoPorNome: `${userData?.nome || 'Bolsista'} (Auto Check-in)`,
        criadoEm: new Date().toISOString(),
      });
      setDescricaoAtividade('');
      alert('✅ Presença registrada com sucesso!');
      carregarDadosBolsista();
    } catch (err) {
      alert('Erro ao registrar presença: ' + err.message);
    } finally {
      setRegistrandoCheckin(false);
    }
  };

  // Indicadores calculados
  const vigencia = calcularVigenciaBolsa(
    userData?.dataEntradaBolsa,
    userData?.vigenciaBolsaMeses,
    userData?.dataFimBolsa
  );

  const qtdPresente = presencas.filter((p) => p.status === 'presente').length;
  const taxaFrequencia =
    presencas.length > 0
      ? Math.round((qtdPresente / presencas.length) * 100)
      : null;

  const mediaGeral =
    avaliacoes.length > 0
      ? (
          avaliacoes.reduce((acc, item) => acc + Number(item.mediaGeral || 0), 0) /
          avaliacoes.length
        ).toFixed(1)
      : null;

  // Médias por critério
  const calcMediaCriterio = (campo) => {
    if (avaliacoes.length === 0) return null;
    const soma = avaliacoes.reduce((acc, a) => acc + Number(a[campo] || 0), 0);
    return (soma / avaliacoes.length).toFixed(1);
  };

  const mediasCriterios = [
    { label: 'Assiduidade', valor: calcMediaCriterio('assiduidade') },
    { label: 'Participação', valor: calcMediaCriterio('participacao') },
    { label: 'Pontualidade', valor: calcMediaCriterio('pontualidade') },
    { label: 'Postura Técnica', valor: calcMediaCriterio('postura') },
  ];

  // Insight motivacional/técnico para o bolsista
  let feedbackBolsista =
    'Continue registrando suas presenças nas atividades para acompanhar sua evolução no studio.';
  if (mediaGeral !== null && taxaFrequencia !== null) {
    if (Number(mediaGeral) >= 4.5 && taxaFrequencia >= 85) {
      feedbackBolsista =
        'Excelente ritmo! Sua assiduidade e postura estão entre os destaques da equipe de bolsistas.';
    } else if (taxaFrequencia < 75) {
      feedbackBolsista =
        'Atenção à frequência: tente manter suas presenças acima de 80% nas monitorias e ensaios.';
    } else {
      feedbackBolsista =
        'Bom progresso! Mantenha a constância nas turmas de apoio e nos ensaios técnicos.';
    }
  }

  const abas = [
    { id: 'visao_geral', label: 'Minha Bolsa & Check-in', icon: Award },
    { id: 'desempenho', label: 'Minhas Avaliações', icon: TrendingUp },
    { id: 'turmas_perfil', label: 'Turmas & Conta', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900">
      {/* Cabeçalho Institucional */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="h-1.5 bg-gradient-to-r from-[#4A041C] via-[#D81B60] to-[#4A041C]" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-studio.png"
              alt="No Compasso"
              className="h-11 object-contain"
            />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700 block">
                Portal do Bolsista
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

        {/* Navegação por Abas */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-2 overflow-x-auto pb-3 pt-1">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {carregando ? (
          <div className="text-center py-20 text-zinc-500 font-semibold">
            Carregando seu portal...
          </div>
        ) : abaAtiva === 'visao_geral' ? (
          <div className="space-y-6">
            {/* Cards Superiores: Vigência + Frequência + Média */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card Vigência */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-cyan-800 flex items-center gap-1.5">
                  <Clock size={15} className="text-cyan-600" /> Vigência da Bolsa
                </span>
                <p className="text-base font-bold text-zinc-900">
                  {vigencia ? vigencia.textoTempo : 'Vigência em definição'}
                </p>
                {vigencia && (
                  <>
                    <div className="w-full h-2.5 rounded-full bg-zinc-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          vigencia.expirada
                            ? 'bg-red-600'
                            : vigencia.alertaProximo
                            ? 'bg-amber-500'
                            : 'bg-cyan-600'
                        }`}
                        style={{ width: `${vigencia.percentualConcluido}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Entrada:{' '}
                      {userData?.dataEntradaBolsa
                        ?.split('-')
                        .reverse()
                        .join('/') || '—'}{' '}
                      • Término: <strong>{vigencia.dataFimBr}</strong>
                    </p>
                  </>
                )}
              </div>

              {/* Card Taxa de Presença */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1.5">
                  <UserCheck size={15} className="text-emerald-600" /> Frequência em Atividades
                </span>
                <div className="my-2">
                  <strong className="text-3xl font-condensed text-emerald-900">
                    {taxaFrequencia !== null ? `${taxaFrequencia}%` : '—'}
                  </strong>
                  <span className="block text-xs text-zinc-500">
                    {qtdPresente} presença(s) em {presencas.length} atividade(s)
                  </span>
                </div>
              </div>

              {/* Card Média Geral */}
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase text-[#D81B60] flex items-center gap-1.5">
                  <Sparkles size={15} /> Índice de Desempenho
                </span>
                <div className="my-2">
                  <strong className="text-3xl font-condensed text-[#4A041C]">
                    {mediaGeral !== null ? `${mediaGeral} / 5.0` : 'Aguardando'}
                  </strong>
                  <span className="block text-xs text-zinc-500">
                    Baseado em {avaliacoes.length} avaliação(ões) técnica(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Banner de Insight */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#4A041C] to-[#7A0930] text-white flex items-center gap-3 shadow-sm">
              <TrendingUp size={22} className="text-pink-300 shrink-0" />
              <p className="text-xs sm:text-sm font-medium">{feedbackBolsista}</p>
            </div>

            {/* Grid: Formulário de Check-in + Lista de Presenças */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit space-y-3">
                <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                  <CheckSquare size={18} className="text-[#D81B60]" /> Registrar Minha Presença
                </h3>
                <p className="text-xs text-zinc-500">
                  Informe a atividade cumprida hoje no studio para compor sua folha de frequência.
                </p>

                <form onSubmit={handleRegistrarPresenca} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Data da Atividade
                    </label>
                    <input
                      type="date"
                      required
                      value={dataAtividade}
                      onChange={(e) => setDataAtividade(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Tipo de Atividade
                    </label>
                    <select
                      value={tipoAtividade}
                      onChange={(e) => setTipoAtividade(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold"
                    >
                      <option value="Apoio em Turma">Apoio / Monitoria em Turma</option>
                      <option value="Treino / Ensaio Técnico">Treino / Ensaio Técnico</option>
                      <option value="Baile / Evento do Studio">Baile / Evento do Studio</option>
                      <option value="Recepção / Organização">Recepção / Organização</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Descrição Breve (Turma ou Horário)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Turma de Forró Iniciante - 19h30"
                      value={descricaoAtividade}
                      onChange={(e) => setDescricaoAtividade(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={registrandoCheckin}
                    className="w-full rounded-xl bg-[#D81B60] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#AD1457] transition"
                  >
                    {registrandoCheckin ? 'Registrando...' : 'Confirmar Presença'}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
                <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C]">
                  Meu Histórico de Frequência ({presencas.length})
                </h3>

                {presencas.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-8 text-center">
                    Nenhuma presença registrada ainda. Use o formulário ao lado para fazer seu primeiro check-in.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
                    {presencas.map((pr) => (
                      <div
                        key={pr.id}
                        className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-zinc-900">
                            {pr.tipoAtividade}
                          </p>
                          <p className="text-xs text-zinc-600">
                            📅 {pr.data?.split('-').reverse().join('/')}{' '}
                            {pr.descricao ? `• ${pr.descricao}` : ''}
                          </p>
                          <span className="text-[10px] text-zinc-400">
                            Registro: {pr.lancadoPorNome}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            pr.status === 'presente'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pr.status === 'falta'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pr.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : abaAtiva === 'desempenho' ? (
          <div className="space-y-6">
            {/* Médias por Critério */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {mediasCriterios.map((c) => (
                <div
                  key={c.label}
                  className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm text-center"
                >
                  <span className="text-[11px] font-bold uppercase text-zinc-500 block">
                    {c.label}
                  </span>
                  <strong className="text-2xl font-condensed text-[#4A041C] mt-1 block">
                    {c.valor !== null ? `${c.valor} / 5` : '—'}
                  </strong>
                </div>
              ))}
            </div>

            {/* Lista de Avaliações (SEM exibir anotacaoRestritaAdmin) */}
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C]">
                Histórico de Avaliações Técnicas ({avaliacoes.length})
              </h3>

              {avaliacoes.length === 0 ? (
                <p className="text-sm text-zinc-400 py-8 text-center">
                  Você ainda não possui avaliações registradas pelos professores ou coordenação.
                </p>
              ) : (
                <div className="space-y-3">
                  {avaliacoes.map((av) => (
                    <div
                      key={av.id}
                      className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#D81B60]">
                            Avaliado por: {av.avaliadorNome}
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            Data:{' '}
                            {av.dataAvaliacao
                              ? new Date(av.dataAvaliacao).toLocaleDateString('pt-BR')
                              : '—'}
                          </span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-[#4A041C] text-white text-xs font-bold">
                          Nota Geral: {av.mediaGeral} / 5
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-zinc-200">
                        <span>
                          Assiduidade: <strong>{av.assiduidade}/5</strong>
                        </span>
                        <span>
                          Participação: <strong>{av.participacao}/5</strong>
                        </span>
                        <span>
                          Pontualidade: <strong>{av.pontualidade}/5</strong>
                        </span>
                        <span>
                          Postura: <strong>{av.postura}/5</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ABA 3: TURMAS & SEGURANÇA DA CONTA */
          <div className="space-y-6">
            <SegurancaSenhaCard />

            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <Calendar size={18} className="text-[#D81B60]" /> Turmas & Horários do Studio ({cursos.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cursos.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-1"
                  >
                    <span className="px-2 py-0.5 rounded bg-[#4A041C] text-white text-[10px] font-bold uppercase">
                      {c.frente || 'Dança de Salão'}
                    </span>
                    <h4 className="font-bold text-zinc-900 text-sm pt-1">{c.titulo}</h4>
                    <p className="text-xs text-zinc-600">
                      {c.estilo} • Prof: <strong>{c.professoresNomes}</strong>
                    </p>
                    <p className="text-xs text-zinc-500">
                      🕒 {c.dataInfo} ({c.horaInicio} às {c.horarioFim})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
