import { useState, useEffect, useMemo } from 'react';
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
  MapPin,
  Bell,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Send,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import SegurancaSenhaCard from './SegurancaSenhaCard';

const STUDIO_LAT = -9.9406271;
const STUDIO_LNG = -67.8227701;
const RAIO_MAXIMO_METROS = 130;

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function obterIdentificadorAparelho() {
  const chaveStorage = 'nocompasso_device_uid_v1';
  let idSalvo = localStorage.getItem(chaveStorage);
  if (!idSalvo) {
    const assinaturaHardware = [
      navigator.userAgent,
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join('|');

    let hash = 0;
    for (let i = 0; i < assinaturaHardware.length; i++) {
      hash = (hash << 5) - hash + assinaturaHardware.charCodeAt(i);
      hash |= 0;
    }
    const aleatorio = Math.random().toString(36).substring(2, 10);
    idSalvo = `DEV_${Math.abs(hash)}_${aleatorio}`;
    localStorage.setItem(chaveStorage, idSalvo);
  }
  return idSalvo;
}

function horaParaMinutos(horaStr) {
  if (!horaStr || !horaStr.includes(':')) return null;
  const [h, m] = horaStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function cursoOcorreHoje(dataInfo, diaSemanaIndex) {
  if (!dataInfo) return true;
  const texto = dataInfo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const mapaDias = [
    ['dom'],
    ['seg'],
    ['ter'],
    ['qua'],
    ['qui'],
    ['sex'],
    ['sab'],
  ];

  const algumDiaCitado = mapaDias
    .flat()
    .some((sigla) => texto.includes(sigla));

  if (!algumDiaCitado) return true;
  return mapaDias[diaSemanaIndex].some((sigla) => texto.includes(sigla));
}

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
  const [todasPresencasHoje, setTodasPresencasHoje] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [atividadesDisponiveis, setAtividadesDisponiveis] = useState([]);

  // Estados de Mensagens
  const [professoresLista, setProfessoresLista] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [destinoMensagem, setDestinoMensagem] = useState('admin'); // 'admin' ou uid do professor
  const [assuntoMensagem, setAssuntoMensagem] = useState('');
  const [textoMensagem, setTextoMensagem] = useState('');
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);

  // Estados de Localização e Horário
  const [atividadeSelecionadaKey, setAtividadeSelecionadaKey] = useState('');
  const [coordsUsuario, setCoordsUsuario] = useState(null);
  const [erroGps, setErroGps] = useState('');
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [agora, setAgora] = useState(new Date());

  const [permissaoNotif, setPermissaoNotif] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [registrandoCheckin, setRegistrandoCheckin] = useState(false);

  const deviceId = useMemo(() => obterIdentificadorAparelho(), []);
  const hojeIso = agora.toISOString().split('T')[0];

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const verificarLocalizacaoAtual = () => {
    if (!('geolocation' in navigator)) {
      setErroGps('Seu navegador/celular não suporta geolocalização.');
      return;
    }
    setBuscandoGps(true);
    setErroGps('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordsUsuario({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setBuscandoGps(false);
      },
      (err) => {
        setBuscandoGps(false);
        if (err.code === 1) {
          setErroGps(
            'Permissão de localização negada. Ative o GPS do celular para o site.'
          );
        } else {
          setErroGps(
            'Não foi possível obter sua localização exata. Tente novamente.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    verificarLocalizacaoAtual();
  }, []);

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
            collection(db, 'presencas_bolsistas'),
            where('data', '==', hojeIso)
          )
        ),
        getDocs(
          query(
            collection(db, 'avaliacoes_bolsistas'),
            where('bolsistaId', '==', user.uid)
          )
        ),
        getDocs(collection(db, 'cursos')),
        getDocs(
          query(
            collection(db, 'matriculas'),
            where('alunoId', '==', user.uid)
          )
        ),
        getDocs(collection(db, 'eventos')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'mensagens')),
      ]);

      const extrair = (res) =>
        res.status === 'fulfilled'
          ? res.value.docs.map((d) => ({ id: d.id, ...d.data() }))
          : [];

      const listaPres = extrair(resultados[0]).sort((a, b) =>
        (b.data || '').localeCompare(a.data || '')
      );
      const presHoje = extrair(resultados[1]);
      const listaAval = extrair(resultados[2]).sort((a, b) =>
        (b.dataAvaliacao || '').localeCompare(a.dataAvaliacao || '')
      );
      const todosCursos = extrair(resultados[3]).filter((c) => c.ativo !== false);
      const minhasMatriculas = extrair(resultados[4]);
      const todosEventos = extrair(resultados[5]);
      const todosUsuarios = extrair(resultados[6]);
      const todasMensagens = extrair(resultados[7]);

      // Professores para envio de mensagem
      const profs = todosUsuarios.filter((u) =>
        Array.isArray(u.roles) ? u.roles.includes('prof') : u.role === 'prof'
      );
      setProfessoresLista(profs);

      // Mensagens enviadas por este bolsista OU destinadas a ele / todos os bolsistas
      const minhasMsgs = todasMensagens
        .filter(
          (m) =>
            m.remetenteId === user.uid ||
            m.destinatarioId === user.uid ||
            m.destinatarioTipo === 'todos_bolsistas' ||
            m.destinatarioTipo === 'todos'
        )
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
      setMensagens(minhasMsgs);

      // 1. Turmas vinculadas
      const idsMatriculados = new Set(minhasMatriculas.map((m) => m.cursoId));
      const cursosVinculados = todosCursos.filter(
        (c) =>
          idsMatriculados.has(c.id) ||
          (Array.isArray(c.bolsistasIds) && c.bolsistasIds.includes(user.uid))
      );
      const listaTurmasBase =
        cursosVinculados.length > 0 ? cursosVinculados : todosCursos;

      const itensTurmas = listaTurmasBase.map((c) => ({
        key: `curso_${c.id}`,
        id: c.id,
        categoria: 'turma',
        titulo: c.titulo,
        subtitulo: `${c.dataInfo} • ${c.horaInicio} às ${c.horarioFim}`,
        dataInfo: c.dataInfo,
        dataEspecifica: null,
        horaInicio: c.horaInicio,
        horarioFim: c.horarioFim,
        localNome: 'Studio No Compasso (Estr. das Placas, 1909)',
        lat: STUDIO_LAT,
        lng: STUDIO_LNG,
        professoresNomes: c.professoresNomes,
        frente: c.frente,
      }));

      // 2. Eventos/Espetáculos em que o bolsista foi escalado
      const eventosEscalados = todosEventos.filter(
        (ev) => Array.isArray(ev.bolsistasIds) && ev.bolsistasIds.includes(user.uid)
      );

      const itensEventos = eventosEscalados.map((ev) => {
        const dataIsoEv = ev.data?.includes('/')
          ? ev.data.split('/').reverse().join('-')
          : ev.data || '';
        return {
          key: `evento_${ev.id}`,
          id: ev.id,
          categoria: 'evento',
          titulo: `🎭 Evento: ${ev.titulo}`,
          subtitulo: `${dataIsoEv.split('-').reverse().join('/')} • ${ev.horaInicio} às ${ev.horaFim} • ${ev.local}`,
          dataInfo: dataIsoEv,
          dataEspecifica: dataIsoEv,
          horaInicio: ev.horaInicio,
          horarioFim: ev.horaFim,
          localNome: ev.local || 'Local do Evento',
          lat: typeof ev.lat === 'number' ? ev.lat : STUDIO_LAT,
          lng: typeof ev.lng === 'number' ? ev.lng : STUDIO_LNG,
          professoresNomes: 'Coordenação Geral',
          frente: 'Evento / Espetáculo',
        };
      });

      const unificados = [...itensEventos, ...itensTurmas];

      setPresencas(listaPres);
      setTodasPresencasHoje(presHoje);
      setAvaliacoes(listaAval);
      setAtividadesDisponiveis(unificados);

      if (unificados.length > 0 && !atividadeSelecionadaKey) {
        setAtividadeSelecionadaKey(unificados[0].key);
      }
    } catch (err) {
      console.error('Erro ao carregar portal do bolsista:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosBolsista();
  }, [user?.uid]);

  // Notificações 1h antes do início e no fim (Turmas + Eventos)
  useEffect(() => {
    if (permissaoNotif !== 'granted' || atividadesDisponiveis.length === 0) return;

    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const diaHoje = agora.getDay();
    const primeiroNome = (userData?.nome || 'Bolsista').split(' ')[0];

    atividadesDisponiveis.forEach((ativ) => {
      const ocorreHoje =
        ativ.categoria === 'evento'
          ? ativ.dataEspecifica === hojeIso
          : cursoOcorreHoje(ativ.dataInfo, diaHoje);

      if (!ocorreHoje) return;

      const minInicio = horaParaMinutos(ativ.horaInicio);
      const minFim = horaParaMinutos(ativ.horarioFim);

      if (minInicio !== null) {
        const diffInicio = minInicio - minutosAgora;
        const chaveNotifAntes = `notif_antes_${hojeIso}_${ativ.key}_${user?.uid}`;
        if (
          diffInicio <= 60 &&
          diffInicio >= 55 &&
          !localStorage.getItem(chaveNotifAntes)
        ) {
          new Notification('No Compasso Studio de Dança', {
            body: `Olá ${primeiroNome}, sua atividade "${ativ.titulo}" está perto de começar (às ${ativ.horaInicio}), por favor não atrase.`,
            icon: '/logo-studio.png',
          });
          localStorage.setItem(chaveNotifAntes, 'enviada');
        }
      }

      if (minFim !== null) {
        const diffFim = minutosAgora - minFim;
        const chaveNotifFim = `notif_fim_${hojeIso}_${ativ.key}_${user?.uid}`;
        if (
          diffFim >= 0 &&
          diffFim <= 10 &&
          !localStorage.getItem(chaveNotifFim)
        ) {
          new Notification('Marque sua Presença - No Compasso', {
            body: `Olá ${primeiroNome}, não esqueça de marcar sua presença na atividade "${ativ.titulo}" que acabou de participar!`,
            icon: '/logo-studio.png',
          });
          localStorage.setItem(chaveNotifFim, 'enviada');
        }
      }
    });
  }, [agora, permissaoNotif, atividadesDisponiveis, userData?.nome, hojeIso, user?.uid]);

  const solicitarPermissaoNotificacoes = async () => {
    if (!('Notification' in window)) {
      alert('Este navegador não suporta notificações.');
      return;
    }
    const res = await Notification.requestPermission();
    setPermissaoNotif(res);
    if (res === 'granted') {
      new Notification('Lembretes Ativados!', {
        body: `Olá ${(userData?.nome || '').split(' ')[0]}, você será avisado 1h antes das aulas/eventos e ao término para marcar presença.`,
        icon: '/logo-studio.png',
      });
    }
  };

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();
    if (!textoMensagem.trim() || !user?.uid) return;

    setEnviandoMensagem(true);
    try {
      const profSelecionado = professoresLista.find((p) => p.id === destinoMensagem);
      const isParaAdmin = destinoMensagem === 'admin';

      await addDoc(collection(db, 'mensagens'), {
        remetenteId: user.uid,
        remetenteNome: `${userData?.nome || 'Bolsista'} (Bolsista)`,
        remetenteRole: 'bolsista',
        destinatarioTipo: isParaAdmin ? 'admin' : 'prof',
        destinatarioId: isParaAdmin ? 'admin' : destinoMensagem,
        destinatarioNome: isParaAdmin
          ? 'Coordenação Geral / Admin'
          : `Prof. ${profSelecionado?.nome || ''}`,
        assunto: assuntoMensagem.trim() || 'Comunicado de Bolsista',
        texto: textoMensagem.trim(),
        lida: false,
        criadoEm: new Date().toISOString(),
      });

      setAssuntoMensagem('');
      setTextoMensagem('');
      alert('✅ Mensagem enviada com sucesso!');
      carregarDadosBolsista();
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message);
    } finally {
      setEnviandoMensagem(false);
    }
  };

  const atividadeAtual = atividadesDisponiveis.find(
    (a) => a.key === atividadeSelecionadaKey
  );

  const distanciaAlvo = useMemo(() => {
    if (!coordsUsuario || !atividadeAtual) return null;
    return calcularDistanciaMetros(
      coordsUsuario.lat,
      coordsUsuario.lng,
      atividadeAtual.lat,
      atividadeAtual.lng
    );
  }, [coordsUsuario, atividadeAtual]);

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const diaHoje = agora.getDay();

  const avaliacaoJanela = useMemo(() => {
    if (!atividadeAtual) {
      return { liberado: false, motivo: 'Nenhuma turma ou evento vinculado.' };
    }

    const ehHoje =
      atividadeAtual.categoria === 'evento'
        ? atividadeAtual.dataEspecifica === hojeIso
        : cursoOcorreHoje(atividadeAtual.dataInfo, diaHoje);

    if (!ehHoje) {
      return {
        liberado: false,
        motivo: `Agendado para (${atividadeAtual.dataInfo.split('-').reverse().join('/')}), não hoje.`,
      };
    }

    const minFim = horaParaMinutos(atividadeAtual.horarioFim);
    if (minFim === null) {
      return {
        liberado: false,
        motivo: 'Horário de término não configurado pela coordenação.',
      };
    }

    const minLimite = minFim + 60;
    if (minutosAgora < minFim) {
      return {
        liberado: false,
        motivo: `Aguarde o encerramento. A presença abre às ${atividadeAtual.horarioFim}.`,
      };
    }
    if (minutosAgora > minLimite) {
      const hLim = String(Math.floor(minLimite / 60)).padStart(2, '0');
      const mLim = String(minLimite % 60).padStart(2, '0');
      return {
        liberado: false,
        motivo: `Prazo encerrado! A tolerância de 1 hora após o término fechou às ${hLim}:${mLim}.`,
      };
    }

    return { liberado: true, motivo: 'Dentro do horário permitido!' };
  }, [atividadeAtual, minutosAgora, diaHoje, hojeIso]);

  const noLocalCorreto =
    distanciaAlvo !== null && distanciaAlvo <= RAIO_MAXIMO_METROS;

  const chaveAtividadeHoje = atividadeAtual
    ? `${hojeIso}_${atividadeAtual.key}`
    : '';
  const aparelhoJaUsadoNestaAtividade = todasPresencasHoje.some(
    (p) => p.atividadeChave === chaveAtividadeHoje && p.deviceId === deviceId
  );
  const bolsistaJaMarcouNestaAtividade = todasPresencasHoje.some(
    (p) => p.atividadeChave === chaveAtividadeHoje && p.bolsistaId === user?.uid
  );

  const podeConfirmarPresenca =
    avaliacaoJanela.liberado &&
    noLocalCorreto &&
    !aparelhoJaUsadoNestaAtividade &&
    !bolsistaJaMarcouNestaAtividade;

  const handleRegistrarPresenca = async (e) => {
    e.preventDefault();
    if (!podeConfirmarPresenca || !atividadeAtual || !user?.uid) return;

    setRegistrandoCheckin(true);
    try {
      await addDoc(collection(db, 'presencas_bolsistas'), {
        bolsistaId: user.uid,
        bolsistaNome: userData?.nome || 'Bolsista',
        cursoId: atividadeAtual.categoria === 'turma' ? atividadeAtual.id : '',
        eventoId: atividadeAtual.categoria === 'evento' ? atividadeAtual.id : '',
        atividadeChave: chaveAtividadeHoje,
        deviceId,
        distanciaMetros: distanciaAlvo,
        data: hojeIso,
        tipoAtividade: atividadeAtual.titulo,
        descricao: `${atividadeAtual.localNome} (${atividadeAtual.horaInicio} às ${atividadeAtual.horarioFim}) • GPS: ${distanciaAlvo}m`,
        status: 'presente',
        lancadoPorId: user.uid,
        lancadoPorNome: `${userData?.nome || 'Bolsista'} (Check-in GPS Validado)`,
        criadoEm: new Date().toISOString(),
      });

      alert(
        `✅ Presença confirmada em "${atividadeAtual.titulo}" a ${distanciaAlvo}m do local!`
      );
      carregarDadosBolsista();
    } catch (err) {
      alert('Erro ao registrar presença: ' + err.message);
    } finally {
      setRegistrandoCheckin(false);
    }
  };

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

  const abas = [
    { id: 'visao_geral', label: 'Minha Bolsa & Check-in', icon: Award },
    { id: 'desempenho', label: 'Minhas Avaliações', icon: TrendingUp },
    { id: 'mensagens', label: `Mensagens (${mensagens.length})`, icon: MessageSquare },
    { id: 'turmas_perfil', label: 'Agenda & Conta', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900">
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

          <div className="flex items-center gap-2 sm:gap-3">
            {permissaoNotif !== 'granted' && (
              <button
                type="button"
                onClick={solicitarPermissaoNotificacoes}
                className="flex items-center gap-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 px-3 py-2 text-xs font-bold hover:bg-amber-200 transition"
              >
                <Bell size={14} />
                <span className="hidden sm:inline">Ativar Alertas</span>
              </button>
            )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-800 flex items-center gap-1.5">
                  <UserCheck size={15} className="text-emerald-600" /> Frequência Registrada
                </span>
                <div className="my-2">
                  <strong className="text-3xl font-condensed text-emerald-900">
                    {taxaFrequencia !== null ? `${taxaFrequencia}%` : '—'}
                  </strong>
                  <span className="block text-xs text-zinc-500">
                    {qtdPresente} presença(s) validada(s)
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase text-[#D81B60] flex items-center gap-1.5">
                  <Sparkles size={15} /> Índice de Desempenho
                </span>
                <div className="my-2">
                  <strong className="text-3xl font-condensed text-[#4A041C]">
                    {mediaGeral !== null ? `${mediaGeral} / 5.0` : 'Aguardando'}
                  </strong>
                  <span className="block text-xs text-zinc-500">
                    {avaliacoes.length} avaliação(ões) técnica(s)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                    <CheckSquare size={18} className="text-[#D81B60]" /> Check-in Presencial (GPS)
                  </h3>
                  <button
                    type="button"
                    onClick={verificarLocalizacaoAtual}
                    className="text-xs font-bold text-[#D81B60] flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw size={12} className={buscandoGps ? 'animate-spin' : ''} />
                    Atualizar GPS
                  </button>
                </div>

                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    noLocalCorreto
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <MapPin size={15} />
                    {buscandoGps
                      ? 'Verificando sua localização...'
                      : erroGps
                      ? erroGps
                      : noLocalCorreto
                      ? `No local autorizado (${distanciaAlvo}m)`
                      : `Fora do local (${distanciaAlvo ?? '?'}m de distância)`}
                  </p>
                  <p className="text-[11px] opacity-85">
                    Local exigido: <strong>{atividadeAtual?.localNome || 'Studio No Compasso'}</strong> (até {RAIO_MAXIMO_METROS}m).
                  </p>
                </div>

                <form onSubmit={handleRegistrarPresenca} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Turma ou Evento Escalado
                    </label>
                    <select
                      value={atividadeSelecionadaKey}
                      onChange={(e) => setAtividadeSelecionadaKey(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold"
                    >
                      {atividadesDisponiveis.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.titulo} ({a.subtitulo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      avaliacaoJanela.liberado
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-zinc-100 border-zinc-300 text-zinc-700'
                    }`}
                  >
                    <p className="font-bold flex items-center gap-1.5">
                      <Clock size={14} /> {avaliacaoJanela.motivo}
                    </p>
                  </div>

                  {aparelhoJaUsadoNestaAtividade && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-xs text-red-800 font-bold flex items-start gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>
                        Este celular já registrou uma presença para esta atividade hoje. Não é permitido registrar mais de uma pessoa no mesmo aparelho.
                      </span>
                    </div>
                  )}

                  {bolsistaJaMarcouNestaAtividade && !aparelhoJaUsadoNestaAtividade && (
                    <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-xs text-emerald-900 font-bold">
                      ✅ Você já registrou sua presença nesta atividade hoje!
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!podeConfirmarPresenca || registrandoCheckin}
                    className={`w-full rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-white transition ${
                      podeConfirmarPresenca
                        ? 'bg-[#D81B60] hover:bg-[#AD1457] shadow-md'
                        : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {registrandoCheckin
                      ? 'Validando GPS e Horário...'
                      : podeConfirmarPresenca
                      ? 'Confirmar Presença Agora'
                      : 'Check-in Bloqueado (Verifique Local/Horário)'}
                  </button>

                  <p className="text-[10px] text-zinc-400 flex items-center gap-1 justify-center">
                    <ShieldCheck size={12} /> Validação antifraude ativa • ID Aparelho: {deviceId.slice(0, 12)}...
                  </p>
                </form>
              </div>

              <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
                <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C]">
                  Meu Histórico de Frequência ({presencas.length})
                </h3>

                {presencas.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-8 text-center">
                    Nenhuma presença registrada ainda.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[440px] overflow-y-auto">
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
                            {pr.lancadoPorNome}
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

            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C]">
                Histórico de Avaliações Técnicas ({avaliacoes.length})
              </h3>

              {avaliacoes.length === 0 ? (
                <p className="text-sm text-zinc-400 py-8 text-center">
                  Você ainda não possui avaliações registradas.
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
        ) : abaAtiva === 'mensagens' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit space-y-4">
              <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <Send size={18} className="text-[#D81B60]" /> Enviar Mensagem / Justificativa
              </h3>

              <form onSubmit={handleEnviarMensagem} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Destinatário
                  </label>
                  <select
                    value={destinoMensagem}
                    onChange={(e) => setDestinoMensagem(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900"
                  >
                    <option value="admin">🏛️ Coordenação Geral / Administração</option>
                    {professoresLista.map((p) => (
                      <option key={p.id} value={p.id}>
                        💃 Prof. {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Assunto
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Justificativa de ausência, dúvida sobre escala..."
                    value={assuntoMensagem}
                    onChange={(e) => setAssuntoMensagem(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Mensagem
                  </label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Escreva aqui sua mensagem para a coordenação ou professor..."
                    value={textoMensagem}
                    onChange={(e) => setTextoMensagem(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviandoMensagem}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D81B60] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#AD1457] transition"
                >
                  <Send size={15} />
                  {enviandoMensagem ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <MessageSquare size={18} className="text-[#D81B60]" /> Caixa de Mensagens & Avisos ({mensagens.length})
              </h3>

              {mensagens.length === 0 ? (
                <p className="text-sm text-zinc-400 py-10 text-center">
                  Nenhuma mensagem enviada ou recebida ainda.
                </p>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto">
                  {mensagens.map((m) => {
                    const enviadaPorMim = m.remetenteId === user?.uid;
                    return (
                      <div
                        key={m.id}
                        className={`p-4 rounded-xl border space-y-1.5 ${
                          enviadaPorMim
                            ? 'bg-zinc-50 border-zinc-200'
                            : 'bg-pink-50/60 border-[#D81B60]/30'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              enviadaPorMim
                                ? 'bg-cyan-100 text-cyan-900'
                                : 'bg-[#4A041C] text-white'
                            }`}
                          >
                            {enviadaPorMim
                              ? `Enviada para: ${m.destinatarioNome || 'Coordenação'}`
                              : `Recebida de: ${m.remetenteNome || 'Coordenação'}`}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {m.criadoEm
                              ? new Date(m.criadoEm).toLocaleString('pt-BR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : ''}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-zinc-900">
                          {m.assunto || 'Mensagem'}
                        </h4>
                        <p className="text-xs text-zinc-700 whitespace-pre-line leading-relaxed">
                          {m.texto}
                        </p>

                        {m.resposta && (
                          <div className="mt-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950">
                            <strong className="block text-[10px] uppercase text-emerald-800 mb-0.5">
                              Resposta ({m.respondidoPorNome || 'Coordenação'}):
                            </strong>
                            {m.resposta}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <SegurancaSenhaCard />

            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <Calendar size={18} className="text-[#D81B60]" /> Minha Agenda de Turmas & Eventos ({atividadesDisponiveis.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {atividadesDisponiveis.map((c) => (
                  <div
                    key={c.key}
                    className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-1"
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        c.categoria === 'evento'
                          ? 'bg-amber-200 text-amber-950'
                          : 'bg-[#4A041C] text-white'
                      }`}
                    >
                      {c.frente || 'Dança de Salão'}
                    </span>
                    <h4 className="font-bold text-zinc-900 text-sm pt-1">{c.titulo}</h4>
                    <p className="text-xs text-zinc-600">{c.subtitulo}</p>
                    <p className="text-[11px] text-zinc-500">📍 {c.localNome}</p>
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
