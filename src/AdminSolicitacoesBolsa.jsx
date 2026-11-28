import { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  Award,
  PlusCircle,
  Link2,
  Check,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Search,
  Instagram,
  Phone,
  Trash2,
  Eye,
  X,
  FileSpreadsheet,
  Mail,
  Bell,
  Edit3,
  Plus,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { TEXTO_EDITAL_PADRAO, PERGUNTAS_PADRAO_EDITAL } from './InscricaoBolsaPublica';

export default function AdminSolicitacoesBolsa({ recarregarGeral }) {
  const { userData } = useAuth();
  const [editais, setEditais] = useState([]);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [mostrarFormEdital, setMostrarFormEdital] = useState(false);
  const [tituloEdital, setTituloEdital] = useState('Edital nº 02/2026 — Bolsas Dança de Salão');
  const [dataAvaliacao, setDataAvaliacao] = useState(
    '09 de janeiro de 2027 (sábado), das 14h às 16h'
  );
  const [dataInicioBolsa, setDataInicioBolsa] = useState('2027-01-11');
  const [vigenciaMeses, setVigenciaMeses] = useState('6');
  const [textoEdital, setTextoEdital] = useState(TEXTO_EDITAL_PADRAO);

  // Construtor / Editor de perguntas antes de publicar o edital
  const [perguntasEdital, setPerguntasEdital] = useState(() =>
    PERGUNTAS_PADRAO_EDITAL.map((p) => ({ ...p }))
  );
  const [novaPerguntaTexto, setNovaPerguntaTexto] = useState('');
  const [novaPerguntaTipo, setNovaPerguntaTipo] = useState('textarea');
  const [novaPerguntaOpcoes, setNovaPerguntaOpcoes] = useState('');
  const [novaPerguntaObrigatoria, setNovaPerguntaObrigatoria] = useState(true);

  const [copiadoId, setCopiadoId] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [busca, setBusca] = useState('');
  const [candidatoAberto, setCandidatoAberto] = useState(null);
  const [processandoId, setProcessandoId] = useState('');
  const [enviandoLembreteGeral, setEnviandoLembreteGeral] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [snapEditais, snapSolic] = await Promise.all([
        getDocs(collection(db, 'editais_bolsa')),
        getDocs(collection(db, 'solicitacoes_bolsa')),
      ]);

      setEditais(
        snapEditais.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))
      );

      setSolicitacoes(
        snapSolic.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.dataInscricao || '').localeCompare(a.dataInscricao || ''))
      );
    } catch (err) {
      console.error('Erro ao carregar seleções de bolsa:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Funções de edição/exclusão de perguntas antes de publicar o Edital
  const editarEnunciadoPergunta = (idx, novoTexto) => {
    setPerguntasEdital((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, enunciado: novoTexto } : p))
    );
  };

  const alternarObrigatoriaPergunta = (idx) => {
    setPerguntasEdital((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, obrigatoria: !p.obrigatoria } : p))
    );
  };

  const excluirPerguntaEdital = (idx) => {
    setPerguntasEdital((prev) => prev.filter((_, i) => i !== idx));
  };

  const adicionarNovaPerguntaEdital = () => {
    if (!novaPerguntaTexto.trim()) return;
    const opcoesArr =
      novaPerguntaTipo === 'select'
        ? novaPerguntaOpcoes
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : [];

    if (novaPerguntaTipo === 'select' && opcoesArr.length < 2) {
      alert('Para perguntas de múltipla escolha, informe pelo menos 2 opções separadas por vírgula.');
      return;
    }

    setPerguntasEdital((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        enunciado: novaPerguntaTexto.trim(),
        tipo: novaPerguntaTipo,
        obrigatoria: novaPerguntaObrigatoria,
        opcoes: opcoesArr,
      },
    ]);
    setNovaPerguntaTexto('');
    setNovaPerguntaOpcoes('');
  };

  const handleCriarEdital = async (e) => {
    e.preventDefault();
    if (perguntasEdital.length === 0) {
      alert('Mantenha pelo menos 1 pergunta no formulário do edital.');
      return;
    }

    const fimObj = new Date(dataInicioBolsa + 'T00:00:00');
    fimObj.setMonth(fimObj.getMonth() + Number(vigenciaMeses || 6));
    const dataFimIso = !isNaN(fimObj.getTime())
      ? fimObj.toISOString().split('T')[0]
      : '2027-07-11';

    try {
      await addDoc(collection(db, 'editais_bolsa'), {
        titulo: tituloEdital.trim(),
        dataAvaliacao: dataAvaliacao.trim(),
        dataInicioBolsa,
        dataFimBolsa: dataFimIso,
        vigenciaMeses: Number(vigenciaMeses || 6),
        textoEdital,
        perguntas: perguntasEdital,
        status: 'aberto',
        criadoPor: userData?.nome || 'Coordenação',
        criadoEm: new Date().toISOString(),
      });
      setMostrarFormEdital(false);
      alert('Edital publicado e link público gerado com sucesso!');
      carregarDados();
    } catch (err) {
      alert('Erro ao publicar edital: ' + err.message);
    }
  };

  const alternarStatusEdital = async (ed) => {
    const novoStatus = ed.status === 'aberto' ? 'encerrado' : 'aberto';
    await updateDoc(doc(db, 'editais_bolsa', ed.id), { status: novoStatus });
    carregarDados();
  };

  const excluirEdital = async (ed) => {
    const qtdInscritosNeste = solicitacoes.filter((s) => s.editalId === ed.id).length;
    const avisoExtra =
      qtdInscritosNeste > 0
        ? `\n\n⚠️ Atenção: existem ${qtdInscritosNeste} inscrição(ões) vinculada(s) a este edital (elas continuarão salvas no histórico).`
        : '';

    if (
      !window.confirm(
        `Deseja excluir permanentemente o link "${ed.titulo}"?${avisoExtra}`
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'editais_bolsa', ed.id));
      carregarDados();
    } catch (err) {
      alert('Erro ao excluir edital: ' + err.message);
    }
  };

  const handleExcluirSolicitacao = async (sol) => {
    if (
      !window.confirm(
        `Deseja excluir permanentemente a solicitação de "${sol.nome}" (${sol.protocolo})?\n\nEsta ação remove o registro de teste do histórico.`
      )
    ) {
      return;
    }

    setProcessandoId(sol.id);
    try {
      await deleteDoc(doc(db, 'solicitacoes_bolsa', sol.id));
      if (candidatoAberto?.id === sol.id) {
        setCandidatoAberto(null);
      }
      carregarDados();
    } catch (err) {
      alert('Erro ao excluir solicitação: ' + err.message);
    } finally {
      setProcessandoId('');
    }
  };

  const copiarLinkPublico = (edId) => {
    const url = `${window.location.origin}/selecao-bolsa/${edId}`;
    navigator.clipboard.writeText(url);
    setCopiadoId(edId);
    setTimeout(() => setCopiadoId(''), 2500);
  };

  const enviarEmailSistema = async ({ to, subject, text, tipo, protocolo, nome }) => {
    await addDoc(collection(db, 'comunicados_email'), {
      tipo,
      destinatarioEmail: to,
      destinatarioNome: nome,
      protocolo: protocolo || '',
      assunto: subject,
      mensagem: text,
      statusEnvio: 'enviado',
      criadoEm: new Date().toISOString(),
    });

    const resp = await fetch('/api/enviar-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text }),
    }).catch(() => null);

    return resp;
  };

  const handleEnviarLembreteIndividual = async (sol) => {
    setProcessandoId(sol.id);
    try {
      const dataEncontro =
        sol.dataAvaliacaoPresencial || '09 de janeiro de 2027 (sábado), das 14h às 16h';
      const assunto = `Lembrete: Avaliação Presencial de Bolsistas — ${sol.editalTitulo}`;
      const texto = `Olá, ${sol.nome}!

Passando para lembrar da sua etapa de Avaliação Presencial no processo seletivo "${sol.editalTitulo}" (Protocolo: ${sol.protocolo}).

📅 Data e Horário: ${dataEncontro}
📍 Local: Studio de Dança No Compasso (Estrada das Placas, 1909 — Rio Branco/AC).

Chegue com 15 minutos de antecedência usando roupas confortáveis para dançar. Lembramos que o não comparecimento elimina automaticamente o candidato.

Nos vemos lá!
Direção — Studio de Dança No Compasso`;

      await enviarEmailSistema({
        to: sol.email,
        subject: assunto,
        text: texto,
        tipo: 'lembrete_bolsa',
        protocolo: sol.protocolo,
        nome: sol.nome,
      });

      await updateDoc(doc(db, 'solicitacoes_bolsa', sol.id), {
        ultimoLembreteEnviadoEm: new Date().toISOString(),
      });

      alert(`✅ Lembrete enviado por e-mail para ${sol.nome} (${sol.email})!`);
      carregarDados();
    } catch (err) {
      alert('Erro ao enviar lembrete: ' + err.message);
    } finally {
      setProcessandoId('');
    }
  };

  const handleEnviarLembreteTodosPendentes = async () => {
    const pendentes = solicitacoes.filter((s) => s.status === 'pendente' && s.email);
    if (pendentes.length === 0) {
      alert('Não há candidatos pendentes para receber lembrete.');
      return;
    }
    if (
      !window.confirm(
        `Deseja disparar agora o e-mail de lembrete do encontro presencial para todos os ${pendentes.length} candidato(s) pendente(s)?`
      )
    ) {
      return;
    }

    setEnviandoLembreteGeral(true);
    try {
      for (const sol of pendentes) {
        const dataEncontro =
          sol.dataAvaliacaoPresencial || '09 de janeiro de 2027 (sábado), das 14h às 16h';
        const assunto = `Lembrete: Avaliação Presencial de Bolsistas — ${sol.editalTitulo}`;
        const texto = `Olá, ${sol.nome}!

Este é um lembrete oficial da sua Avaliação Presencial no processo seletivo "${sol.editalTitulo}" (Protocolo: ${sol.protocolo}).

📅 Data e Horário: ${dataEncontro}
📍 Local: Studio de Dança No Compasso (Estrada das Placas, 1909 — Rio Branco/AC).

Vá com roupas confortáveis para praticar e chegue com 15 minutos de antecedência.

Atenciosamente,
Direção — Studio de Dança No Compasso`;

        await enviarEmailSistema({
          to: sol.email,
          subject: assunto,
          text: texto,
          tipo: 'lembrete_bolsa_lote',
          protocolo: sol.protocolo,
          nome: sol.nome,
        });

        await updateDoc(doc(db, 'solicitacoes_bolsa', sol.id), {
          ultimoLembreteEnviadoEm: new Date().toISOString(),
        });
      }

      alert(`✅ Lembretes enviados com sucesso para ${pendentes.length} candidato(s)!`);
      carregarDados();
    } catch (err) {
      alert('Erro no envio em lote: ' + err.message);
    } finally {
      setEnviandoLembreteGeral(false);
    }
  };

  const abrirWhatsAppLembrete = (sol) => {
    const foneLimpo = (sol.telefone || '').replace(/\D/g, '');
    const dataEncontro =
      sol.dataAvaliacaoPresencial || '09/01/2027 (sábado), das 14h às 16h';
    const msg = `Olá, *${sol.nome}*! Passando para lembrar da sua Avaliação Presencial de Bolsistas do *No Compasso Studio de Dança* (Protocolo *${sol.protocolo}*).\n\n📅 *Data/Hora:* ${dataEncontro}\n📍 *Local:* Estrada das Placas, 1909.\n\nVá com roupa confortável para dançar! Até lá!`;
    window.open(`https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const exportarPlanilhaSolicitacoes = () => {
    if (solicitacoes.length === 0) {
      alert('Nenhuma solicitação registrada para exportar.');
      return;
    }

    const cabecalhos = [
      'Protocolo',
      'Edital',
      'Status',
      'Acesso Portal',
      'Data Inscricao',
      'Nome Completo',
      'CPF',
      'Data Nascimento',
      'Idade',
      'WhatsApp',
      'E-mail',
      'Instagram',
      'Endereco',
      'Responsavel Legal',
      'Contato Responsavel',
      'Nivel Conhecimento',
      'Experiencia Danca',
      'Conhece Studio',
      'Como Soube',
      'Motivacao',
      'Como Pode Colaborar',
      'Observacoes Extras',
      'Sabado Livre',
      'Dias Uteis Disponiveis',
      'Estilos de Interesse',
    ];

    const escaparCsv = (valor) => {
      if (valor === null || valor === undefined) return '""';
      const str = Array.isArray(valor) ? valor.join(' | ') : String(valor);
      return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    };

    const linhas = solicitacoes.map((s) =>
      [
        s.protocolo || '',
        s.editalTitulo || '',
        (s.status || 'pendente').toUpperCase(),
        s.acessoPortalHabilitado ? 'HABILITADO' : 'BLOQUEADO',
        s.dataInscricao ? new Date(s.dataInscricao).toLocaleString('pt-BR') : '',
        s.nome || '',
        s.cpf || '',
        s.dataNascimento || '',
        s.idadeInscricao || '',
        s.telefone || '',
        s.email || '',
        s.instagram || '',
        s.endereco || '',
        s.nomeResponsavelLegal || '',
        s.telefoneResponsavelLegal || '',
        s.conhecimentoPrevio || '',
        s.experienciaSalao || '',
        s.conheceStudio || '',
        s.comoSoube || '',
        s.motivacaoStudio || '',
        s.comoPodeColaborar || '',
        s.observacoesExtras || '',
        s.disponibilidadeSabado ? 'Sim' : 'Não',
        s.diasUteisDisponiveis || [],
        s.estilosInteresse || [],
      ]
        .map(escaparCsv)
        .join(';')
    );

    const conteudoCsv = '\uFEFF' + [cabecalhos.join(';'), ...linhas].join('\r\n');
    const blob = new Blob([conteudoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `solicitacoes-bolsa-nocompasso-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // APROVAR CANDIDATO: habilita o usuário e a senha que ele escolheu na inscrição
  const handleAprovarCandidato = async (sol) => {
    if (
      !window.confirm(
        `Confirmar APROVAÇÃO de "${sol.nome}"?\n\nIsso habilitará o login (${sol.email}) com a senha criada na inscrição e ativará o perfil de Bolsista.`
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
      secondaryApp = initializeApp(config, 'AprovacaoBolsa_' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const senhaHabilitada = sol.senhaInicialEscolhida || 'Mudar@123';
      let uidCriado = '';

      try {
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          sol.email,
          senhaHabilitada
        );
        uidCriado = cred.user.uid;
      } catch (authErr) {
        if (authErr.code !== 'auth/email-already-in-use') {
          throw authErr;
        }
      }

      const dataEntrada = sol.dataInicioBolsaPrevista || '2027-01-11';
      const meses = Number(sol.vigenciaMeses || 6);
      const dataFim = sol.dataFimBolsaPrevista || '2027-07-11';

      const docId = uidCriado || `bolsista_${Date.now()}`;
      await setDoc(doc(db, 'users', docId), {
        uid: uidCriado,
        nome: sol.nome,
        email: sol.email,
        emailExibicao: sol.email,
        telefone: sol.telefone,
        telefoneRaw: sol.telefone,
        cpf: sol.cpf,
        dataNascimento: sol.dataNascimento,
        endereco: sol.endereco,
        instagram: sol.instagram || '',
        fotoPerfilUrl: sol.fotoPerfilUrl || '',
        frentes: ['Dança de Salão'],
        role: 'bolsista',
        roles: ['bolsista'],
        dataEntradaBolsa: dataEntrada,
        vigenciaBolsaMeses: meses,
        dataFimBolsa: dataFim,
        protocoloSelecao: sol.protocolo,
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'solicitacoes_bolsa', sol.id), {
        status: 'aprovado',
        acessoPortalHabilitado: true,
        avaliadoPor: userData?.nome || 'Coordenação',
        dataAvaliacaoStatus: new Date().toISOString(),
      });

      await enviarEmailSistema({
        to: sol.email,
        subject: `Parabéns! Você foi aprovado(a) na Seleção de Bolsistas — Studio No Compasso`,
        text: `Olá, ${sol.nome}!\n\nÉ com alegria que informamos a sua APROVAÇÃO no processo seletivo "${sol.editalTitulo}"!\n\nSeu acesso ao Portal do Bolsista já está HABILITADO com o e-mail e a senha que você cadastrou na inscrição:\nLink de acesso: ${window.location.origin}/login\nUsuário: ${sol.email}\n\nNos vemos nos ensaios e turmas!\nDireção — Studio de Dança No Compasso`,
        tipo: 'aprovacao_bolsa',
        protocolo: sol.protocolo,
        nome: sol.nome,
      }).catch(() => {});

      alert(
        `✅ ${sol.nome} foi APROVADO(A)!\n\nO usuário (${sol.email}) e a senha escolhida na inscrição foram habilitados e o e-mail de boas-vindas foi enviado.`
      );
      setCandidatoAberto(null);
      await carregarDados();
      if (recarregarGeral) recarregarGeral();
    } catch (err) {
      alert('Erro ao aprovar candidato: ' + err.message);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setProcessandoId('');
    }
  };

  const handleReprovarCandidato = async (sol) => {
    const motivo = window.prompt(
      `Motivo da não aprovação / eliminação de ${sol.nome} (opcional):`,
      'Não atingiu os critérios da avaliação presencial.'
    );
    if (motivo === null) return;

    setProcessandoId(sol.id);
    try {
      await updateDoc(doc(db, 'solicitacoes_bolsa', sol.id), {
        status: 'reprovado',
        acessoPortalHabilitado: false,
        motivoReprovacao: motivo,
        avaliadoPor: userData?.nome || 'Coordenação',
        dataAvaliacaoStatus: new Date().toISOString(),
      });
      setCandidatoAberto(null);
      carregarDados();
    } catch (err) {
      alert('Erro ao atualizar status: ' + err.message);
    } finally {
      setProcessandoId('');
    }
  };

  const solicitacoesFiltradas = solicitacoes.filter((s) => {
    const bateStatus =
      filtroStatus === 'todos'
        ? true
        : filtroStatus === 'historico'
        ? s.status === 'aprovado' || s.status === 'reprovado'
        : s.status === filtroStatus;

    const termo = busca.toLowerCase();
    const bateBusca =
      !termo ||
      (s.nome || '').toLowerCase().includes(termo) ||
      (s.protocolo || '').toLowerCase().includes(termo) ||
      (s.cpf || '').includes(termo);

    return bateStatus && bateBusca;
  });

  const qtdPendentes = solicitacoes.filter((s) => s.status === 'pendente').length;
  const qtdHistorico = solicitacoes.filter(
    (s) => s.status === 'aprovado' || s.status === 'reprovado'
  ).length;

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

          <div className="flex flex-wrap items-center gap-2">
            {qtdPendentes > 0 && (
              <button
                type="button"
                disabled={enviandoLembreteGeral}
                onClick={handleEnviarLembreteTodosPendentes}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2.5 text-xs font-bold uppercase text-white transition"
              >
                <Bell size={15} />
                {enviandoLembreteGeral
                  ? 'Enviando Lembretes...'
                  : `Lembrete Encontro (${qtdPendentes})`}
              </button>
            )}

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

        {/* FORMULÁRIO PARA CRIAR NOVO EDITAL + EDITAR/EXCLUIR PERGUNTAS */}
        {mostrarFormEdital && (
          <form
            onSubmit={handleCriarEdital}
            className="p-5 rounded-2xl bg-pink-50/60 border border-[#D81B60]/30 space-y-5"
          >
            <h4 className="text-sm font-bold uppercase text-[#4A041C]">
              Configurar Edital & Perguntas do Formulário de Inscrição
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
                  Título do Edital *
                </label>
                <input
                  type="text"
                  required
                  value={tituloEdital}
                  onChange={(e) => setTituloEdital(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
                  Data e Horário da Avaliação Presencial *
                </label>
                <input
                  type="text"
                  required
                  value={dataAvaliacao}
                  onChange={(e) => setDataAvaliacao(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
                  Início Previsto da Bolsa
                </label>
                <input
                  type="date"
                  required
                  value={dataInicioBolsa}
                  onChange={(e) => setDataInicioBolsa(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
                  Vigência da Bolsa (Meses)
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  required
                  value={vigenciaMeses}
                  onChange={(e) => setVigenciaMeses(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
                Texto Completo do Edital (Exibido na Seção 1)
              </label>
              <textarea
                rows="5"
                required
                value={textoEdital}
                onChange={(e) => setTextoEdital(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs leading-relaxed"
              />
            </div>

            {/* EDITOR / EXCLUSÃO DE PERGUNTAS ANTES DE PUBLICAR */}
            <div className="p-4 rounded-2xl bg-white border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-[#4A041C] flex items-center gap-1.5">
                  <Edit3 size={14} className="text-[#D81B60]" /> Perguntas da Seção 3 ({perguntasEdital.length})
                </p>
                <span className="text-[10px] text-zinc-500">
                  Edite o enunciado ou exclua perguntas antes de publicar
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {perguntasEdital.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        value={p.enunciado}
                        onChange={(e) => editarEnunciadoPergunta(idx, e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900"
                      />
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                        <span className="uppercase font-bold">
                          Tipo: {p.tipo === 'select' ? 'Múltipla Escolha' : p.tipo === 'textarea' ? 'Texto Longo' : 'Texto Curto'}
                        </span>
                        {p.ocultarSeIniciante && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold">
                            Oculta se iniciante
                          </span>
                        )}
                        {Array.isArray(p.opcoes) && p.opcoes.length > 0 && (
                          <span>Opções: {p.opcoes.join(' • ')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => alternarObrigatoriaPergunta(idx)}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          p.obrigatoria
                            ? 'bg-pink-100 text-[#4A041C]'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {p.obrigatoria ? 'Obrigatória' : 'Opcional'}
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirPerguntaEdital(idx)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        title="Excluir pergunta"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ADICIONAR NOVA PERGUNTA CUSTOMIZADA */}
              <div className="pt-3 border-t border-zinc-200 space-y-2">
                <p className="text-[11px] font-bold uppercase text-zinc-600">
                  + Adicionar Nova Pergunta ao Edital
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Enunciado da nova pergunta..."
                    value={novaPerguntaTexto}
                    onChange={(e) => setNovaPerguntaTexto(e.target.value)}
                    className="sm:col-span-6 rounded-lg border border-zinc-300 p-2 text-xs"
                  />
                  <select
                    value={novaPerguntaTipo}
                    onChange={(e) => setNovaPerguntaTipo(e.target.value)}
                    className="sm:col-span-3 rounded-lg border border-zinc-300 p-2 text-xs font-semibold"
                  >
                    <option value="textarea">Texto Longo</option>
                    <option value="text">Texto Curto</option>
                    <option value="select">Múltipla Escolha</option>
                  </select>
                  <button
                    type="button"
                    onClick={adicionarNovaPerguntaEdital}
                    className="sm:col-span-3 inline-flex items-center justify-center gap-1 rounded-lg bg-[#4A041C] text-white text-xs font-bold uppercase py-2 hover:bg-[#D81B60]"
                  >
                    <Plus size={14} /> Incluir
                  </button>
                </div>

                {novaPerguntaTipo === 'select' && (
                  <input
                    type="text"
                    placeholder="Opções separadas por vírgula (Ex: Sim, Não, Outro)"
                    value={novaPerguntaOpcoes}
                    onChange={(e) => setNovaPerguntaOpcoes(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs"
                  />
                )}
              </div>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-[#D81B60] hover:bg-[#AD1457] px-6 py-2.5 text-xs font-bold uppercase text-white"
            >
              Publicar Edital & Gerar Link
            </button>
          </form>
        )}

        {/* LINKS PÚBLICOS ATIVOS */}
        {editais.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-100">
            <span className="text-[11px] font-bold uppercase text-zinc-500 block">
              Links Públicos de Inscrição ({editais.length})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {editais.map((ed) => {
                const url = `${window.location.origin}/selecao-bolsa/${ed.id}`;
                const aberto = ed.status === 'aberto';
                return (
                  <div
                    key={ed.id}
                    className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col justify-between gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-xs text-zinc-900 block">{ed.titulo}</strong>
                        <span className="text-[11px] text-zinc-500">
                          Avaliação: {ed.dataAvaliacao}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
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
                        value={url}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-mono text-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() => copiarLinkPublico(ed.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#4A041C] hover:bg-[#D81B60] px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        {copiadoId === ed.id ? <Check size={13} /> : <Link2 size={13} />}
                        {copiadoId === ed.id ? 'Copiado!' : 'Copiar Link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarStatusEdital(ed)}
                        title={aberto ? 'Encerrar inscrições' : 'Reabrir inscrições'}
                        className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                      >
                        {aberto ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirEdital(ed)}
                        title="Excluir este link/edital"
                        className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FILTROS E BUSCA DE CANDIDATOS */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFiltroStatus('pendente')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${
              filtroStatus === 'pendente'
                ? 'bg-[#D81B60] text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            ⏳ Solicitações Pendentes ({qtdPendentes})
          </button>
          <button
            type="button"
            onClick={() => setFiltroStatus('historico')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition ${
              filtroStatus === 'historico'
                ? 'bg-[#4A041C] text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            📋 Histórico de Solicitações ({qtdHistorico})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar candidato ou protocolo..."
            className="w-full rounded-xl border border-zinc-300 pl-8 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {/* LISTAGEM DE CANDIDATOS */}
      {carregando ? (
        <div className="bg-white p-10 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-500">
          Carregando inscrições...
        </div>
      ) : solicitacoesFiltradas.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-400">
          {filtroStatus === 'pendente'
            ? 'Nenhuma solicitação pendente de avaliação no momento.'
            : 'Nenhum registro no histórico ainda.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {solicitacoesFiltradas.map((sol) => (
            <div
              key={sol.id}
              className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                {sol.fotoPerfilUrl ? (
                  <img
                    src={sol.fotoPerfilUrl}
                    alt={sol.nome}
                    className="w-16 h-16 rounded-2xl object-cover border border-zinc-300 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 font-bold text-lg shrink-0">
                    {sol.nome?.charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                      {sol.protocolo}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        sol.status === 'aprovado'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sol.status === 'reprovado'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {sol.status === 'aprovado'
                        ? 'Aprovado • Acesso Liberado'
                        : sol.status === 'reprovado'
                        ? 'Não Aprovado'
                        : 'Aguardando Banca'}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-zinc-900 mt-1 truncate">
                    {sol.nome}
                  </h4>
                  <p className="text-xs text-zinc-500">
                    {sol.idadeInscricao} anos • {sol.conhecimentoPrevio}
                  </p>
                  <p className="text-[11px] text-[#D81B60] font-semibold mt-0.5">
                    {sol.instagram} • {sol.telefone}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                <p className="text-zinc-700">
                  <strong>Dias Úteis:</strong> {(sol.diasUteisDisponiveis || []).join(', ')}
                </p>
                <p className="text-zinc-700">
                  <strong>Estilos:</strong> {(sol.estilosInteresse || []).join(', ')}
                </p>
                {sol.ultimoLembreteEnviadoEm && (
                  <p className="text-[10px] font-bold text-amber-700">
                    🔔 Último lembrete enviado em:{' '}
                    {new Date(sol.ultimoLembreteEnviadoEm).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCandidatoAberto(sol)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 py-2 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
                >
                  <Eye size={14} /> Ficha Completa
                </button>

                {sol.status === 'pendente' && (
                  <>
                    <button
                      type="button"
                      disabled={processandoId === sol.id}
                      onClick={() => handleEnviarLembreteIndividual(sol)}
                      title="Enviar lembrete por e-mail"
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-2 text-xs font-bold uppercase text-white"
                    >
                      <Mail size={14} /> Lembrete
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirWhatsAppLembrete(sol)}
                      title="Mandar lembrete no WhatsApp"
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#25D366] hover:brightness-95 px-3 py-2 text-xs font-bold uppercase text-white"
                    >
                      <Phone size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={processandoId === sol.id}
                      onClick={() => handleAprovarCandidato(sol)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold uppercase text-white"
                    >
                      <CheckCircle2 size={14} /> Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={processandoId === sol.id}
                      onClick={() => handleReprovarCandidato(sol)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-bold uppercase text-white"
                    >
                      <XCircle size={14} />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  disabled={processandoId === sol.id}
                  onClick={() => handleExcluirSolicitacao(sol)}
                  title="Excluir registro do histórico"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-2 text-xs font-bold uppercase text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE FICHA COMPLETA DO CANDIDATO */}
      {candidatoAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-4">
                {candidatoAberto.fotoPerfilUrl && (
                  <img
                    src={candidatoAberto.fotoPerfilUrl}
                    alt={candidatoAberto.nome}
                    className="w-20 h-20 rounded-2xl object-cover border border-zinc-300"
                  />
                )}
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#D81B60]">
                    {candidatoAberto.protocolo}
                  </span>
                  <h3 className="text-xl font-bold text-zinc-900">{candidatoAberto.nome}</h3>
                  <p className="text-xs text-zinc-500">
                    CPF: {candidatoAberto.cpf} • Nasc: {candidatoAberto.dataNascimento} (
                    {candidatoAberto.idadeInscricao} anos)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCandidatoAberto(null)}
                className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
              <p className="flex items-center gap-1.5">
                <Phone size={14} className="text-[#D81B60]" />{' '}
                <strong>WhatsApp:</strong> {candidatoAberto.telefone}
              </p>
              <p className="flex items-center gap-1.5">
                <Instagram size={14} className="text-[#D81B60]" />{' '}
                <strong>Instagram:</strong> {candidatoAberto.instagram}
              </p>
              <p className="sm:col-span-2">
                <strong>E-mail (Usuário):</strong> {candidatoAberto.email}
              </p>
              <p className="sm:col-span-2">
                <strong>Endereço:</strong> {candidatoAberto.endereco}
              </p>
              {candidatoAberto.isMenorDe18 && (
                <p className="sm:col-span-2 text-amber-900 bg-amber-100 p-2 rounded-lg">
                  <strong>Responsável Legal:</strong> {candidatoAberto.nomeResponsavelLegal} (
                  {candidatoAberto.telefoneResponsavelLegal})
                </p>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl border border-zinc-200">
                <strong className="text-[#4A041C] uppercase block mb-1">
                  Disponibilidade & Estilos de Interesse:
                </strong>
                <p>
                  <strong>Sábado (15h–20h):</strong>{' '}
                  {candidatoAberto.disponibilidadeSabado ? 'Confirmado' : 'Não'}
                </p>
                <p>
                  <strong>Dias Úteis:</strong>{' '}
                  {(candidatoAberto.diasUteisDisponiveis || []).join(', ')}
                </p>
                <p>
                  <strong>Estilos:</strong> {(candidatoAberto.estilosInteresse || []).join(', ')}
                </p>
              </div>

              {Array.isArray(candidatoAberto.perguntasDetalhadas) &&
              candidatoAberto.perguntasDetalhadas.length > 0 ? (
                candidatoAberto.perguntasDetalhadas.map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-zinc-200 space-y-1">
                    <strong className="text-[#4A041C] uppercase block">
                      {item.enunciado}
                    </strong>
                    <p className="text-zinc-700 leading-relaxed">{item.resposta}</p>
                  </div>
                ))
              ) : (
                <div className="p-3.5 rounded-xl border border-zinc-200 space-y-1.5">
                  <strong className="text-[#4A041C] uppercase block">
                    Perfil & Motivação:
                  </strong>
                  <p>
                    <strong>Nível:</strong> {candidatoAberto.conhecimentoPrevio}
                  </p>
                  <p>
                    <strong>Experiência:</strong> {candidatoAberto.experienciaSalao}
                  </p>
                  <p>
                    <strong>Como soube:</strong> {candidatoAberto.comoSoube}
                  </p>
                  <p>
                    <strong>Motivação:</strong> {candidatoAberto.motivacaoStudio}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-zinc-200">
              {candidatoAberto.status === 'pendente' && (
                <>
                  <button
                    type="button"
                    disabled={processandoId === candidatoAberto.id}
                    onClick={() => handleEnviarLembreteIndividual(candidatoAberto)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 py-3 text-xs font-bold uppercase text-white"
                  >
                    <Mail size={16} /> Enviar Lembrete E-mail
                  </button>
                  <button
                    type="button"
                    disabled={processandoId === candidatoAberto.id}
                    onClick={() => handleAprovarCandidato(candidatoAberto)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold uppercase text-white"
                  >
                    <CheckCircle2 size={16} /> Aprovar & Habilitar Acesso
                  </button>
                  <button
                    type="button"
                    disabled={processandoId === candidatoAberto.id}
                    onClick={() => handleReprovarCandidato(candidatoAberto)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-5 py-3 text-xs font-bold uppercase text-white"
                  >
                    <XCircle size={16} /> Não Aprovar
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={processandoId === candidatoAberto.id}
                onClick={() => handleExcluirSolicitacao(candidatoAberto)}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 px-5 py-3 text-xs font-bold uppercase text-red-600"
              >
                <Trash2 size={16} /> Excluir Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
