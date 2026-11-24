import { useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  UserPlus, Trash2, BookOpen, Calendar, Sparkles, Link2, Check,
  FolderOpen, Edit3, X, ShieldAlert, Search, Image as ImageIcon, Award, Lock,
  Clock, TrendingUp, CheckSquare, Star, Save
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import CursoDetalhesAdmin from './CursoDetalhesAdmin';

const MODALIDADES_CURSO = [
  { id: 'fixo', label: 'Turma Fixa (Regular)' },
  { id: 'rapido', label: 'Curso Rápido' },
  { id: 'ferias', label: 'Curso de Férias' },
  { id: 'intensivo', label: 'Intensivo' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'encontro', label: 'Encontro / Prática' },
];

const PAPEIS_DISPONIVEIS = [
  { id: 'aluno', label: 'Aluno(a)', cor: 'bg-zinc-100 text-zinc-800 border-zinc-300' },
  { id: 'bolsista', label: 'Bolsista', cor: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { id: 'prof', label: 'Professor(a)', cor: 'bg-pink-100 text-pink-800 border-pink-300' },
  { id: 'admin', label: 'Admin / Coord.', cor: 'bg-amber-100 text-amber-800 border-amber-300' },
];

function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const hoje = new Date();
  const nasc = new Date(dataNasc + 'T00:00:00');
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade;
}

function limparCpf(valor) {
  return (valor || '').replace(/\D/g, '');
}

// Calcula data final e tempo restante da bolsa
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
  const percentualConcluido = Math.min(100, Math.max(0, Math.round((decorridoMs / totalDuracaoMs) * 100)));

  const mesesRestantes = Math.floor(Math.abs(diasRestantes) / 30);
  const diasSobra = Math.abs(diasRestantes) % 30;

  let textoTempo = '';
  if (diasRestantes < 0) {
    textoTempo = `Bolsa encerrada há ${Math.abs(diasRestantes)} dia(s)`;
  } else if (diasRestantes === 0) {
    textoTempo = 'Encerra hoje';
  } else if (mesesRestantes > 0) {
    textoTempo = `Restam ${mesesRestantes} mês(es) e ${diasSobra} dia(s)`;
  } else {
    textoTempo = `Restam ${diasRestantes} dia(s)`;
  }

  return {
    dataFimIso: dataFimObj.toISOString().split('T')[0],
    dataFimBr: dataFimObj.toLocaleDateString('pt-BR'),
    diasRestantes,
    percentualConcluido,
    textoTempo,
    expirada: diasRestantes < 0,
    alertaProximo: diasRestantes >= 0 && diasRestantes <= 30,
  };
}

function processarImagemCard(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 900;
      const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      callback(dataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

export default function AdminGestao({
  aba,
  usuarios,
  cursos,
  eventos,
  financeiro,
  avaliacoesBolsistas = [],
  presencasBolsistas = [],
  recarregar,
}) {
  const { user, userData } = useAuth();
  const [copiadoId, setCopiadoId] = useState(null);
  const [cursoAbertoId, setCursoAbertoId] = useState(null);
  const [filtroFrente, setFiltroFrente] = useState('todas');
  const [buscaUsuario, setBuscaUsuario] = useState('');

  // Estados da Aba Bolsistas & Pareceres (Admin)
  const [bolsistaFiltroAdmin, setBolsistaFiltroAdmin] = useState('todos');
  const [bolsistaAlvoFormId, setBolsistaAlvoFormId] = useState('');
  const [dataPresencaAdmin, setDataPresencaAdmin] = useState(new Date().toISOString().split('T')[0]);
  const [tipoAtivAdmin, setTipoAtivAdmin] = useState('Apoio em Turma');
  const [statusPresencaAdmin, setStatusPresencaAdmin] = useState('presente');
  const [descPresencaAdmin, setDescPresencaAdmin] = useState('');

  const [notaAssid, setNotaAssid] = useState(5);
  const [notaPart, setNotaPart] = useState(5);
  const [notaPont, setNotaPont] = useState(5);
  const [notaPost, setNotaPost] = useState(5);
  const [parecerAdminTexto, setParecerAdminTexto] = useState('');

  // Estado de Edição de Usuário
  const [usuarioEditandoId, setUsuarioEditandoId] = useState(null);

  // Estados para Cadastro/Edição de Usuários
  const [rolesSelecionados, setRolesSelecionados] = useState(['aluno']);
  const [podeAvaliarBolsistas, setPodeAvaliarBolsistas] = useState(false);
  const [frentesAluno, setFrentesAluno] = useState(['Dança de Salão']);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');

  // Vigência específica da Bolsa
  const [dataEntradaBolsa, setDataEntradaBolsa] = useState(new Date().toISOString().split('T')[0]);
  const [vigenciaBolsaMeses, setVigenciaBolsaMeses] = useState('6');
  const [dataFimBolsaCustom, setDataFimBolsaCustom] = useState('');

  // Estados para Menor de 15 anos
  const [tipoResponsavel, setTipoResponsavel] = useState('Mãe');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [telefoneSecundarioAluno, setTelefoneSecundarioAluno] = useState('');
  const [emailSecundarioAluno, setEmailSecundarioAluno] = useState('');

  const [salvandoUser, setSalvandoUser] = useState(false);

  // Estados para Cadastro de Cursos
  const [frente, setFrente] = useState('Dança de Salão');
  const [tituloCurso, setTituloCurso] = useState('');
  const [tipoCurso, setTipoCurso] = useState('fixo');
  const [estilo, setEstilo] = useState('Forró');
  const [valorCurso, setValorCurso] = useState('');
  const [dataInfo, setDataInfo] = useState('');
  const [horaInicio, setHoraInicio] = useState('19:30');
  const [horarioFim, setHorarioFim] = useState('21:00');
  const [duracaoAula, setDuracaoAula] = useState('1h30');
  const [duracaoTotal, setDuracaoTotal] = useState('Mensal');
  const [profIdSelecionado, setProfIdSelecionado] = useState('');
  const [ementaInicial, setEmentaInicial] = useState('');
  const [cardCursoUrl, setCardCursoUrl] = useState('');

  // Estados para Cadastro de Eventos
  const [tituloEvento, setTituloEvento] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [horaInicioEvento, setHoraInicioEvento] = useState('21:00');
  const [horaFimEvento, setHoraFimEvento] = useState('02:00');
  const [localEvento, setLocalEvento] = useState('No Compasso Studio de Dança');
  const [valorIngresso, setValorIngresso] = useState('');
  const [descEvento, setDescEvento] = useState('');
  const [cardEventoUrl, setCardEventoUrl] = useState('');

  const idadeCalculada = calcularIdade(dataNascimento);
  const isMenorDe15 = idadeCalculada !== null && idadeCalculada < 15;
  const isAlunoOuBolsista = rolesSelecionados.includes('aluno') || rolesSelecionados.includes('bolsista');
  const isBolsistaSelecionado = rolesSelecionados.includes('bolsista');
  const isProfSelecionado = rolesSelecionados.includes('prof');

  const previaVigenciaCadastro = isBolsistaSelecionado
    ? calcularVigenciaBolsa(dataEntradaBolsa, vigenciaBolsaMeses, dataFimBolsaCustom)
    : null;

  const profs = usuarios.filter((u) =>
    Array.isArray(u.roles) ? u.roles.includes('prof') : u.role === 'prof'
  );

  const toggleRole = (roleId) => {
    setRolesSelecionados((prev) => {
      if (prev.includes(roleId)) {
        return prev.length > 1 ? prev.filter((r) => r !== roleId) : prev;
      }
      return [...prev, roleId];
    });
  };

  const toggleFrenteAluno = (itemFrente) => {
    setFrentesAluno((prev) =>
      prev.includes(itemFrente) ? prev.filter((f) => f !== itemFrente) : [...prev, itemFrente]
    );
  };

  const limparFormularioUsuario = () => {
    setUsuarioEditandoId(null);
    setRolesSelecionados(['aluno']);
    setPodeAvaliarBolsistas(false);
    setFrentesAluno(['Dança de Salão']);
    setNome('');
    setEmail('');
    setSenha('');
    setTelefone('');
    setDataNascimento('');
    setCpf('');
    setEndereco('');
    setContatoEmergencia('');
    setDataEntradaBolsa(new Date().toISOString().split('T')[0]);
    setVigenciaBolsaMeses('6');
    setDataFimBolsaCustom('');
    setTipoResponsavel('Mãe');
    setNomeResponsavel('');
    setTelefoneSecundarioAluno('');
    setEmailSecundarioAluno('');
  };

  const carregarUsuarioParaEdicao = (u) => {
    setUsuarioEditandoId(u.id);
    const papeis = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'aluno'];
    setRolesSelecionados(papeis);
    setPodeAvaliarBolsistas(Boolean(u.podeAvaliarBolsistas));
    setFrentesAluno(Array.isArray(u.frentes) && u.frentes.length > 0 ? u.frentes : ['Dança de Salão']);
    setNome(u.nome || '');
    setEmail(u.email || '');
    setSenha('');
    setTelefone(u.telefoneRaw || u.telefone || '');
    setDataNascimento(u.dataNascimento || '');
    setCpf(u.cpf || '');
    setEndereco(u.endereco || '');
    setContatoEmergencia(u.contatoEmergencia || '');
    setDataEntradaBolsa(u.dataEntradaBolsa || new Date().toISOString().split('T')[0]);
    setVigenciaBolsaMeses(String(u.vigenciaBolsaMeses || '6'));
    setDataFimBolsaCustom(u.dataFimBolsa || '');
    setTipoResponsavel(u.tipoResponsavel || 'Mãe');
    setNomeResponsavel(u.nomeResponsavel || '');
    setTelefoneSecundarioAluno(u.telefoneSecundarioAluno || '');
    setEmailSecundarioAluno(u.emailSecundarioAluno || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleAutorizacaoBolsista = async (u) => {
    const novoStatus = !u.podeAvaliarBolsistas;
    try {
      await updateDoc(doc(db, 'users', u.id), {
        podeAvaliarBolsistas: novoStatus,
      });
      recarregar();
    } catch (err) {
      alert('Erro ao atualizar autorização: ' + err.message);
    }
  };

  const handleCpfChange = (valorDigitado) => {
    setCpf(valorDigitado);
    const limpo = limparCpf(valorDigitado);
    if (limpo.length === 11 && !usuarioEditandoId) {
      const existente = usuarios.find((u) => limparCpf(u.cpf) === limpo);
      if (existente) {
        alert(`CPF já cadastrado para "${existente.nome}". Abrindo cadastro em modo de edição!`);
        carregarUsuarioParaEdicao(existente);
      }
    }
  };

  const handleSalvarUsuario = async (e) => {
    e.preventDefault();
    setSalvandoUser(true);

    const rotuloResp = `${tipoResponsavel}${nomeResponsavel ? ` - ${nomeResponsavel}` : ''}`;
    const telefoneFormatado = isMenorDe15
      ? `${telefone} (${rotuloResp})${telefoneSecundarioAluno ? ` | ${telefoneSecundarioAluno} (Aluno)` : ''}`
      : telefone;

    const emailFormatadoExibicao = isMenorDe15
      ? `${email} (${rotuloResp})${emailSecundarioAluno ? ` | ${emailSecundarioAluno} (Aluno)` : ''}`
      : email;

    const rolePrincipal = rolesSelecionados.includes('admin')
      ? 'admin'
      : rolesSelecionados.includes('prof')
      ? 'prof'
      : rolesSelecionados.includes('bolsista')
      ? 'bolsista'
      : 'aluno';

    const vigenciaCalc = isBolsistaSelecionado
      ? calcularVigenciaBolsa(dataEntradaBolsa, vigenciaBolsaMeses, dataFimBolsaCustom)
      : null;

    const payloadDados = {
      nome,
      email,
      emailExibicao: emailFormatadoExibicao,
      telefone: telefoneFormatado,
      telefoneRaw: telefone,
      dataNascimento: isAlunoOuBolsista ? dataNascimento : '',
      isMenorDe15: isAlunoOuBolsista ? isMenorDe15 : false,
      tipoResponsavel: isMenorDe15 ? tipoResponsavel : '',
      nomeResponsavel: isMenorDe15 ? nomeResponsavel : '',
      telefoneSecundarioAluno: isMenorDe15 ? telefoneSecundarioAluno : '',
      emailSecundarioAluno: isMenorDe15 ? emailSecundarioAluno : '',
      cpf,
      endereco: isAlunoOuBolsista ? endereco : '',
      contatoEmergencia: isAlunoOuBolsista ? contatoEmergencia : '',
      frentes: isAlunoOuBolsista ? frentesAluno : [],
      role: rolePrincipal,
      roles: rolesSelecionados,
      podeAvaliarBolsistas: isProfSelecionado ? podeAvaliarBolsistas : false,
      dataEntradaBolsa: isBolsistaSelecionado ? dataEntradaBolsa : '',
      vigenciaBolsaMeses: isBolsistaSelecionado ? Number(vigenciaBolsaMeses) : 0,
      dataFimBolsa: vigenciaCalc ? vigenciaCalc.dataFimIso : '',
      status: 'ativo',
    };

    try {
      if (usuarioEditandoId) {
        await updateDoc(doc(db, 'users', usuarioEditandoId), {
          ...payloadDados,
          atualizadoEm: new Date().toISOString(),
        });
        alert('Cadastro atualizado com sucesso!');
        limparFormularioUsuario();
        recarregar();
      } else {
        let secondaryApp;
        try {
          const config = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          };
          secondaryApp = initializeApp(config, 'SecondaryApp_' + Date.now());
          const secondaryAuth = getAuth(secondaryApp);
          const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);

          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            ...payloadDados,
            criadoEm: new Date().toISOString(),
          });

          alert('Usuário cadastrado com sucesso!');
          limparFormularioUsuario();
          recarregar();
        } finally {
          if (secondaryApp) await deleteApp(secondaryApp);
        }
      }
    } catch (err) {
      alert('Erro ao salvar usuário: ' + err.message);
    } finally {
      setSalvandoUser(false);
    }
  };

  const handleExcluirUsuario = async (u) => {
    if (!window.confirm(`Deseja realmente excluir ${u.nome} do sistema?`)) return;
    try {
      await deleteDoc(doc(db, 'users', u.id));
      if (usuarioEditandoId === u.id) limparFormularioUsuario();
      recarregar();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const copiarLinkInscricao = (tipo, id) => {
    const url = `${window.location.origin}/inscricao/${tipo}/${id}`;
    navigator.clipboard.writeText(url);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const handleCriarCurso = async (e) => {
    e.preventDefault();
    const profObj = profs.find((p) => p.id === profIdSelecionado);
    const modObj = MODALIDADES_CURSO.find((m) => m.id === tipoCurso);
    try {
      await addDoc(collection(db, 'cursos'), {
        frente,
        titulo: tituloCurso,
        tipo: tipoCurso,
        tipoLabel: modObj ? modObj.label : 'Turma',
        estilo,
        valor: Number(valorCurso),
        dataInfo,
        horaInicio,
        horarioFim,
        duracaoAula,
        duracaoTotal,
        profId: profIdSelecionado,
        professoresNomes: profObj ? profObj.nome : 'Equipe No Compasso',
        ementa: ementaInicial,
        cardUrl: cardCursoUrl,
        inscricaoAberta: true,
        ativo: true,
        criadoEm: new Date().toISOString(),
      });
      setTituloCurso('');
      setValorCurso('');
      setDataInfo('');
      setEmentaInicial('');
      setCardCursoUrl('');
      alert('Curso lançado com sucesso!');
      recarregar();
    } catch (err) {
      alert('Erro ao criar curso: ' + err.message);
    }
  };

  const handleAlternarStatusCurso = async (curso) => {
    await updateDoc(doc(db, 'cursos', curso.id), { ativo: !curso.ativo });
    recarregar();
  };

  const handleCriarEvento = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'eventos'), {
        titulo: tituloEvento,
        data: dataEvento,
        horaInicio: horaInicioEvento,
        horaFim: horaFimEvento,
        local: localEvento,
        valorIngresso: Number(valorIngresso || 0),
        descricao: descEvento,
        cardUrl: cardEventoUrl,
        inscricaoAberta: true,
        criadoEm: new Date().toISOString(),
      });
      setTituloEvento('');
      setDataEvento('');
      setValorIngresso('');
      setDescEvento('');
      setCardEventoUrl('');
      alert('Evento publicado!');
      recarregar();
    } catch (err) {
      alert('Erro ao criar evento: ' + err.message);
    }
  };

  // =========================================================================
  // ABA 1: ALUNOS, BOLSISTAS & PROFS
  // =========================================================================
  if (aba === 'usuarios') {
    const usuariosFiltrados = usuarios.filter((u) => {
      const termo = buscaUsuario.toLowerCase();
      return (
        (u.nome || '').toLowerCase().includes(termo) ||
        (u.cpf || '').includes(termo) ||
        (u.email || '').toLowerCase().includes(termo)
      );
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl border shadow-sm h-fit transition ${
          usuarioEditandoId
            ? 'bg-amber-50/60 border-amber-400'
            : 'bg-white border-zinc-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[#4A041C]">
              {usuarioEditandoId ? <Edit3 size={20} className="text-amber-700" /> : <UserPlus size={20} />}
              <h3 className="text-lg font-bold uppercase font-condensed">
                {usuarioEditandoId ? 'Editar Cadastro / Matrícula' : 'Cadastrar Pessoa'}
              </h3>
            </div>

            {usuarioEditandoId && (
              <button
                type="button"
                onClick={limparFormularioUsuario}
                className="flex items-center gap-1 rounded-lg bg-zinc-200 px-2.5 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-300"
              >
                <X size={13} /> Cancelar Edição
              </button>
            )}
          </div>

          <form onSubmit={handleSalvarUsuario} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
                Classificações / Rótulos (Pode marcar mais de um)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAPEIS_DISPONIVEIS.map((p) => {
                  const marcado = rolesSelecionados.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => toggleRole(p.id)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition ${
                        marcado
                          ? 'bg-[#4A041C] text-white border-[#4A041C]'
                          : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <span>{p.label}</span>
                      {marcado && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CAMPOS DE ENTRADA E VIGÊNCIA DA BOLSA */}
            {isBolsistaSelecionado && (
              <div className="p-3.5 rounded-xl bg-cyan-50/80 border border-cyan-300 space-y-2.5">
                <p className="text-xs font-bold uppercase text-cyan-900 flex items-center gap-1.5">
                  <Clock size={15} /> Vigência & Prazo da Bolsa
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                      Data de Entrada
                    </label>
                    <input
                      type="date"
                      required
                      value={dataEntradaBolsa}
                      onChange={(e) => {
                        setDataEntradaBolsa(e.target.value);
                        setDataFimBolsaCustom('');
                      }}
                      className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                      Duração (Meses)
                    </label>
                    <select
                      value={vigenciaBolsaMeses}
                      onChange={(e) => {
                        setVigenciaBolsaMeses(e.target.value);
                        setDataFimBolsaCustom('');
                      }}
                      className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs font-semibold"
                    >
                      <option value="3">3 meses</option>
                      <option value="6">6 meses</option>
                      <option value="12">12 meses (1 ano)</option>
                      <option value="18">18 meses</option>
                      <option value="24">24 meses (2 anos)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                    Data Final da Bolsa (Automática ou Personalizada)
                  </label>
                  <input
                    type="date"
                    value={dataFimBolsaCustom || previaVigenciaCadastro?.dataFimIso || ''}
                    onChange={(e) => setDataFimBolsaCustom(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs font-semibold"
                  />
                </div>

                {previaVigenciaCadastro && (
                  <div className="p-2 rounded-lg bg-white border border-cyan-200 text-[11px] font-bold text-cyan-900">
                    ⏳ {previaVigenciaCadastro.textoTempo} (Término: {previaVigenciaCadastro.dataFimBr})
                  </div>
                )}
              </div>
            )}

            {isProfSelecionado && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-pink-50 border border-[#D81B60]/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={podeAvaliarBolsistas}
                  onChange={(e) => setPodeAvaliarBolsistas(e.target.checked)}
                  className="mt-0.5 accent-[#D81B60]"
                />
                <span className="text-xs text-[#4A041C] leading-snug">
                  <strong>Autorizar Avaliação de Bolsistas</strong>
                  <span className="block text-[11px] text-zinc-600">
                    Libera no painel deste professor a aba para lançar frequências, avaliar notas e registrar pareceres sigilosos.
                  </span>
                </span>
              </label>
            )}

            {isAlunoOuBolsista && (
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                  Modalidade de Interesse
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Dança de Salão', 'Ballet'].map((mod) => {
                    const ativo = frentesAluno.includes(mod);
                    return (
                      <button
                        type="button"
                        key={mod}
                        onClick={() => toggleFrenteAluno(mod)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                          ativo
                            ? 'bg-[#D81B60] text-white border-[#D81B60]'
                            : 'bg-white text-zinc-600 border-zinc-300'
                        }`}
                      >
                        {mod}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">CPF (Busca automática)</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
              />
            </div>

            {isAlunoOuBolsista && (
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  required
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
                />
                {idadeCalculada !== null && (
                  <span className={`inline-block mt-1 text-[11px] font-bold ${
                    isMenorDe15 ? 'text-amber-700' : 'text-zinc-500'
                  }`}>
                    Idade: {idadeCalculada} anos {isMenorDe15 ? '— Requer Responsável Legal' : ''}
                  </span>
                )}
              </div>
            )}

            {isMenorDe15 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
                <p className="text-xs font-bold uppercase text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert size={15} /> Dados do Responsável (Menor de 15 anos)
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Vínculo</label>
                    <select
                      value={tipoResponsavel}
                      onChange={(e) => setTipoResponsavel(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs font-semibold"
                    >
                      <option value="Mãe">Mãe</option>
                      <option value="Pai">Pai</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Nome do Responsável</label>
                    <input
                      type="text"
                      required
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      placeholder="Nome do pai/mãe"
                      className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                    WhatsApp do Responsável (Principal)
                  </label>
                  <input
                    type="text"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(68) 99999-9999"
                    className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                    E-mail do Responsável (Login Principal)
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                  />
                </div>

                <div className="pt-1 border-t border-amber-200/80 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                      WhatsApp do Aluno (Opcional)
                    </label>
                    <input
                      type="text"
                      value={telefoneSecundarioAluno}
                      onChange={(e) => setTelefoneSecundarioAluno(e.target.value)}
                      placeholder="Será salvo (Aluno)"
                      className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                      E-mail do Aluno (Opcional)
                    </label>
                    <input
                      type="email"
                      value={emailSecundarioAluno}
                      onChange={(e) => setEmailSecundarioAluno(e.target.value)}
                      placeholder="Será salvo (Aluno)"
                      className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {!isMenorDe15 && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(68) 99999-9999"
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">E-mail de Login</label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(usuarioEditandoId)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900 disabled:bg-zinc-100"
                  />
                </div>
              </>
            )}

            {isAlunoOuBolsista && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    required
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, Número, Bairro - Rio Branco/AC"
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Contato de Emergência</label>
                  <input
                    type="text"
                    value={contatoEmergencia}
                    onChange={(e) => setContatoEmergencia(e.target.value)}
                    placeholder="Nome e Telefone"
                    className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
                  />
                </div>
              </>
            )}

            {!usuarioEditandoId && (
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Senha Inicial (mín. 6 dígitos)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={salvandoUser}
              className={`w-full rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-white transition ${
                usuarioEditandoId
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#D81B60] hover:bg-[#AD1457]'
              }`}
            >
              {salvandoUser
                ? 'Salvando...'
                : usuarioEditandoId
                ? 'Salvar Alterações no Cadastro'
                : 'Criar Acesso com Senha'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900">
              Base de Usuários ({usuariosFiltrados.length})
            </h3>

            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                value={buscaUsuario}
                onChange={(e) => setBuscaUsuario(e.target.value)}
                placeholder="Buscar nome, CPF ou e-mail..."
                className="w-full rounded-xl border border-zinc-300 pl-9 pr-3 py-2 text-xs text-zinc-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="py-3 px-2">Nome / Modalidade</th>
                  <th className="py-3 px-2">Rótulos & Vigência</th>
                  <th className="py-3 px-2">Contato / Nasc.</th>
                  <th className="py-3 px-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {usuariosFiltrados.map((u) => {
                  const listaPapeis = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'aluno'];
                  const ehProf = listaPapeis.includes('prof');
                  const ehBolsista = listaPapeis.includes('bolsista');
                  const vig = ehBolsista
                    ? calcularVigenciaBolsa(u.dataEntradaBolsa, u.vigenciaBolsaMeses, u.dataFimBolsa)
                    : null;

                  return (
                    <tr key={u.id} className="hover:bg-zinc-50">
                      <td className="py-3 px-2">
                        <p className="font-semibold text-zinc-900">{u.nome}</p>
                        <p className="text-xs text-zinc-500">{u.emailExibicao || u.email}</p>
                        {Array.isArray(u.frentes) && u.frentes.length > 0 && (
                          <p className="text-[11px] font-semibold text-[#D81B60] mt-0.5">
                            {u.frentes.join(' • ')}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {listaPapeis.map((r) => {
                            const info = PAPEIS_DISPONIVEIS.find((p) => p.id === r);
                            return (
                              <span
                                key={r}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  info ? info.cor : 'bg-zinc-100 text-zinc-800'
                                }`}
                              >
                                {info ? info.label : r}
                              </span>
                            );
                          })}
                        </div>

                        {vig && (
                          <span
                            className={`mt-1.5 inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              vig.expirada
                                ? 'bg-red-100 text-red-700'
                                : vig.alertaProximo
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-cyan-50 text-cyan-800'
                            }`}
                          >
                            ⏳ {vig.textoTempo}
                          </span>
                        )}

                        {ehProf && (
                          <button
                            type="button"
                            onClick={() => handleToggleAutorizacaoBolsista(u)}
                            className={`mt-1.5 block inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border transition ${
                              u.podeAvaliarBolsistas
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-zinc-100 text-zinc-500 border-zinc-300 hover:bg-pink-50 hover:text-[#D81B60]'
                            }`}
                          >
                            <Award size={11} />
                            {u.podeAvaliarBolsistas ? 'Avalia Bolsistas ✓' : 'Autorizar Aval. Bolsistas'}
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-2 text-xs text-zinc-600">
                        <p>{u.telefone || '—'}</p>
                        {u.dataNascimento && <p className="text-zinc-400">Nasc: {u.dataNascimento}</p>}
                        {u.cpf && <p className="text-zinc-400 font-mono text-[11px]">CPF: {u.cpf}</p>}
                      </td>

                      <td className="py-3 px-2 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => carregarUsuarioParaEdicao(u)}
                          className="text-zinc-500 hover:text-amber-600 p-1.5"
                          title="Editar cadastro"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleExcluirUsuario(u)}
                          className="text-zinc-400 hover:text-red-600 p-1.5"
                          title="Excluir usuário"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ABA NOVA: BOLSISTAS, VIGÊNCIA, PRESENÇAS, INSIGHTS & PARECERES (ADMIN)
  // =========================================================================
  if (aba === 'bolsistas_admin') {
    const bolsistas = usuarios.filter((u) => {
      const roles = Array.isArray(u.roles) ? u.roles : [u.role];
      return roles.includes('bolsista');
    });

    const alvoIdEfetivo = bolsistaAlvoFormId || bolsistas[0]?.id || '';

    const handleLancarPresencaAdmin = async (e) => {
      e.preventDefault();
      const bObj = bolsistas.find((b) => b.id === alvoIdEfetivo);
      if (!bObj) return;
      try {
        await addDoc(collection(db, 'presencas_bolsistas'), {
          bolsistaId: bObj.id,
          bolsistaNome: bObj.nome,
          data: dataPresencaAdmin,
          tipoAtividade: tipoAtivAdmin,
          descricao: descPresencaAdmin,
          status: statusPresencaAdmin,
          lancadoPorId: user?.uid || '',
          lancadoPorNome: `${userData?.nome || 'Coordenação'} (Coordenação)`,
          criadoEm: new Date().toISOString(),
        });
        setDescPresencaAdmin('');
        recarregar();
      } catch (err) {
        alert('Erro ao registrar presença: ' + err.message);
      }
    };

    const handleSalvarParecerAdmin = async (e) => {
      e.preventDefault();
      const bObj = bolsistas.find((b) => b.id === alvoIdEfetivo);
      if (!bObj) return;
      const mediaGeral = Number(
        ((Number(notaAssid) + Number(notaPart) + Number(notaPont) + Number(notaPost)) / 4).toFixed(1)
      );
      try {
        await addDoc(collection(db, 'avaliacoes_bolsistas'), {
          bolsistaId: bObj.id,
          bolsistaNome: bObj.nome,
          assiduidade: Number(notaAssid),
          participacao: Number(notaPart),
          pontualidade: Number(notaPont),
          postura: Number(notaPost),
          mediaGeral,
          anotacaoRestritaAdmin: parecerAdminTexto.trim(),
          visivelApenasAdmin: true,
          avaliadorId: user?.uid || '',
          avaliadorNome: `${userData?.nome || 'Coordenação'} (Coordenação)`,
          dataAvaliacao: new Date().toISOString(),
        });
        setParecerAdminTexto('');
        recarregar();
      } catch (err) {
        alert('Erro ao registrar avaliação: ' + err.message);
      }
    };

    const avaliacoesFiltradas = avaliacoesBolsistas
      .filter((a) => (bolsistaFiltroAdmin === 'todos' ? true : a.bolsistaId === bolsistaFiltroAdmin))
      .sort((a, b) => (b.dataAvaliacao || '').localeCompare(a.dataAvaliacao || ''));

    const presencasFiltradas = presencasBolsistas
      .filter((p) => (bolsistaFiltroAdmin === 'todos' ? true : p.bolsistaId === bolsistaFiltroAdmin))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    return (
      <div className="space-y-6">
        {/* Cabeçalho e Filtro */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
              <Award size={22} className="text-[#D81B60]" /> Painel de Bolsistas, Vigência, Insights & Pareceres
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Acompanhe quanto tempo resta da bolsa de cada integrante, listas de presença, indicadores e pareceres assinados.
            </p>
          </div>

          <select
            value={bolsistaFiltroAdmin}
            onChange={(e) => setBolsistaFiltroAdmin(e.target.value)}
            className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm font-bold text-[#4A041C]"
          >
            <option value="todos">Todos os Bolsistas ({bolsistas.length})</option>
            {bolsistas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Cards Individuais de Vigência e Insights de Desempenho por Bolsista */}
        {bolsistas.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-500">
            Nenhum bolsista cadastrado ainda. Vá na aba <strong>"Alunos, Bolsistas & Profs"</strong>, marque o rótulo <strong>Bolsista</strong> e defina a data de entrada e vigência.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bolsistas
              .filter((b) => (bolsistaFiltroAdmin === 'todos' ? true : b.id === bolsistaFiltroAdmin))
              .map((b) => {
                const vig = calcularVigenciaBolsa(b.dataEntradaBolsa, b.vigenciaBolsaMeses, b.dataFimBolsa);
                const presB = presencasBolsistas.filter((p) => p.bolsistaId === b.id);
                const qtdPres = presB.filter((p) => p.status === 'presente').length;
                const taxaPres = presB.length > 0 ? Math.round((qtdPres / presB.length) * 100) : null;

                const avalsB = avaliacoesBolsistas.filter((a) => a.bolsistaId === b.id);
                const mediaGeral =
                  avalsB.length > 0
                    ? (avalsB.reduce((acc, item) => acc + Number(item.mediaGeral || 0), 0) / avalsB.length).toFixed(1)
                    : null;

                // Insight automático
                let insightTexto = 'Aguardando primeiras avaliações e frequências.';
                if (mediaGeral !== null && taxaPres !== null) {
                  if (Number(mediaGeral) >= 4.5 && taxaPres >= 85) {
                    insightTexto = 'Desempenho exemplar: alta assiduidade e excelente avaliação técnica.';
                  } else if (taxaPres < 75) {
                    insightTexto = 'Ponto de atenção: frequência abaixo de 75% nas atividades do estúdio.';
                  } else if (Number(mediaGeral) < 3.5) {
                    insightTexto = 'Ponto de atenção: média de desempenho abaixo de 3,5. Recomenda-se alinhamento.';
                  } else {
                    insightTexto = 'Desempenho regular e consistente nas atividades.';
                  }
                }

                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[10px] font-bold uppercase">
                            Bolsista Ativo
                          </span>
                          <h4 className="text-lg font-bold text-zinc-900 mt-1">{b.nome}</h4>
                        </div>
                        {mediaGeral && (
                          <span className="px-2.5 py-1 rounded-xl bg-[#4A041C] text-white text-xs font-bold">
                            ★ {mediaGeral}
                          </span>
                        )}
                      </div>

                      {/* Barra de Vigência da Bolsa */}
                      <div className="mt-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-zinc-600 flex items-center gap-1">
                            <Clock size={12} className="text-[#D81B60]" />
                            {vig ? vig.textoTempo : 'Vigência não informada'}
                          </span>
                          {vig && <span className="text-zinc-500">{vig.percentualConcluido}%</span>}
                        </div>

                        {vig && (
                          <>
                            <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  vig.expirada
                                    ? 'bg-red-600'
                                    : vig.alertaProximo
                                    ? 'bg-amber-500'
                                    : 'bg-cyan-600'
                                }`}
                                style={{ width: `${vig.percentualConcluido}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-zinc-500">
                              Entrada: {b.dataEntradaBolsa?.split('-').reverse().join('/') || '—'} • Término: <strong>{vig.dataFimBr}</strong>
                            </p>
                          </>
                        )}
                      </div>

                      {/* Métricas + Insight */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <span className="block text-[10px] font-bold uppercase text-emerald-700">Frequência</span>
                          <strong className="text-sm text-emerald-900">
                            {taxaPres !== null ? `${taxaPres}% (${qtdPres}/${presB.length})` : 'Sem registros'}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-pink-50 border border-pink-200">
                          <span className="block text-[10px] font-bold uppercase text-[#D81B60]">Avaliações</span>
                          <strong className="text-sm text-[#4A041C]">{avalsB.length} parecer(es)</strong>
                        </div>
                      </div>

                      <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-1.5">
                        <TrendingUp size={14} className="text-amber-700 shrink-0 mt-0.5" />
                        <span>{insightTexto}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBolsistaFiltroAdmin(b.id);
                        setBolsistaAlvoFormId(b.id);
                      }}
                      className="w-full rounded-xl border border-zinc-300 py-2 text-[11px] font-bold uppercase text-zinc-700 hover:bg-[#4A041C] hover:text-white transition"
                    >
                      Filtrar & Avaliar {b.nome.split(' ')[0]}
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        {/* Formulários Diretos da Coordenação (Lançar Presença + Registrar Avaliação/Parecer) */}
        {bolsistas.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lançar Presença em Atividade */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-3 h-fit">
              <h4 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <CheckSquare size={18} className="text-[#D81B60]" /> Lançar Presença de Bolsista
              </h4>

              <form onSubmit={handleLancarPresencaAdmin} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Bolsista</label>
                  <select
                    value={alvoIdEfetivo}
                    onChange={(e) => setBolsistaAlvoFormId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold"
                  >
                    {bolsistas.map((b) => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={dataPresencaAdmin}
                      onChange={(e) => setDataPresencaAdmin(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Status</label>
                    <select
                      value={statusPresencaAdmin}
                      onChange={(e) => setStatusPresencaAdmin(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2 text-xs font-bold"
                    >
                      <option value="presente">✅ Presente</option>
                      <option value="falta">❌ Falta</option>
                      <option value="justificada">⚠️ Justificada</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Atividade</label>
                  <select
                    value={tipoAtivAdmin}
                    onChange={(e) => setTipoAtivAdmin(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  >
                    <option value="Apoio em Turma">Apoio / Monitoria em Turma</option>
                    <option value="Treino / Ensaio Técnico">Treino / Ensaio Técnico</option>
                    <option value="Baile / Evento do Studio">Baile / Evento do Studio</option>
                    <option value="Recepção / Organização">Recepção / Organização</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Observação (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Auxiliou na turma de Forró..."
                    value={descPresencaAdmin}
                    onChange={(e) => setDescPresencaAdmin(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#4A041C] py-2.5 text-xs font-bold uppercase text-white hover:bg-[#D81B60]"
                >
                  Registrar Presença
                </button>
              </form>
            </div>

            {/* Registrar Avaliação & Parecer Assinado */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
              <h4 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <Star size={18} className="text-[#D81B60]" /> Registrar Avaliação & Parecer Técnico
              </h4>

              <form onSubmit={handleSalvarParecerAdmin} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Bolsista Avaliado(a)</label>
                  <select
                    value={alvoIdEfetivo}
                    onChange={(e) => setBolsistaAlvoFormId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold"
                  >
                    {bolsistas.map((b) => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Assiduidade', val: notaAssid, set: setNotaAssid },
                    { label: 'Participação', val: notaPart, set: setNotaPart },
                    { label: 'Pontualidade', val: notaPont, set: setNotaPont },
                    { label: 'Postura', val: notaPost, set: setNotaPost },
                  ].map((c) => (
                    <div key={c.label} className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                      <span className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                        {c.label}: <strong className="text-[#D81B60]">{c.val}/5</strong>
                      </span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            type="button"
                            key={n}
                            onClick={() => c.set(n)}
                            className={`flex-1 py-1 rounded text-[11px] font-bold ${
                              c.val >= n ? 'bg-[#D81B60] text-white' : 'bg-white border border-zinc-300 text-zinc-500'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Anotação / Parecer (Assinado automaticamente por {userData?.nome})
                  </label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Escreva observações sobre desempenho, evolução, pontualidade ou postura..."
                    value={parecerAdminTexto}
                    onChange={(e) => setParecerAdminTexto(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-3 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4A041C] to-[#D81B60] px-5 py-2.5 text-xs font-bold uppercase text-white hover:brightness-110"
                >
                  <Save size={15} /> Salvar Avaliação & Parecer
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Histórico Consolidado de Pareceres e Presenças */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <h4 className="text-base font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
              <Lock size={16} className="text-[#D81B60]" /> Histórico de Avaliações & Pareceres ({avaliacoesFiltradas.length})
            </h4>

            {avaliacoesFiltradas.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center">
                Nenhuma avaliação registrada ainda. Use o formulário acima ou autorize um professor na aba de usuários.
              </p>
            ) : (
              <div className="space-y-3">
                {avaliacoesFiltradas.map((av) => (
                  <div key={av.id} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm text-zinc-900">{av.bolsistaNome}</span>
                        <span className="block text-[11px] font-semibold text-[#D81B60]">
                          Registrado por: <strong>{av.avaliadorNome}</strong> •{' '}
                          {av.dataAvaliacao ? new Date(av.dataAvaliacao).toLocaleDateString('pt-BR') : ''}
                        </span>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#4A041C] text-white text-xs font-bold">
                        Média: {av.mediaGeral} / 5
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-zinc-200">
                      <span>Assiduidade: <strong>{av.assiduidade}/5</strong></span>
                      <span>Participação: <strong>{av.participacao}/5</strong></span>
                      <span>Pontualidade: <strong>{av.pontualidade}/5</strong></span>
                      <span>Postura: <strong>{av.postura}/5</strong></span>
                    </div>

                    {av.anotacaoRestritaAdmin && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950">
                        <strong className="uppercase text-[10px] tracking-wider text-amber-800 block mb-0.5">
                          Parecer Assinado ({av.avaliadorNome}):
                        </strong>
                        {av.anotacaoRestritaAdmin}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <h4 className="text-base font-bold uppercase font-condensed text-[#4A041C]">
              Lista de Presenças em Atividades ({presencasFiltradas.length})
            </h4>

            {presencasFiltradas.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center">
                Nenhum registro de presença em atividade ainda.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto">
                {presencasFiltradas.map((pr) => (
                  <div key={pr.id} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-zinc-900">{pr.bolsistaNome}</span>
                      <span
                        className={
                          pr.status === 'presente'
                            ? 'text-emerald-700'
                            : pr.status === 'falta'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }
                      >
                        {pr.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-zinc-700">
                      📅 {pr.data?.split('-').reverse().join('/')} • <strong>{pr.tipoAtividade}</strong>
                    </p>
                    {pr.descricao && <p className="text-zinc-500">{pr.descricao}</p>}
                    <p className="text-[10px] text-zinc-400">Lançado por: {pr.lancadoPorNome}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ABA 2: CURSOS & TURMAS
  // =========================================================================
  if (aba === 'cursos') {
    const cursoDetalhe = cursos.find((c) => c.id === cursoAbertoId);
    if (cursoDetalhe) {
      return (
        <CursoDetalhesAdmin
          curso={cursoDetalhe}
          usuarios={usuarios}
          financeiro={financeiro}
          onVoltar={() => setCursoAbertoId(null)}
          recarregarGeral={recarregar}
        />
      );
    }

    const cursosFiltrados = cursos.filter((c) =>
      filtroFrente === 'todas' ? true : (c.frente || 'Dança de Salão') === filtroFrente
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 text-[#4A041C]">
            <BookOpen size={20} />
            <h3 className="text-lg font-bold uppercase font-condensed">Lançar Curso / Turma</h3>
          </div>

          <form onSubmit={handleCriarCurso} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Frente do Studio</label>
              <div className="grid grid-cols-2 gap-2">
                {['Dança de Salão', 'Ballet'].map((itemFrente) => (
                  <button
                    type="button"
                    key={itemFrente}
                    onClick={() => {
                      setFrente(itemFrente);
                      setEstilo(itemFrente === 'Ballet' ? 'Ballet Clássico' : 'Forró');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                      frente === itemFrente
                        ? 'bg-[#4A041C] text-white border-[#4A041C]'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-300 hover:bg-zinc-100'
                    }`}
                  >
                    {itemFrente}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Modalidade</label>
              <select
                value={tipoCurso}
                onChange={(e) => setTipoCurso(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900"
              >
                {MODALIDADES_CURSO.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Nome da Turma / Curso</label>
              <input
                type="text"
                required
                placeholder={frente === 'Ballet' ? 'Ex: Ballet Infantil / Baby Class' : 'Ex: Intensivo de Bolero & Soltinho'}
                value={tituloCurso}
                onChange={(e) => setTituloCurso(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                Card Oficial do Curso (Arte / Banner)
              </label>
              <label className="flex flex-col items-center justify-center w-full p-3 border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer bg-zinc-50 hover:bg-pink-50/40 hover:border-[#D81B60] transition">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4A041C]">
                  <ImageIcon size={16} className="text-[#D81B60]" />
                  <span>{cardCursoUrl ? 'Trocar Imagem do Card' : 'Selecionar Arte do Card (JPG/PNG)'}</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => processarImagemCard(e.target.files[0], setCardCursoUrl)}
                />
              </label>

              {cardCursoUrl && (
                <div className="relative mt-2 rounded-xl overflow-hidden border border-zinc-200">
                  <img src={cardCursoUrl} alt="Prévia do Card" className="w-full h-36 object-cover" />
                  <button
                    type="button"
                    onClick={() => setCardCursoUrl('')}
                    className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-red-600"
                    title="Remover imagem"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Estilo / Nível</label>
                <input
                  type="text"
                  required
                  value={estilo}
                  onChange={(e) => setEstilo(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="120.00"
                  value={valorCurso}
                  onChange={(e) => setValorCurso(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Professor Responsável</label>
              <select
                value={profIdSelecionado}
                onChange={(e) => setProfIdSelecionado(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              >
                <option value="">Selecione um professor...</option>
                {profs.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data / Dias da Semana</label>
              <input
                type="text"
                required
                placeholder="Ex: Ter e Qui"
                value={dataInfo}
                onChange={(e) => setDataInfo(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Hora de Início</label>
                <input
                  type="time"
                  required
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Hora de Fim</label>
                <input
                  type="time"
                  required
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Duração Aula</label>
                <input
                  type="text"
                  value={duracaoAula}
                  onChange={(e) => setDuracaoAula(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Duração Total</label>
                <input
                  type="text"
                  value={duracaoTotal}
                  onChange={(e) => setDuracaoTotal(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Ementa / Resumo do Curso</label>
              <textarea
                rows="2"
                placeholder="Objetivos e conteúdo..."
                value={ementaInicial}
                onChange={(e) => setEmentaInicial(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#4A041C] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#2D0210] transition"
            >
              Publicar Curso & Gerar Link
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900">
              Cursos & Turmas ({cursosFiltrados.length})
            </h3>

            <div className="flex gap-1.5">
              {['todas', 'Dança de Salão', 'Ballet'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltroFrente(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                    filtroFrente === f ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {f === 'todas' ? 'Todas as Frentes' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {cursosFiltrados.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:border-[#4A041C]/40 transition">
                <div className="flex items-center gap-3.5">
                  {c.cardUrl && (
                    <img
                      src={c.cardUrl}
                      alt={c.titulo}
                      className="w-16 h-16 rounded-xl object-cover border border-zinc-300 shrink-0"
                    />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#4A041C] text-white text-[10px] font-bold uppercase">
                        {c.frente || 'Dança de Salão'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        c.tipo === 'fixo' ? 'bg-zinc-800 text-white' : 'bg-[#D81B60] text-white'
                      }`}>
                        {c.tipoLabel || c.tipo}
                      </span>
                      <h4 className="font-bold text-zinc-900">{c.titulo}</h4>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">
                      {c.estilo} • Prof: <strong>{c.professoresNomes}</strong> • {c.dataInfo} ({c.horaInicio || '19:00'} às {c.horarioFim || '21:00'}) • <strong>R$ {c.valor}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCursoAbertoId(c.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#4A041C] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#2D0210] transition shadow-sm"
                  >
                    <FolderOpen size={14} />
                    Abrir Curso
                  </button>

                  <button
                    onClick={() => copiarLinkInscricao('curso', c.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#D81B60]/40 bg-pink-50 px-3 py-2 text-xs font-bold text-[#D81B60] hover:bg-pink-100 transition"
                  >
                    {copiadoId === c.id ? <Check size={14} /> : <Link2 size={14} />}
                    {copiadoId === c.id ? 'Copiado!' : 'Link Form'}
                  </button>

                  <button
                    onClick={() => handleAlternarStatusCurso(c)}
                    className={`px-2.5 py-2 rounded-lg text-[11px] font-bold uppercase ${
                      c.ativo
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                    }`}
                  >
                    {c.ativo ? 'Ativo' : 'Encerrado'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ABA 3: EVENTOS
  // =========================================================================
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
        <div className="flex items-center gap-2 mb-4 text-[#D81B60]">
          <Sparkles size={20} />
          <h3 className="text-lg font-bold uppercase font-condensed">Inserir Novo Evento</h3>
        </div>

        <form onSubmit={handleCriarEvento} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Nome do Baile / Mostra</label>
            <input
              type="text"
              required
              value={tituloEvento}
              onChange={(e) => setTituloEvento(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
              Card Oficial do Evento (Flyer / Cartaz)
            </label>
            <label className="flex flex-col items-center justify-center w-full p-3 border-2 border-dashed border-zinc-300 rounded-xl cursor-pointer bg-zinc-50 hover:bg-pink-50/40 hover:border-[#D81B60] transition">
              <div className="flex items-center gap-2 text-xs font-bold text-[#4A041C]">
                <ImageIcon size={16} className="text-[#D81B60]" />
                <span>{cardEventoUrl ? 'Trocar Cartaz do Evento' : 'Selecionar Arte do Evento (JPG/PNG)'}</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => processarImagemCard(e.target.files[0], setCardEventoUrl)}
              />
            </label>

            {cardEventoUrl && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-zinc-200">
                <img src={cardEventoUrl} alt="Prévia do Evento" className="w-full h-36 object-cover" />
                <button
                  type="button"
                  onClick={() => setCardEventoUrl('')}
                  className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data</label>
            <input
              type="text"
              required
              placeholder="Ex: 20/12/2026"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Hora Início</label>
              <input
                type="time"
                value={horaInicioEvento}
                onChange={(e) => setHoraInicioEvento(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Hora Fim</label>
              <input
                type="time"
                value={horaFimEvento}
                onChange={(e) => setHoraFimEvento(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Local</label>
            <input
              type="text"
              required
              value={localEvento}
              onChange={(e) => setLocalEvento(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Valor Ingresso (R$)</label>
            <input
              type="number"
              step="0.01"
              value={valorIngresso}
              onChange={(e) => setValorIngresso(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Descrição</label>
            <textarea
              rows="3"
              value={descEvento}
              onChange={(e) => setDescEvento(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#D81B60] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#AD1457]"
          >
            Publicar Evento & Gerar Link
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
          Eventos Cadastrados ({eventos.length})
        </h3>
        <div className="space-y-3">
          {eventos.map((ev) => (
            <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-3.5">
                {ev.cardUrl && (
                  <img
                    src={ev.cardUrl}
                    alt={ev.titulo}
                    className="w-16 h-16 rounded-xl object-cover border border-zinc-300 shrink-0"
                  />
                )}
                <div>
                  <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                    <Calendar size={16} className="text-[#D81B60]" /> {ev.titulo}
                  </h4>
                  <p className="text-xs text-zinc-600 mt-1">
                    {ev.data} ({ev.horaInicio} às {ev.horaFim}) • {ev.local} • Ingresso: R$ {ev.valorIngresso}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copiarLinkInscricao('evento', ev.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#D81B60]/40 bg-pink-50 px-3 py-1.5 text-xs font-bold text-[#D81B60] hover:bg-pink-100"
                >
                  {copiadoId === ev.id ? <Check size={14} /> : <Link2 size={14} />}
                  {copiadoId === ev.id ? 'Copiado!' : 'Link Ingresso'}
                </button>
                <button
                  onClick={async () => { await deleteDoc(doc(db, 'eventos', ev.id)); recarregar(); }}
                  className="text-zinc-400 hover:text-red-600 p-2"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
