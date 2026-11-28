import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
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
  CreditCard,
  AlertTriangle,
  LogOut,
  Building2,
  User,
  Users,
  X,
  Copy,
  Check,
  QrCode,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';

const CHAVE_PIX_STUDIO = '20936547000100';

const DIAS_SEMANA_MAP = [
  { idx: 0, chaves: ['dom', 'domingo'] },
  { idx: 1, chaves: ['seg', 'segunda'] },
  { idx: 2, chaves: ['ter', 'terca', 'terça'] },
  { idx: 3, chaves: ['qua', 'quarta'] },
  { idx: 4, chaves: ['qui', 'quinta'] },
  { idx: 5, chaves: ['sex', 'sexta'] },
  { idx: 6, chaves: ['sab', 'sáb', 'sabado', 'sábado'] },
];

function limparCpf(v) {
  return (v || '').replace(/\D/g, '');
}

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

function calcularProximoVencimento(diaVencimentoPadrao = 5) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = Number(diaVencimentoPadrao) || 5;

  let alvo = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  if (alvo < hoje) {
    alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
  }
  const diffDias = Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return {
    dataIso: alvo.toISOString().split('T')[0],
    dataBr: alvo.toLocaleDateString('pt-BR'),
    diffDias,
  };
}

export default function PainelAluno() {
  const { user, userData, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [abaAtiva, setAbaAtiva] = useState('turmas');
  const [carregando, setCarregando] = useState(true);

  const [minhasMatriculas, setMinhasMatriculas] = useState([]);
  const [todosCursos, setTodosCursos] = useState([]);
  const [todosEventos, setTodosEventos] = useState([]);
  const [meuFinanceiro, setMeuFinanceiro] = useState([]);
  const [minhasMensagens, setMinhasMensagens] = useState([]);

  const [agora, setAgora] = useState(new Date());
  const [permissaoNotif, setPermissaoNotif] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Modal de Inscrição Rápida Logada (Individual ou Casal)
  const [cursoModalInscricao, setCursoModalInscricao] = useState(null);
  const [modalidadeRapida, setModalidadeRapida] = useState('individual'); // 'individual' | 'casal'
  const [etapaModal, setEtapaModal] = useState('confirmar'); // 'confirmar' | 'pagamento'
  const [parceiroEncontradoModal, setParceiroEncontradoModal] = useState(null);
  const [nomeDupla, setNomeDupla] = useState('');
  const [cpfDupla, setCpfDupla] = useState('');
  const [whatsDupla, setWhatsDupla] = useState('');
  const [nascDupla, setNascDupla] = useState('');
  const [emailDupla, setEmailDupla] = useState('');
  const [idTransacaoPixModal, setIdTransacaoPixModal] = useState('');
  const [pixCopiadoModal, setPixCopiadoModal] = useState(false);
  const [processandoModal, setProcessandoModal] = useState(false);

  // Formulário Fale Conosco (Coordenação ou Professor)
  const [destinoTipo, setDestinoTipo] = useState('coordenacao');
  const [cursoMensagemId, setCursoMensagemId] = useState('');
  const [assuntoMensagem, setAssuntoMensagem] = useState('Matrícula / Mensalidade / Secretaria');
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
      // Verifica retorno aprovado do Mercado Pago na área do aluno
      const mpStatus = searchParams.get('mp_status');
      const refFinId = searchParams.get('ref');
      if (mpStatus === 'approved' && refFinId) {
        const finSnap = await getDoc(doc(db, 'financeiro', refFinId));
        if (finSnap.exists()) {
          const finData = finSnap.data();
          const hoje = new Date().toISOString().split('T')[0];

          if (finData.status !== 'pago') {
            await updateDoc(doc(db, 'financeiro', refFinId), {
              status: 'pago',
              dataPagamento: hoje,
              metodo: 'Mercado Pago (Aprovado Online)',
            });

            if (finData.cursoId && finData.alunoId) {
              await addDoc(collection(db, 'matriculas'), {
                alunoId: finData.alunoId,
                alunoNome: finData.alunoNomeAvulso,
                roleParticipante: 'aluno',
                cursoId: finData.cursoId,
                cursoTitulo: finData.tituloItem,
                modalidadeInscricao: finData.modalidadeInscricao || 'individual',
                parceiroNome: finData.parceiroNome || '',
                codigoComprovante: finData.codigoComprovante,
                dataMatricula: hoje,
                diasRestantes: 30,
                status: 'ativa',
              });

              if (finData.modalidadeInscricao === 'casal' && finData.parceiroId) {
                await addDoc(collection(db, 'matriculas'), {
                  alunoId: finData.parceiroId,
                  alunoNome: finData.parceiroNome,
                  roleParticipante: 'aluno',
                  cursoId: finData.cursoId,
                  cursoTitulo: finData.tituloItem,
                  modalidadeInscricao: 'casal',
                  parceiroNome: finData.alunoNomeAvulso,
                  codigoComprovante: finData.codigoComprovante,
                  dataMatricula: hoje,
                  diasRestantes: 30,
                  status: 'ativa',
                });
              }
            }
            alert('✅ Pagamento aprovado! Sua matrícula já está ativa em Minhas Turmas.');
          }
          setSearchParams({});
          setAbaAtiva('turmas');
        }
      }

      const [matSnap, cursosSnap, eventosSnap, finSnap, msgsSnap] = await Promise.all([
        getDocs(query(collection(db, 'matriculas'), where('alunoId', '==', user.uid))),
        getDocs(collection(db, 'cursos')),
        getDocs(collection(db, 'eventos')),
        getDocs(query(collection(db, 'financeiro'), where('alunoId', '==', user.uid))),
        getDocs(query(collection(db, 'mensagens'), where('remetenteId', '==', user.uid))),
      ]);

      const mats = matSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.status !== 'cancelada');

      const cursosLista = cursosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const eventosLista = eventosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const finLista = finSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const msgsLista = msgsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataEnvio || '').localeCompare(a.dataEnvio || ''));

      setMinhasMatriculas(mats);
      setTodosCursos(cursosLista);
      setTodosEventos(eventosLista);
      setMeuFinanceiro(finLista);
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

  const abrirModalInscricaoRapida = (cursoObj) => {
    setCursoModalInscricao(cursoObj);
    setModalidadeRapida('individual');
    setEtapaModal('confirmar');
    setParceiroEncontradoModal(null);
    setNomeDupla('');
    setCpfDupla('');
    setWhatsDupla('');
    setNascDupla('');
    setEmailDupla('');
    setIdTransacaoPixModal('');
  };

  const buscarParceiroNoSistema = async (cpfVal, emailVal) => {
    const cpfLimpo = limparCpf(cpfVal);
    const emailLimpo = (emailVal || '').trim().toLowerCase();

    if (cpfLimpo.length === 11) {
      const snap = await getDocs(collection(db, 'users'));
      const achado = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((u) => limparCpf(u.cpf) === cpfLimpo);
      if (achado) {
        setParceiroEncontradoModal(achado);
        setNomeDupla(achado.nome || '');
        setEmailDupla(achado.email || '');
        setWhatsDupla(achado.telefoneRaw || achado.telefone || '');
        setNascDupla(achado.dataNascimento || '');
        return;
      }
    }

    if (emailLimpo && emailLimpo.includes('@')) {
      const q = query(collection(db, 'users'), where('email', '==', emailLimpo));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        const achado = { id: d.id, ...d.data() };
        setParceiroEncontradoModal(achado);
        setNomeDupla(achado.nome || '');
        setEmailDupla(achado.email || '');
        setWhatsDupla(achado.telefoneRaw || achado.telefone || '');
        setNascDupla(achado.dataNascimento || '');
        return;
      }
    }

    setParceiroEncontradoModal(null);
  };

  const valorModalCalculado = useMemo(() => {
    if (!cursoModalInscricao) return 0;
    const indiv = Number(cursoModalInscricao.valor || 0);
    if (modalidadeRapida === 'individual') return indiv;
    return cursoModalInscricao.valorCasal && Number(cursoModalInscricao.valorCasal) > 0
      ? Number(cursoModalInscricao.valorCasal)
      : indiv * 2;
  }, [cursoModalInscricao, modalidadeRapida]);

  const garantirIdParceiroModal = async () => {
    if (modalidadeRapida !== 'casal') return null;
    if (parceiroEncontradoModal?.id) return parceiroEncontradoModal.id;

    const refParc = await addDoc(collection(db, 'users'), {
      nome: nomeDupla,
      email: emailDupla.trim().toLowerCase(),
      telefone: whatsDupla,
      telefoneRaw: whatsDupla,
      dataNascimento: nascDupla,
      cpf: cpfDupla,
      endereco: userData?.endereco || '',
      role: 'aluno',
      roles: ['aluno'],
      tipoCadastro: 'avulso_online_dupla',
      status: 'ativo',
      criadoEm: new Date().toISOString(),
    });
    return refParc.id;
  };

  const handleConfirmarEtapaModal = (e) => {
    e.preventDefault();
    if (valorModalCalculado === 0) {
      concluirInscricaoLogada(true);
    } else {
      setEtapaModal('pagamento');
    }
  };

  const pagarInscricaoLogadaMP = async () => {
    if (!cursoModalInscricao) return;
    setProcessandoModal(true);
    try {
      const codigoComprovante = `NC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const hoje = new Date().toISOString().split('T')[0];
      const parceiroId = await garantirIdParceiroModal();
      const nomeTitular = userData?.nome || user.email;

      const finRef = await addDoc(collection(db, 'financeiro'), {
        tipo: 'receita',
        alunoId: user.uid,
        alunoNomeAvulso: nomeTitular,
        parceiroId: parceiroId || '',
        parceiroNome: modalidadeRapida === 'casal' ? nomeDupla : '',
        modalidadeInscricao: modalidadeRapida,
        compradorEmail: userData?.email || user.email,
        compradorTelefone: userData?.telefoneRaw || userData?.telefone || '',
        cpfComprador: userData?.cpf || '',
        cursoId: cursoModalInscricao.id,
        eventoId: '',
        tituloItem: cursoModalInscricao.titulo,
        dataSessao: cursoModalInscricao.dataInfo || '',
        qtdInteira: 1,
        qtdMeia: 0,
        valor: valorModalCalculado,
        dataVencimento: hoje,
        status: 'pendente_mp',
        metodo: 'Mercado Pago Checkout',
        codigoComprovante,
        observacao:
          modalidadeRapida === 'casal'
            ? `Inscrição Casal Portal (${cursoModalInscricao.titulo}) - ${nomeTitular} & ${nomeDupla}`
            : `Inscrição Portal (${cursoModalInscricao.titulo}) - ${nomeTitular}`,
        criadoEm: new Date().toISOString(),
      });

      const resp = await fetch('/api/criar-pagamento-mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscricaoId: finRef.id,
          tituloEvento: cursoModalInscricao.titulo,
          descricaoItem:
            modalidadeRapida === 'casal'
              ? `${cursoModalInscricao.titulo} - Inscrição Casal (${nomeTitular} & ${nomeDupla})`
              : `${cursoModalInscricao.titulo} - Inscrição Individual (${nomeTitular})`,
          dataSessao: cursoModalInscricao.dataInfo || '',
          qtdInteira: 1,
          valorInteira: valorModalCalculado,
          qtdMeia: 0,
          valorMeia: 0,
          compradorNome: nomeTitular,
          compradorEmail: userData?.email || user.email,
          originUrl: window.location.origin,
          returnPath: '/aluno',
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.init_point) {
        throw new Error(data.error || 'Erro ao gerar link do Mercado Pago.');
      }

      window.location.href = data.init_point;
    } catch (err) {
      alert('Erro ao abrir Mercado Pago: ' + err.message);
    } finally {
      setProcessandoModal(false);
    }
  };

  const concluirInscricaoLogada = async (isGratuito = false) => {
    if (!cursoModalInscricao) return;
    if (!isGratuito && !idTransacaoPixModal.trim()) {
      alert('Cole o código/ID do comprovante PIX para confirmar.');
      return;
    }

    setProcessandoModal(true);
    try {
      const codigoComprovante = `NC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const hoje = new Date().toISOString().split('T')[0];
      const parceiroId = await garantirIdParceiroModal();
      const nomeTitular = userData?.nome || user.email;

      // Matrícula do aluno logado
      await addDoc(collection(db, 'matriculas'), {
        alunoId: user.uid,
        alunoNome: nomeTitular,
        roleParticipante: 'aluno',
        cursoId: cursoModalInscricao.id,
        cursoTitulo: cursoModalInscricao.titulo,
        tipoInscricao: 'curso',
        modalidadeInscricao: modalidadeRapida,
        parceiroNome: modalidadeRapida === 'casal' ? nomeDupla : '',
        codigoComprovante,
        dataMatricula: hoje,
        diasRestantes: 30,
        status: 'ativa',
      });

      // Matrícula da dupla se for casal
      if (modalidadeRapida === 'casal' && parceiroId) {
        await addDoc(collection(db, 'matriculas'), {
          alunoId: parceiroId,
          alunoNome: nomeDupla,
          roleParticipante: 'aluno',
          cursoId: cursoModalInscricao.id,
          cursoTitulo: cursoModalInscricao.titulo,
          tipoInscricao: 'curso',
          modalidadeInscricao: 'casal',
          parceiroNome: nomeTitular,
          codigoComprovante,
          dataMatricula: hoje,
          diasRestantes: 30,
          status: 'ativa',
        });
      }

      await addDoc(collection(db, 'financeiro'), {
        tipo: 'receita',
        alunoId: user.uid,
        alunoNomeAvulso: nomeTitular,
        parceiroId: parceiroId || '',
        parceiroNome: modalidadeRapida === 'casal' ? nomeDupla : '',
        modalidadeInscricao: modalidadeRapida,
        cursoId: cursoModalInscricao.id,
        eventoId: '',
        tituloItem: cursoModalInscricao.titulo,
        valor: valorModalCalculado,
        dataVencimento: hoje,
        dataPagamento: hoje,
        status: 'pago',
        metodo: isGratuito ? 'Gratuito' : `PIX Direto (Ref: ${idTransacaoPixModal})`,
        codigoComprovante,
        observacao:
          modalidadeRapida === 'casal'
            ? `Inscrição Casal Portal (${cursoModalInscricao.titulo}) - ${nomeTitular} & ${nomeDupla}`
            : `Inscrição Portal (${cursoModalInscricao.titulo}) - ${nomeTitular}`,
        criadoEm: new Date().toISOString(),
      });

      alert(
        modalidadeRapida === 'casal'
          ? `✅ Inscrição em casal confirmada para ${nomeTitular} & ${nomeDupla}!`
          : '✅ Inscrição confirmada com sucesso!'
      );
      setCursoModalInscricao(null);
      setAbaAtiva('turmas');
      carregarDadosAluno();
    } catch (err) {
      alert('Erro ao concluir inscrição: ' + err.message);
    } finally {
      setProcessandoModal(false);
    }
  };

  const turmasMatriculadas = useMemo(() => {
    const hojeIso = new Date().toISOString().split('T')[0];

    return minhasMatriculas
      .map((mat) => {
        const cursoObj = todosCursos.find((c) => c.id === mat.cursoId);
        if (!cursoObj) return null;

        const diaVenc = Number(cursoObj.diaVencimento) || 5;
        const proxVenc = calcularProximoVencimento(diaVenc);

        const lancamentosTurma = meuFinanceiro.filter(
          (f) => f.cursoId === cursoObj.id && f.tipo === 'receita' && f.status !== 'estornado'
        );
        const pagasList = lancamentosTurma.filter((f) => f.status === 'pago');
        const pendentesList = lancamentosTurma.filter((f) => f.status === 'pendente');

        const emAlerta = pendentesList.filter((p) => {
          if (!p.dataVencimento) return true;
          const diff = Math.ceil(
            (new Date(p.dataVencimento + 'T00:00:00') - new Date(hojeIso + 'T00:00:00')) /
              (1000 * 60 * 60 * 24)
          );
          return diff <= 7;
        });

        const isBolsistaNaTurma =
          mat.roleParticipante === 'bolsista' ||
          (Array.isArray(userData?.roles) && userData.roles.includes('bolsista'));

        return {
          ...cursoObj,
          matriculaId: mat.id,
          dataMatricula: mat.dataMatricula,
          parceiroNome: mat.parceiroNome || '',
          diaVencimento: diaVenc,
          proximoVencimento: proxVenc,
          qtdPagas: pagasList.length,
          qtdPendentes: pendentesList.length,
          qtdPertoVencer: emAlerta.length,
          isBolsistaNaTurma,
          alertaHoje: verificarAulaProximaHoje(cursoObj, agora),
        };
      })
      .filter(Boolean);
  }, [minhasMatriculas, todosCursos, meuFinanceiro, userData, agora]);

  const resumoMensalidades = useMemo(() => {
    const totalPagas = meuFinanceiro.filter(
      (f) => f.tipo === 'receita' && f.status === 'pago'
    ).length;

    const pendentes = meuFinanceiro.filter(
      (f) => f.tipo === 'receita' && f.status === 'pendente'
    );

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const pertoDeVencer = pendentes.filter((p) => {
      if (!p.dataVencimento) return true;
      const venc = new Date(p.dataVencimento + 'T00:00:00');
      const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias <= 7;
    });

    const turmasPagantesProximas = turmasMatriculadas.filter(
      (t) =>
        !t.isBolsistaNaTurma &&
        Number(t.valor || 0) > 0 &&
        t.qtdPendentes === 0 &&
        t.proximoVencimento.diffDias <= 7
    );

    return {
      totalPagas,
      qtdPertoVencer: pertoDeVencer.length + turmasPagantesProximas.length,
      listaAlertas: [
        ...pertoDeVencer.map((p) => ({
          id: p.id,
          titulo: p.observacao || 'Mensalidade',
          dataBr: p.dataVencimento ? p.dataVencimento.split('-').reverse().join('/') : 'Dia 05',
          valor: Number(p.valor || 0),
        })),
        ...turmasPagantesProximas.map((t) => ({
          id: `prev_${t.id}`,
          titulo: `Mensalidade — ${t.titulo}`,
          dataBr: t.proximoVencimento.dataBr,
          valor: Number(t.valor || 0),
        })),
      ],
    };
  }, [meuFinanceiro, turmasMatriculadas]);

  const alertasAulaComecando = useMemo(() => {
    return turmasMatriculadas.filter(
      (t) =>
        t.alertaHoje &&
        (t.alertaHoje.status === 'em_breve' || t.alertaHoje.status === 'andamento')
    );
  }, [turmasMatriculadas]);

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

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!textoMensagem.trim()) return;

    if (destinoTipo === 'professor') {
      const turmaAlvo = turmasMatriculadas.find((t) => t.id === cursoMensagemId);
      if (!turmaAlvo) {
        alert('Selecione uma turma matriculada para enviar a mensagem ao professor.');
        return;
      }

      setEnviandoMsg(true);
      try {
        await addDoc(collection(db, 'mensagens'), {
          remetenteId: user.uid,
          remetenteNome: userData?.nome || user.email,
          remetenteTelefone: userData?.telefone || '',
          destinoTipo: 'professor',
          destinatarioId: turmaAlvo.profId || '',
          destinatarioNome: turmaAlvo.professoresNomes || 'Professor(a)',
          cursoId: turmaAlvo.id,
          cursoTitulo: turmaAlvo.titulo,
          assunto: assuntoMensagem,
          texto: `[${assuntoMensagem}] ${textoMensagem.trim()}`,
          lida: false,
          resposta: '',
          dataEnvio: new Date().toISOString(),
        });

        setTextoMensagem('');
        alert(`✅ Mensagem enviada para ${turmaAlvo.professoresNomes || 'o(a) professor(a)'}!`);
        carregarDadosAluno();
      } catch (err) {
        alert('Erro ao enviar mensagem: ' + err.message);
      } finally {
        setEnviandoMsg(false);
      }
      return;
    }

    setEnviandoMsg(true);
    try {
      await addDoc(collection(db, 'mensagens'), {
        remetenteId: user.uid,
        remetenteNome: userData?.nome || user.email,
        remetenteTelefone: userData?.telefone || '',
        destinoTipo: 'coordenacao',
        destinatarioId: 'coordenacao',
        destinatarioNome: 'Coordenação Geral',
        cursoId: '',
        cursoTitulo: 'Atendimento / Secretaria',
        assunto: assuntoMensagem,
        texto: `[${assuntoMensagem}] ${textoMensagem.trim()}`,
        lida: false,
        resposta: '',
        dataEnvio: new Date().toISOString(),
      });

      setTextoMensagem('');
      alert('✅ Mensagem enviada diretamente para a Coordenação Geral!');
      carregarDadosAluno();
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message);
    } finally {
      setEnviandoMsg(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900 pb-12">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-studio.png" alt="No Compasso" className="h-10 w-10 object-contain" />
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-[#D81B60]">
                Área do Aluno • No Compasso
              </span>
              <h1 className="text-base sm:text-lg font-bold uppercase font-condensed text-[#4A041C]">
                No Compasso Studio de Dança
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs font-semibold text-zinc-600">
              Olá, <strong>{userData?.nome?.split(' ')[0] || 'Aluno(a)'}</strong>
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {carregando ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Carregando seu painel do aluno...
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-[#4A041C] to-[#D81B60] rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider mb-2">
                    Portal do Aluno
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold font-condensed uppercase">
                    Olá, {userData?.nome?.split(' ')[0] || 'Dançarino(a)'}!
                  </h2>
                  <p className="text-xs sm:text-sm text-pink-100 mt-1">
                    Acompanhe seus dias de aula, mensalidades, novidades e fale com a coordenação ou professores.
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-pink-100">
                      Mensalidades / Parcelas Pagas
                    </span>
                    <strong className="text-2xl font-bold font-condensed text-emerald-300">
                      {resumoMensalidades.totalPagas} paga(s)
                    </strong>
                  </div>
                  <CheckCircle2 size={28} className="text-emerald-300 opacity-90" />
                </div>

                <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-pink-100">
                      Mensalidades Perto de Vencer
                    </span>
                    <strong className="text-2xl font-bold font-condensed text-amber-300">
                      {resumoMensalidades.qtdPertoVencer} alerta(s)
                    </strong>
                  </div>
                  <CreditCard size={28} className="text-amber-300 opacity-90" />
                </div>
              </div>
            </div>

            {resumoMensalidades.listaAlertas.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-950">
                  <AlertTriangle size={16} className="text-amber-600" />
                  Atenção ao Vencimento da(s) Mensalidade(s)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {resumoMensalidades.listaAlertas.map((al) => (
                    <div
                      key={al.id}
                      className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-zinc-900 block">{al.titulo}</strong>
                        <span className="text-amber-800 font-semibold">
                          Vencimento: {al.dataBr}
                        </span>
                      </div>
                      <strong className="text-[#4A041C] text-sm">
                        R$ {al.valor.toFixed(2).replace('.', ',')}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                          Prof. {alertaTurma.professoresNomes} • No Compasso Studio de Dança
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

                            {turma.parceiroNome && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-200 text-[11px] font-bold text-[#D81B60]">
                                <Users size={13} /> Dupla com: {turma.parceiroNome}
                              </span>
                            )}

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

                            {!turma.isBolsistaNaTurma && Number(turma.valor || 0) > 0 && (
                              <div className="p-3 rounded-xl bg-pink-50/60 border border-pink-200 text-xs flex items-center justify-between">
                                <div>
                                  <span className="block font-bold text-[#4A041C]">
                                    Vencimento: Todo dia {String(turma.diaVencimento).padStart(2, '0')}
                                  </span>
                                  <span className="text-[11px] text-zinc-600">
                                    {turma.qtdPagas} mensalidade(s) paga(s)
                                  </span>
                                </div>
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
                                    turma.qtdPertoVencer > 0 || turma.proximoVencimento.diffDias <= 7
                                      ? 'bg-amber-200 text-amber-950'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  Próx: {turma.proximoVencimento.dataBr}
                                </span>
                              </div>
                            )}

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
                              setDestinoTipo('professor');
                              setCursoMensagemId(turma.id);
                              setAssuntoMensagem('Dúvida sobre a aula / passos');
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

            {abaAtiva === 'novidades' && (
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                  <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C]">
                    Novos Cursos, Workshops & Bailes do Studio
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Para cursos e turmas, seus dados já são preenchidos automaticamente em 1 clique!
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

                          {ativ.categoriaItem === 'evento' ? (
                            <Link
                              to={`/inscricao/evento/${ativ.id}`}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] px-4 py-2.5 text-xs font-bold uppercase text-white shadow-sm transition"
                            >
                              <Ticket size={15} /> Comprar Ingresso
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirModalInscricaoRapida(ativ)}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] px-4 py-2.5 text-xs font-bold uppercase text-white shadow-sm transition"
                            >
                              Inscrever-se <ExternalLink size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'fale_conosco' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit space-y-4">
                  <div className="flex items-center gap-2 text-[#4A041C]">
                    <MessageSquare size={20} className="text-[#D81B60]" />
                    <h3 className="text-lg font-bold uppercase font-condensed">
                      Enviar Mensagem
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
                      Para quem deseja enviar?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDestinoTipo('coordenacao');
                          setAssuntoMensagem('Matrícula / Mensalidade / Secretaria');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                          destinoTipo === 'coordenacao'
                            ? 'bg-[#4A041C] text-white border-[#4A041C]'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        <Building2 size={14} /> Coordenação Geral
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDestinoTipo('professor');
                          setAssuntoMensagem('Dúvida sobre a aula / passos');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                          destinoTipo === 'professor'
                            ? 'bg-[#D81B60] text-white border-[#D81B60]'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        <UserCheck size={14} /> Professor da Turma
                      </button>
                    </div>
                  </div>

                  {destinoTipo === 'professor' && turmasMatriculadas.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      Você ainda não possui turma vinculada para falar com um professor específico. Use a opção{' '}
                      <strong>Coordenação Geral</strong> acima para tirar dúvidas ou pedir sua inclusão na turma!
                    </div>
                  ) : (
                    <form onSubmit={handleEnviarMensagem} className="space-y-3">
                      {destinoTipo === 'professor' && (
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
                      )}

                      <div>
                        <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                          Assunto
                        </label>
                        <select
                          value={assuntoMensagem}
                          onChange={(e) => setAssuntoMensagem(e.target.value)}
                          className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                        >
                          {destinoTipo === 'coordenacao' ? (
                            <>
                              <option value="Matrícula / Mensalidade / Secretaria">
                                Matrícula / Mensalidade / Secretaria
                              </option>
                              <option value="Comprovante de Pagamento">
                                Comprovante de Pagamento
                              </option>
                              <option value="Troca de Turma / Horário">
                                Troca de Turma / Horário
                              </option>
                              <option value="Sugestão / Elogio / Outro">
                                Sugestão / Elogio / Outro
                              </option>
                            </>
                          ) : (
                            <>
                              <option value="Dúvida sobre a aula / passos">
                                Dúvida sobre a aula / passos
                              </option>
                              <option value="Aviso de ausência / atraso">
                                Aviso de ausência / atraso
                              </option>
                              <option value="Ensaios / Coreografia">
                                Ensaios / Coreografia
                              </option>
                              <option value="Outro assunto">Outro assunto</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                          Mensagem
                        </label>
                        <textarea
                          rows="4"
                          required
                          placeholder={
                            destinoTipo === 'coordenacao'
                              ? 'Escreva sua mensagem para a secretaria/coordenação do estúdio...'
                              : 'Escreva sua dúvida ou recado para o professor...'
                          }
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
                        {enviandoMsg
                          ? 'Enviando...'
                          : destinoTipo === 'coordenacao'
                          ? 'Enviar para Coordenação Geral'
                          : 'Enviar Mensagem ao Professor'}
                      </button>
                    </form>
                  )}
                </div>

                <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
                  <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900">
                    Mensagens Enviadas ({minhasMensagens.length})
                  </h3>

                  {minhasMensagens.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-8 text-center">
                      Você ainda não enviou nenhuma mensagem.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[460px] overflow-y-auto">
                      {minhasMensagens.map((msg) => (
                        <div
                          key={msg.id}
                          className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#4A041C]">
                              {msg.cursoTitulo || 'Atendimento'}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {msg.dataEnvio
                                ? new Date(msg.dataEnvio).toLocaleDateString('pt-BR')
                                : ''}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-[#D81B60]">
                            Para: {msg.destinatarioNome}
                          </p>
                          <p className="text-zinc-800 bg-white p-2.5 rounded-lg border border-zinc-200">
                            {msg.texto}
                          </p>
                          {msg.resposta && (
                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
                              <strong className="block text-[10px] uppercase text-emerald-800">
                                Resposta de {msg.respondidoPor || msg.destinatarioNome}:
                              </strong>
                              {msg.resposta}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ===================================================================== */}
      {/* MODAL DE INSCRIÇÃO RÁPIDA (SEM REDIGITAR DADOS + OPÇÃO CASAL)          */}
      {/* ===================================================================== */}
      {cursoModalInscricao && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-zinc-200 shadow-2xl overflow-hidden my-8">
            <div className="bg-[#4A041C] p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200">
                  Inscrição Rápida do Portal
                </span>
                <h3 className="text-xl font-bold uppercase font-condensed">
                  {cursoModalInscricao.titulo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCursoModalInscricao(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X size={18} />
              </button>
            </div>

            {etapaModal === 'confirmar' ? (
              <form onSubmit={handleConfirmarEtapaModal} className="p-6 space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <UserCheck size={15} /> Seus dados já foram preenchidos pelo Portal:
                  </p>
                  <p><strong>Nome:</strong> {userData?.nome || user.email}</p>
                  <p>
                    <strong>CPF:</strong> {userData?.cpf || 'Cadastrado'} • <strong>WhatsApp:</strong>{' '}
                    {userData?.telefoneRaw || userData?.telefone || 'Cadastrado'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
                    Escolha a Modalidade
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setModalidadeRapida('individual')}
                      className={`p-3 rounded-xl border text-left transition ${
                        modalidadeRapida === 'individual'
                          ? 'bg-[#4A041C] text-white border-[#4A041C]'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase">
                        <User size={14} /> Individual
                      </span>
                      <span className="block text-sm font-bold mt-1">
                        R$ {Number(cursoModalInscricao.valor || 0).toFixed(2).replace('.', ',')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalidadeRapida('casal')}
                      className={`p-3 rounded-xl border text-left transition ${
                        modalidadeRapida === 'casal'
                          ? 'bg-[#D81B60] text-white border-[#D81B60]'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase">
                        <Users size={14} /> Adicionar Dupla / Casal
                      </span>
                      <span className="block text-sm font-bold mt-1">
                        R${' '}
                        {(cursoModalInscricao.valorCasal && Number(cursoModalInscricao.valorCasal) > 0
                          ? Number(cursoModalInscricao.valorCasal)
                          : Number(cursoModalInscricao.valor || 0) * 2
                        )
                          .toFixed(2)
                          .replace('.', ',')}
                      </span>
                    </button>
                  </div>
                </div>

                {modalidadeRapida === 'casal' && (
                  <div className="p-4 rounded-2xl bg-pink-50/70 border border-[#D81B60]/30 space-y-2.5">
                    <p className="text-xs font-bold uppercase text-[#4A041C]">
                      Dados da Pessoa da sua Dupla
                    </p>

                    {parceiroEncontradoModal && (
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                        ✓ {parceiroEncontradoModal.nome} já tem cadastro no Studio!
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="CPF da dupla"
                        value={cpfDupla}
                        onChange={(e) => {
                          setCpfDupla(e.target.value);
                          if (limparCpf(e.target.value).length === 11) {
                            buscarParceiroNoSistema(e.target.value, emailDupla);
                          }
                        }}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
                      />
                      <input
                        type="email"
                        required
                        placeholder="E-mail da dupla"
                        value={emailDupla}
                        onBlur={() => buscarParceiroNoSistema(cpfDupla, emailDupla)}
                        onChange={(e) => setEmailDupla(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
                      />
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="Nome completo da dupla"
                      value={nomeDupla}
                      onChange={(e) => setNomeDupla(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="WhatsApp (68) 99999-9999"
                        value={whatsDupla}
                        onChange={(e) => setWhatsDupla(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
                      />
                      <input
                        type="date"
                        required
                        value={nascDupla}
                        onChange={(e) => setNascDupla(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={processandoModal}
                  className="w-full rounded-xl bg-[#D81B60] hover:bg-[#AD1457] py-3 text-xs font-bold uppercase tracking-wider text-white shadow"
                >
                  {valorModalCalculado === 0
                    ? 'Confirmar Inscrição Gratuita'
                    : modalidadeRapida === 'casal'
                    ? `Confirmar Dupla & Ir para Pagamento (R$ ${valorModalCalculado.toFixed(2).replace('.', ',')})`
                    : `Confirmar Inscrição Individual (R$ ${valorModalCalculado.toFixed(2).replace('.', ',')})`}
                </button>
              </form>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-zinc-500">Total a Pagar</span>
                    <p className="text-2xl font-bold font-condensed text-[#4A041C]">
                      R$ {valorModalCalculado.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEtapaModal('confirmar')}
                    className="text-xs font-bold text-zinc-500 underline"
                  >
                    Voltar
                  </button>
                </div>

                <button
                  type="button"
                  disabled={processandoModal}
                  onClick={pagarInscricaoLogadaMP}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 py-3 text-xs font-bold uppercase text-white shadow"
                >
                  {processandoModal ? 'Abrindo Mercado Pago...' : 'Pagar Agora no Mercado Pago'}
                  <ExternalLink size={15} />
                </button>

                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5">
                  <span className="block text-[11px] font-bold uppercase text-[#4A041C]">
                    Ou pague via PIX Direto:
                  </span>
                  <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-zinc-300">
                    <span className="font-mono text-xs font-bold">{CHAVE_PIX_STUDIO}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(CHAVE_PIX_STUDIO);
                        setPixCopiadoModal(true);
                        setTimeout(() => setPixCopiadoModal(false), 2000);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-[#4A041C] px-2.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      {pixCopiadoModal ? <Check size={13} /> : <Copy size={13} />}
                      {pixCopiadoModal ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Cole o ID / Código do comprovante PIX"
                    value={idTransacaoPixModal}
                    onChange={(e) => setIdTransacaoPixModal(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs"
                  />

                  <button
                    type="button"
                    disabled={processandoModal}
                    onClick={() => concluirInscricaoLogada(false)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold uppercase text-white"
                  >
                    <QrCode size={15} /> Confirmar PIX & Ativar Matrícula
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
