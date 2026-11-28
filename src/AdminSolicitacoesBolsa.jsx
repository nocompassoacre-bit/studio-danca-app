import { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import {
  Award,
  Link2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  UserCheck,
  History,
  Eye,
  X,
  PlusCircle,
  MessageCircle,
  Search,
  Lock,
  Unlock,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';

export default function AdminSolicitacoesBolsa({ recarregarGeral }) {
  const { userData } = useAuth();
  const [subAba, setSubAba] = useState('pendentes'); // pendentes | historico | editais
  const [carregando, setCarregando] = useState(true);

  const [editais, setEditais] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [fichaAberta, setFichaAberta] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroHistorico, setFiltroHistorico] = useState('todos'); // todos | aprovado | reprovado
  const [processandoId, setProcessandoId] = useState('');
  const [copiadoId, setCopiadoId] = useState('');

  // Formulário de Novo Edital
  const [mostrarFormEdital, setMostrarFormEdital] = useState(false);
  const [tituloEdital, setTituloEdital] = useState('Edital nº 02/2026 — Bolsas Dança de Salão');
  const [dataInicioBolsa, setDataInicioBolsa] = useState('2027-01-11');
  const [dataFimBolsa, setDataFimBolsa] = useState('2027-07-11');
  const [vigenciaMeses, setVigenciaMeses] = useState(6);
  const [dataAvaliacao, setDataAvaliacao] = useState(
    '09 de janeiro de 2027 (sábado), das 14h às 16h'
  );
  const [criandoEdital, setCriandoEdital] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [edSnap, solSnap] = await Promise.all([
        getDocs(collection(db, 'editais_bolsa')),
        getDocs(collection(db, 'solicitacoes_bolsa')),
      ]);

      const listaEditais = edSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));

      const listaSolicitacoes = solSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataInscricao || '').localeCompare(a.dataInscricao || ''));

      setEditais(listaEditais);
      setSolicitacoes(listaSolicitacoes);
    } catch (err) {
      console.error('Erro ao carregar solicitações de bolsa:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleCriarEdital = async (e) => {
    e.preventDefault();
    setCriandoEdital(true);
    try {
      await addDoc(collection(db, 'editais_bolsa'), {
        titulo: tituloEdital.trim(),
        dataInicioBolsa,
        dataFimBolsa,
        vigenciaMeses: Number(vigenciaMeses || 6),
        dataAvaliacao: dataAvaliacao.trim(),
        status: 'aberto',
        criadoPor: userData?.nome || 'Coordenação Geral',
        criadoEm: new Date().toISOString(),
      });
      setMostrarFormEdital(false);
      await carregarDados();
      alert('✅ Edital publicado! Copie o link abaixo para divulgar ao público.');
    } catch (err) {
      alert('Erro ao criar edital: ' + err.message);
    } finally {
      setCriandoEdital(false);
    }
  };

  const alternarStatusEdital = async (ed) => {
    const novoStatus = ed.status === 'encerrado' ? 'aberto' : 'encerrado';
    try {
      await updateDoc(doc(db, 'editais_bolsa', ed.id), {
        status: novoStatus,
      });
      carregarDados();
    } catch (err) {
      alert('Erro ao alterar status do edital: ' + err.message);
    }
  };

  const copiarLinkEdital = (id) => {
    const url = `${window.location.origin}/selecao-bolsa/${id}`;
    navigator.clipboard.writeText(url);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(''), 2500);
  };

  // APROVAR CANDIDATO -> LANÇA AUTOMATICAMENTE NA ABA DE BOLSISTAS (USERS)
  const handleAprovarCandidato = async (sol) => {
    if (
      !window.confirm(
        `Confirma a APROVAÇÃO de "${sol.nome}" como Bolsista?\n\nO cadastro será criado automaticamente na aba de Bolsistas com vigência de ${sol.dataInicioBolsaPrevista || '2027-01-11'} até ${sol.dataFimBolsaPrevista || '2027-07-11'}.`
      )
    ) {
      return;
    }

    setProcessandoId(sol.id);
    let secondaryApp;
    try {
      const config = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      };
      secondaryApp = initializeApp(config, 'AprovarBolsista_' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        sol.email,
        sol.senhaInicialEscolhida || '123456'
      );

      const dataEntrada = sol.dataInicioBolsaPrevista || '2027-01-11';
      const dataFim = sol.dataFimBolsaPrevista || '2027-07-11';

      const telefoneFormatado = sol.isMenorDe18
        ? `${sol.telefone} | Resp: ${sol.nomeResponsavelLegal} (${sol.telefoneResponsavelLegal})`
        : sol.telefone;

      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        nome: sol.nome,
        email: sol.email,
        emailExibicao: sol.email,
        telefone: telefoneFormatado,
        telefoneRaw: sol.telefone,
        cpf: sol.cpf || '',
        dataNascimento: sol.dataNascimento || '',
        instagram: sol.instagram || '',
        endereco: sol.endereco || '',
        fotoPerfilUrl: sol.fotoPerfilUrl || '',
        frentes: ['Dança de Salão'],
        role: 'bolsista',
        roles: ['bolsista'],
        dataEntradaBolsa: dataEntrada,
        vigenciaBolsaMeses: Number(sol.vigenciaMeses || 6),
        dataFimBolsa: dataFim,
        dataInscricaoSelecao: sol.dataInscricao || new Date().toISOString(),
        protocoloSelecao: sol.protocolo || '',
        editalOrigem: sol.editalTitulo || '',
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'solicitacoes_bolsa', sol.id), {
        status: 'aprovado',
        usuarioCriadoUid: cred.user.uid,
        avaliadoPor: userData?.nome || 'Coordenação Geral',
        dataAvaliacaoResultado: new Date().toISOString(),
        motivoResultado: 'Aprovado na seleção presencial',
      });

      alert(
        `✅ ${sol.nome} aprovado(a) com sucesso! O cadastro já aparece na aba "Alunos, Bolsistas & Profs" e em "Bolsistas & Pareceres".`
      );
      setFichaAberta(null);
      await carregarDados();
      if (recarregarGeral) recarregarGeral();
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        alert(
          'Este e-mail já possui uma conta cadastrada no sistema! Você pode editar o usuário existente na aba "Alunos, Bolsistas & Profs" e marcar o rótulo "Bolsista".'
        );
      } else {
        alert('Erro ao aprovar candidato: ' + err.message);
      }
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setProcessandoId('');
    }
  };

  // NÃO APROVAR (ELIMINAR) -> MOVE PARA HISTÓRICO DE SOLICITAÇÕES
  const handleReprovarCandidato = async (sol) => {
    const motivo = window.prompt(
      `Informe o motivo da eliminação / não aprovação de "${sol.nome}" (ex: Faltou na avaliação presencial, Incompatibilidade de horário):`,
      'Não selecionado / Eliminado na etapa presencial'
    );
    if (motivo === null) return;

    setProcessandoId(sol.id);
    try {
      await updateDoc(doc(db, 'solicitacoes_bolsa', sol.id), {
        status: 'reprovado',
        avaliadoPor: userData?.nome || 'Coordenação Geral',
        dataAvaliacaoResultado: new Date().toISOString(),
        motivoResultado: motivo.trim() || 'Não aprovado',
      });

      setFichaAberta(null);
      await carregarDados();
    } catch (err) {
      alert('Erro ao registrar eliminação: ' + err.message);
    } finally {
      setProcessandoId('');
    }
  };

  const abrirWhatsAppCandidato = (sol, aprovado = false) => {
    const foneLimpo = (sol.telefone || '').replace(/\D/g, '');
    const fone = foneLimpo.startsWith('55') ? foneLimpo : `55${foneLimpo}`;
    const texto = aprovado
      ? `Olá, *${sol.nome}*! Parabéns! 🎉 Você foi *APROVADO(A)* no processo seletivo de Bolsistas do *Studio de Dança No Compasso* (${sol.editalTitulo})! Seu acesso ao portal já está ativo com seu e-mail cadastrado.`
      : `Olá, *${sol.nome}*! Aqui é da direção do *Studio de Dança No Compasso* referente à sua inscrição (${sol.protocolo}) no ${sol.editalTitulo}.`;
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const exportarPlanilhaSolicitacoes = () => {
    if (solicitacoes.length === 0) {
      alert('Ainda não há inscrições registradas para exportar.');
      return;
    }

    const cabecalho = [
      'Protocolo',
      'Status',
      'Data Inscrição',
      'Edital',
      'Nome Completo',
      'CPF',
      'Data Nascimento',
      'Idade',
      'Menor de 18?',
      'Responsável Legal',
      'Tel. Responsável',
      'WhatsApp',
      'E-mail',
      'Instagram',
      'Endereço',
      'Conhecimento Prévio',
      'Conhece o Studio',
      'Como Soube',
      'Experiência em Dança',
      'Dias Úteis Disponíveis',
      'Estilos de Interesse',
      'Motivação',
      'Como Pode Colaborar',
      'Observações Extras',
      'Avaliado Por',
      'Motivo / Resultado',
    ];

    const escaparCsv = (valor) => {
      const texto = String(valor ?? '')
        .replace(/\r?\n|\r/g, ' ')
        .replace(/"/g, '""');
      return `"${texto}"`;
    };

    const linhas = solicitacoes.map((s) =>
      [
        s.protocolo,
        s.status === 'aprovado'
          ? 'APROVADO (BOLSISTA)'
          : s.status === 'reprovado'
          ? 'ELIMINADO'
          : 'PENDENTE',
        s.dataInscricao ? new Date(s.dataInscricao).toLocaleString('pt-BR') : '',
        s.editalTitulo,
        s.nome,
        s.cpf,
        s.dataNascimento ? s.dataNascimento.split('-').reverse().join('/') : '',
        s.idadeInscricao,
        s.isMenorDe18 ? 'Sim' : 'Não',
        s.nomeResponsavelLegal,
        s.telefoneResponsavelLegal,
        s.telefone,
        s.email,
        s.instagram,
        s.endereco,
        s.conhecimentoPrevio,
        s.conheceStudio,
        s.comoSoube,
        s.experienciaSalao,
        Array.isArray(s.diasUteisDisponiveis) ? s.diasUteisDisponiveis.join(' | ') : '',
        Array.isArray(s.estilosInteresse) ? s.estilosInteresse.join(' | ') : '',
        s.motivacaoStudio,
        s.comoPodeColaborar,
        s.observacoesExtras,
        s.avaliadoPor || '',
        s.motivoResultado || '',
      ]
        .map(escaparCsv)
        .join(';')
    );

    const conteudoCsv = '\uFEFF' + [cabecalho.map(escaparCsv).join(';'), ...linhas].join('\n');
    const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inscricoes-bolsistas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pendentes = solicitacoes.filter(
    (s) =>
      s.status === 'pendente' &&
      ((s.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (s.protocolo || '').toLowerCase().includes(busca.toLowerCase()))
  );

  const historico = solicitacoes.filter((s) => {
    if (s.status === 'pendente') return false;
    if (filtroHistorico !== 'todos' && s.status !== filtroHistorico) return false;
    return (
      (s.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (s.protocolo || '').toLowerCase().includes(busca.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* CABEÇALHO E LINKS PÚBLICOS DOS EDITAIS */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#D81B60] block">
              Seleção Pública de Bolsistas
            </span>
            <h3 className="text-xl font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
              <Award size={22} className="text-[#D81B60]" /> Solicitações de Bolsa & Editais
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setMostrarFormEdital((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A041C] hover:bg-[#D81B60] px-4 py-2.5 text-xs font-bold uppercase text-white transition"
          >
            <PlusCircle size={15} />
            {mostrarFormEdital ? 'Fechar Formulário' : 'Abrir Novo Edital / Link Público'}
          </button>
        </div>

        </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportarPlanilhaSolicitacoes}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold uppercase text-white transition"
            >
              <FileSpreadsheet size={15} />
              Exportar Planilha ({solicitacoes.length})
            </button>

            <button
              type="button"
              onClick={() => setMostrarFormEdital((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A041C] hover:bg-[#D81B60] px-4 py-2.5 text-xs font-bold uppercase text-white transition"
            >
              <PlusCircle size={15} />
              {mostrarFormEdital ? 'Fechar Formulário' : 'Abrir Novo Edital / Link Público'}
            </button>
          </div>
        </div>

        {/* FORMULÁRIO PARA CRIAR/ABRIR NOVO EDITAL */}
        {mostrarFormEdital && (
          <form
            onSubmit={handleCriarEdital}
            className="p-4 rounded-2xl bg-pink-50/70 border border-[#D81B60]/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
          >
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                Título do Edital
              </label>
              <input
                type="text"
                required
                value={tituloEdital}
                onChange={(e) => setTituloEdital(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                Início da Bolsa
              </label>
              <input
                type="date"
                required
                value={dataInicioBolsa}
                onChange={(e) => setDataInicioBolsa(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                Término da Bolsa
              </label>
              <input
                type="date"
                required
                value={dataFimBolsa}
                onChange={(e) => setDataFimBolsa(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                Data e Horário da Avaliação Presencial
              </label>
              <input
                type="text"
                required
                value={dataAvaliacao}
                onChange={(e) => setDataAvaliacao(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={criandoEdital}
                className="w-full rounded-xl bg-[#D81B60] hover:bg-[#AD1457] py-2.5 text-xs font-bold uppercase text-white"
              >
                {criandoEdital ? 'Publicando...' : 'Publicar Edital'}
              </button>
            </div>
          </form>
        )}

        {/* LISTA RÁPIDA DE LINKS PÚBLICOS DOS EDITAIS */}
        {editais.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-200">
            <span className="block text-[11px] font-bold uppercase text-zinc-500">
              Links Públicos de Inscrição ({editais.length})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {editais.map((ed) => {
                const linkPublico = `${window.location.origin}/selecao-bolsa/${ed.id}`;
                const aberto = ed.status !== 'encerrado';
                return (
                  <div
                    key={ed.id}
                    className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-zinc-900">{ed.titulo}</strong>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          aberto
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {aberto ? 'Inscrições Abertas' : 'Encerrado'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={linkPublico}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-mono text-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => copiarLinkEdital(ed.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#4A041C] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#D81B60]"
                      >
                        {copiadoId === ed.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiadoId === ed.id ? 'Copiado' : 'Copiar Link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarStatusEdital(ed)}
                        title={aberto ? 'Encerrar inscrições' : 'Reabrir inscrições'}
                        className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-600 hover:text-zinc-900"
                      >
                        {aberto ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* NAVEGAÇÃO ENTRE PENDENTES E HISTÓRICO DE SOLICITAÇÕES */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubAba('pendentes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${
              subAba === 'pendentes'
                ? 'bg-[#D81B60] text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Clock size={15} />
            Solicitações Pendentes ({solicitacoes.filter((s) => s.status === 'pendente').length})
          </button>

          <button
            type="button"
            onClick={() => setSubAba('historico')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${
              subAba === 'historico'
                ? 'bg-[#4A041C] text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <History size={15} />
            Histórico de Solicitações ({solicitacoes.filter((s) => s.status !== 'pendente').length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar candidato ou protocolo..."
            className="w-full rounded-xl border border-zinc-300 pl-9 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {/* LISTA DE PENDENTES */}
      {carregando ? (
        <div className="text-center py-16 text-sm text-zinc-500">
          Carregando inscrições...
        </div>
      ) : subAba === 'pendentes' ? (
        pendentes.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-500">
            Nenhuma solicitação pendente de avaliação no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {pendentes.map((sol) => (
              <div
                key={sol.id}
                className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3.5">
                    {sol.fotoPerfilUrl ? (
                      <img
                        src={sol.fotoPerfilUrl}
                        alt={sol.nome}
                        className="w-16 h-16 rounded-2xl object-cover border border-zinc-300 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                        Foto
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-[#D81B60]">
                        {sol.protocolo}
                      </span>
                      <h4 className="text-base font-bold text-zinc-900 truncate">{sol.nome}</h4>
                      <p className="text-xs text-zinc-600">
                        {sol.idadeInscricao} anos • {sol.instagram || 'Sem Insta'}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Inscrito em:{' '}
                        {sol.dataInscricao
                          ? new Date(sol.dataInscricao).toLocaleDateString('pt-BR')
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                    <p>
                      <strong>Nível:</strong> {sol.conhecimentoPrevio}
                    </p>
                    <p>
                      <strong>Dias Úteis:</strong>{' '}
                      {Array.isArray(sol.diasUteisDisponiveis)
                        ? sol.diasUteisDisponiveis.map((d) => d.split(' ')[0]).join(', ')
                        : '—'}
                    </p>
                    <p>
                      <strong>Estilos:</strong>{' '}
                      {Array.isArray(sol.estilosInteresse) ? sol.estilosInteresse.join(', ') : '—'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-100">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFichaAberta(sol)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 py-2 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
                    >
                      <Eye size={14} /> Ficha Completa
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirWhatsAppCandidato(sol, false)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                      title="Chamar no WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={processandoId === sol.id}
                      onClick={() => handleAprovarCandidato(sol)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold uppercase text-white transition"
                    >
                      <UserCheck size={15} />
                      {processandoId === sol.id ? 'Aprovando...' : 'Aprovar'}
                    </button>

                    <button
                      type="button"
                      disabled={processandoId === sol.id}
                      onClick={() => handleReprovarCandidato(sol)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-xs font-bold uppercase text-white transition"
                    >
                      <XCircle size={15} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ABA HISTÓRICO DE SOLICITAÇÕES */
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-base font-bold uppercase font-condensed text-[#4A041C]">
              Histórico Completo de Solicitações ({historico.length})
            </h4>

            <div className="flex gap-1.5">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'aprovado', label: 'Aprovados' },
                { id: 'reprovado', label: 'Eliminados' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroHistorico(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                    filtroHistorico === f.id
                      ? 'bg-[#4A041C] text-white'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {historico.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">
              Nenhum registro no histórico ainda.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200">
              {historico.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {item.fotoPerfilUrl && (
                      <img
                        src={item.fotoPerfilUrl}
                        alt={item.nome}
                        className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-zinc-900">{item.nome}</strong>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'aprovado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {item.status === 'aprovado' ? 'Aprovado (Bolsista)' : 'Eliminado'}
                        </span>
                      </div>
                      <p className="text-zinc-500">
                        {item.protocolo} • {item.editalTitulo}
                      </p>
                      {item.motivoResultado && (
                        <p className="text-zinc-700 mt-0.5">
                          <strong>Observação:</strong> {item.motivoResultado} (por {item.avaliadoPor})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setFichaAberta(item)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 font-bold text-zinc-700 hover:bg-zinc-100"
                    >
                      Ver Ficha
                    </button>
                    {item.status === 'aprovado' && (
                      <button
                        type="button"
                        onClick={() => abrirWhatsAppCandidato(item, true)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700"
                      >
                        <MessageCircle size={13} /> Avisar Aprovação
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE FICHA COMPLETA DO CANDIDATO */}
      {fichaAberta && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-4">
                {fichaAberta.fotoPerfilUrl && (
                  <img
                    src={fichaAberta.fotoPerfilUrl}
                    alt={fichaAberta.nome}
                    className="w-20 h-20 rounded-2xl object-cover border border-zinc-300"
                  />
                )}
                <div>
                  <span className="text-xs font-mono font-bold text-[#D81B60]">
                    {fichaAberta.protocolo}
                  </span>
                  <h3 className="text-xl font-bold text-zinc-900">{fichaAberta.nome}</h3>
                  <p className="text-xs text-zinc-600">
                    {fichaAberta.idadeInscricao} anos • CPF: {fichaAberta.cpf}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFichaAberta(null)}
                className="p-2 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
              <p>
                <strong>WhatsApp:</strong> {fichaAberta.telefone}
              </p>
              <p>
                <strong>E-mail:</strong> {fichaAberta.email}
              </p>
              <p>
                <strong>Instagram:</strong> {fichaAberta.instagram}
              </p>
              <p>
                <strong>Nascimento:</strong>{' '}
                {fichaAberta.dataNascimento?.split('-').reverse().join('/')}
              </p>
              <p className="sm:col-span-2">
                <strong>Endereço:</strong> {fichaAberta.endereco}
              </p>
              {fichaAberta.isMenorDe18 && (
                <p className="sm:col-span-2 text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <strong>Responsável Legal:</strong> {fichaAberta.nomeResponsavelLegal} (
                  {fichaAberta.telefoneResponsavelLegal})
                </p>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <p>
                <strong className="text-[#4A041C] uppercase">Conhecimento Prévio:</strong>{' '}
                {fichaAberta.conhecimentoPrevio}
              </p>
              <p>
                <strong className="text-[#4A041C] uppercase">Conhece o Studio:</strong>{' '}
                {fichaAberta.conheceStudio} (Soube por: {fichaAberta.comoSoube})
              </p>
              <p>
                <strong className="text-[#4A041C] uppercase">Experiência em Dança:</strong>{' '}
                {fichaAberta.experienciaSalao}
              </p>
              <p>
                <strong className="text-[#4A041C] uppercase">Disponibilidade:</strong> Sábado (15h–20h) e{' '}
                {Array.isArray(fichaAberta.diasUteisDisponiveis)
                  ? fichaAberta.diasUteisDisponiveis.join(', ')
                  : ''}
              </p>
              <p>
                <strong className="text-[#4A041C] uppercase">Estilos que quer aprender:</strong>{' '}
                {Array.isArray(fichaAberta.estilosInteresse)
                  ? fichaAberta.estilosInteresse.join(', ')
                  : ''}
              </p>
              <div className="p-3 rounded-xl bg-pink-50/70 border border-pink-200 space-y-1.5">
                <p>
                  <strong>Motivação:</strong> {fichaAberta.motivacaoStudio}
                </p>
                <p>
                  <strong>Como pode colaborar:</strong> {fichaAberta.comoPodeColaborar}
                </p>
                {fichaAberta.observacoesExtras && (
                  <p>
                    <strong>Observações:</strong> {fichaAberta.observacoesExtras}
                  </p>
                )}
              </div>
            </div>

            {fichaAberta.status === 'pendente' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  disabled={processandoId === fichaAberta.id}
                  onClick={() => handleAprovarCandidato(fichaAberta)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold uppercase text-white"
                >
                  <CheckCircle2 size={16} /> Aprovar & Lançar em Bolsistas
                </button>
                <button
                  type="button"
                  disabled={processandoId === fichaAberta.id}
                  onClick={() => handleReprovarCandidato(fichaAberta)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 py-3 text-xs font-bold uppercase text-white"
                >
                  <XCircle size={16} /> Não Aprovar (Eliminar)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
