import { useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  UserPlus, Trash2, BookOpen, Calendar, Sparkles, Link2, Check,
  FolderOpen, Pencil, X, AlertTriangle, ShieldAlert
} from 'lucide-react';
import { db } from './firebase';
import CursoDetalhesAdmin from './CursoDetalhesAdmin';

const MODALIDADES = [
  { id: 'fixo', label: 'Turma Fixa (Regular)' },
  { id: 'rapido', label: 'Curso Rápido' },
  { id: 'ferias', label: 'Curso de Férias' },
  { id: 'intensivo', label: 'Intensivo' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'encontro', label: 'Encontro / Prática' },
];

const PERFIS_DISPONIVEIS = [
  { id: 'aluno', label: 'Aluno(a)', badge: 'bg-zinc-100 text-zinc-800' },
  { id: 'bolsista', label: 'Bolsista', badge: 'bg-cyan-100 text-cyan-800' },
  { id: 'prof', label: 'Professor(a)', badge: 'bg-pink-100 text-pink-800' },
  { id: 'admin', label: 'Coordenação / Admin', badge: 'bg-amber-100 text-amber-800' },
];

function calcularIdade(dataNascStr) {
  if (!dataNascStr) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascStr + 'T00:00:00');
  if (isNaN(nasc.getTime())) return null;
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade;
}

function normalizarCpf(valor) {
  return (valor || '').replace(/\D/g, '');
}

export default function AdminGestao({ aba, usuarios, cursos, eventos, financeiro, recarregar }) {
  const [copiadoId, setCopiadoId] = useState(null);
  const [cursoAbertoId, setCursoAbertoId] = useState(null);
  const [filtroFrente, setFiltroFrente] = useState('todas');

  // Estados para Cadastro / Edição de Usuários
  const [editandoUserId, setEditandoUserId] = useState(null);
  const [rolesSelecionados, setRolesSelecionados] = useState(['aluno']);
  const [frentesAluno, setFrentesAluno] = useState(['Dança de Salão']);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');

  // Campos para Menor de 15 anos (Responsável)
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelTipo, setResponsavelTipo] = useState('Mãe'); // 'Mãe' | 'Pai' | 'Outro'
  const [responsavelOutroParentesco, setResponsavelOutroParentesco] = useState('');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  const [responsavelEmail, setResponsavelEmail] = useState('');

  const [criandoUser, setCriandoUser] = useState(false);

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

  // Estados para Cadastro de Eventos
  const [tituloEvento, setTituloEvento] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [horaInicioEvento, setHoraInicioEvento] = useState('21:00');
  const [horaFimEvento, setHoraFimEvento] = useState('02:00');
  const [localEvento, setLocalEvento] = useState('No Compasso Studio de Dança');
  const [valorIngresso, setValorIngresso] = useState('');
  const [descEvento, setDescEvento] = useState('');

  // Lista de professores inclui quem tem 'prof' no array roles ou no campo role legado
  const profs = usuarios.filter((u) => (u.roles ? u.roles.includes('prof') : u.role === 'prof'));

  const idadeCalculada = calcularIdade(dataNascimento);
  const isMenorDe15 = idadeCalculada !== null && idadeCalculada < 15;
  const isAlunoOuBolsista = rolesSelecionados.includes('aluno') || rolesSelecionados.includes('bolsista');

  const alternarRole = (roleId) => {
    setRolesSelecionados((prev) => {
      if (prev.includes(roleId)) {
        return prev.length > 1 ? prev.filter((r) => r !== roleId) : prev;
      }
      return [...prev, roleId];
    });
  };

  const alternarFrenteAluno = (frenteNome) => {
    setFrentesAluno((prev) => {
      if (prev.includes(frenteNome)) {
        return prev.length > 1 ? prev.filter((f) => f !== frenteNome) : prev;
      }
      return [...prev, frenteNome];
    });
  };

  const limparFormularioUsuario = () => {
    setEditandoUserId(null);
    setRolesSelecionados(['aluno']);
    setFrentesAluno(['Dança de Salão']);
    setNome('');
    setEmail('');
    setSenha('');
    setTelefone('');
    setDataNascimento('');
    setCpf('');
    setEndereco('');
    setContatoEmergencia('');
    setResponsavelNome('');
    setResponsavelTipo('Mãe');
    setResponsavelOutroParentesco('');
    setResponsavelTelefone('');
    setResponsavelEmail('');
  };

  const carregarUsuarioParaEdicao = (u) => {
    setEditandoUserId(u.id);
    const listaRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'aluno'];
    setRolesSelecionados(listaRoles);
    setFrentesAluno(Array.isArray(u.frentes) && u.frentes.length > 0 ? u.frentes : ['Dança de Salão']);
    setNome(u.nome || '');
    setEmail(u.email || '');
    setSenha('');
    setTelefone(u.telefone || '');
    setDataNascimento(u.dataNascimento || '');
    setCpf(u.cpf || '');
    setEndereco(u.endereco || '');
    setContatoEmergencia(u.contatoEmergencia || '');
    setResponsavelNome(u.responsavelNome || '');
    setResponsavelTipo(u.responsavelTipo || 'Mãe');
    setResponsavelOutroParentesco(u.responsavelOutroParentesco || '');
    setResponsavelTelefone(u.responsavelTelefone || '');
    setResponsavelEmail(u.responsavelEmail || '');
  };

  // Detecta CPF duplicado e abre automaticamente o cadastro existente em modo edição
  const handleCpfChange = (valorDigitado) => {
    setCpf(valorDigitado);
    const limpo = normalizarCpf(valorDigitado);
    if (limpo.length === 11 && !editandoUserId) {
      const existente = usuarios.find((u) => normalizarCpf(u.cpf) === limpo);
      if (existente) {
        alert(`CPF já cadastrado para ${existente.nome}! Abrindo a ficha em modo de edição.`);
        carregarUsuarioParaEdicao(existente);
      }
    }
  };

  const handleSalvarUsuario = async (e) => {
    e.preventDefault();
    setCriandoUser(true);

    // Define a role principal para compatibilidade e mantém o array completo 'roles'
    const prioridade = ['admin', 'prof', 'bolsista', 'aluno'];
    const rolePrincipal = prioridade.find((r) => rolesSelecionados.includes(r)) || 'aluno';

    // Se for menor de 15 anos, o contato principal e e-mail assumem os do responsável
    const emailFinal = isMenorDe15 && responsavelEmail ? responsavelEmail : email;
    const telefoneFinal = isMenorDe15 && responsavelTelefone ? responsavelTelefone : telefone;

    const responsavelFormatado = isMenorDe15
      ? `${responsavelNome} (${responsavelTipo === 'Outro' ? responsavelOutroParentesco || 'Responsável' : responsavelTipo})`
      : '';

    const dadosPayload = {
      nome,
      email: emailFinal,
      telefone: telefoneFinal,
      dataNascimento,
      cpf,
      endereco,
      contatoEmergencia,
      role: rolePrincipal,
      roles: rolesSelecionados,
      frentes: isAlunoOuBolsista ? frentesAluno : [],
      menorDe15: isMenorDe15,
      responsavelNome: isMenorDe15 ? responsavelNome : '',
      responsavelTipo: isMenorDe15 ? responsavelTipo : '',
      responsavelOutroParentesco: isMenorDe15 && responsavelTipo === 'Outro' ? responsavelOutroParentesco : '',
      responsavelFormatado,
      responsavelTelefone: isMenorDe15 ? responsavelTelefone : '',
      responsavelEmail: isMenorDe15 ? responsavelEmail : '',
    };

    try {
      if (editandoUserId) {
        // MODO EDIÇÃO DE CADASTRO EXISTENTE
        await updateDoc(doc(db, 'users', editandoUserId), {
          ...dadosPayload,
          atualizadoEm: new Date().toISOString(),
        });
        alert('Cadastro atualizado com sucesso!');
        limparFormularioUsuario();
        recarregar();
      } else {
        // NOVO CADASTRO COM LOGIN NO FIREBASE AUTH
        let secondaryApp;
        try {
          const config = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          };
          secondaryApp = initializeApp(config, 'SecondaryApp_' + Date.now());
          const secondaryAuth = getAuth(secondaryApp);
          const cred = await createUserWithEmailAndPassword(secondaryAuth, emailFinal, senha);

          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            ...dadosPayload,
            status: 'ativo',
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
      setCriandoUser(false);
    }
  };

  const handleExcluirUsuario = async (u) => {
    if (!window.confirm(`Deseja realmente excluir ${u.nome} do sistema?`)) return;
    try {
      await deleteDoc(doc(db, 'users', u.id));
      if (editandoUserId === u.id) limparFormularioUsuario();
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
    const modObj = MODALIDADES.find((m) => m.id === tipoCurso);
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
        inscricaoAberta: true,
        ativo: true,
        criadoEm: new Date().toISOString(),
      });
      setTituloCurso('');
      setValorCurso('');
      setDataInfo('');
      setEmentaInicial('');
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
        inscricaoAberta: true,
        criadoEm: new Date().toISOString(),
      });
      setTituloEvento('');
      setDataEvento('');
      setValorIngresso('');
      setDescEvento('');
      alert('Evento publicado!');
      recarregar();
    } catch (err) {
      alert('Erro ao criar evento: ' + err.message);
    }
  };

  // ABA 1: USUÁRIOS (Multi-perfis + Modalidade + Menor de 15 anos + Edição por CPF)
  if (aba === 'usuarios') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`p-6 rounded-2xl border shadow-sm h-fit transition ${
          editandoUserId ? 'bg-amber-50/40 border-amber-400' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[#4A041C]">
              {editandoUserId ? <Pencil size={19} className="text-amber-600" /> : <UserPlus size={20} />}
              <h3 className="text-lg font-bold uppercase font-condensed">
                {editandoUserId ? 'Editar Cadastro / Matrícula' : 'Cadastrar Usuário'}
              </h3>
            </div>
            {editandoUserId && (
              <button
                type="button"
                onClick={limparFormularioUsuario}
                className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-900 bg-white px-2.5 py-1 rounded-lg border border-zinc-300"
              >
                <X size={14} /> Cancelar
              </button>
            )}
          </div>

          <form onSubmit={handleSalvarUsuario} className="space-y-3">
            {/* Múltiplos Perfis / Rótulos */}
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
                Perfis / Classificações (pode marcar mais de um)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {PERFIS_DISPONIVEIS.map((p) => {
                  const marcado = rolesSelecionados.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => alternarRole(p.id)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-left flex items-center justify-between transition ${
                        marcado
                          ? 'bg-[#4A041C] text-white border-[#4A041C]'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-300 hover:bg-zinc-100'
                      }`}
                    >
                      <span>{p.label}</span>
                      {marcado && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modalidade (Dança de Salão / Ballet) para Alunos e Bolsistas */}
            {isAlunoOuBolsista && (
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
                  Modalidade(s) de Interesse
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Dança de Salão', 'Ballet'].map((mod) => {
                    const ativo = frentesAluno.includes(mod);
                    return (
                      <button
                        type="button"
                        key={mod}
                        onClick={() => alternarFrenteAluno(mod)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold uppercase border transition ${
                          ativo
                            ? 'bg-[#D81B60] text-white border-[#D81B60]'
                            : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
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
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                placeholder="000.000.000-00 (busca automática)"
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data Nascimento</label>
                <input
                  type="date"
                  required={isAlunoOuBolsista}
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
                />
              </div>

              {!isMenorDe15 && (
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
              )}
            </div>

            {/* BLOCO AUTOMÁTICO PARA MENOR DE 15 ANOS */}
            {isMenorDe15 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
                <p className="text-xs font-bold uppercase text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert size={15} /> Menor de 15 anos ({idadeCalculada} anos) — Dados do Responsável
                </p>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">Parentesco</label>
                  <select
                    value={responsavelTipo}
                    onChange={(e) => setResponsavelTipo(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs font-semibold text-zinc-900"
                  >
                    <option value="Mãe">Mãe</option>
                    <option value="Pai">Pai</option>
                    <option value="Outro">Outro Responsável</option>
                  </select>
                </div>

                {responsavelTipo === 'Outro' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">
                      Qual parentesco? (aparecerá entre parênteses)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Avó, Tia, Tutor Legal..."
                      value={responsavelOutroParentesco}
                      onChange={(e) => setResponsavelOutroParentesco(e.target.value)}
                      className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-zinc-900"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">Nome do Responsável</label>
                  <input
                    type="text"
                    required
                    value={responsavelNome}
                    onChange={(e) => setResponsavelNome(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">WhatsApp do Responsável</label>
                  <input
                    type="text"
                    required
                    placeholder="(68) 99999-9999"
                    value={responsavelTelefone}
                    onChange={(e) => setResponsavelTelefone(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-amber-900 mb-1">E-mail do Responsável (Login)</label>
                  <input
                    type="email"
                    required
                    value={responsavelEmail}
                    onChange={(e) => setResponsavelEmail(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-zinc-900"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Endereço Completo</label>
              <input
                type="text"
                required={isAlunoOuBolsista}
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

            {!isMenorDe15 && (
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">E-mail de Login</label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editandoUserId)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900 disabled:bg-zinc-100"
                />
              </div>
            )}

            {!editandoUserId && (
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
              disabled={criandoUser}
              className={`w-full rounded-xl py-3 text-xs font-bold uppercase tracking-wider text-white transition ${
                editandoUserId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#D81B60] hover:bg-[#AD1457]'
              }`}
            >
              {criandoUser
                ? 'Salvando...'
                : editandoUserId
                ? 'Salvar Alterações da Matrícula'
                : 'Criar Acesso com Senha'}
            </button>
          </form>
        </div>

        {/* TABELA DE USUÁRIOS COM TODOS OS RÓTULOS E BOTÃO EDITAR */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
            Base de Usuários ({usuarios.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="py-3 px-2">Nome / Modalidade / Endereço</th>
                  <th className="py-3 px-2">Classificações (Rótulos)</th>
                  <th className="py-3 px-2">Contato / Responsável</th>
                  <th className="py-3 px-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {usuarios.map((u) => {
                  const userRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'aluno'];
                  return (
                    <tr key={u.id} className={`hover:bg-zinc-50 ${editandoUserId === u.id ? 'bg-amber-50/70' : ''}`}>
                      <td className="py-3 px-2">
                        <p className="font-semibold text-zinc-900">{u.nome}</p>
                        <p className="text-xs text-zinc-500">{u.email} {u.cpf ? `• CPF: ${u.cpf}` : ''}</p>
                        {Array.isArray(u.frentes) && u.frentes.length > 0 && (
                          <p className="text-[11px] font-bold text-[#D81B60] mt-0.5">
                            {u.frentes.join(' + ')}
                          </p>
                        )}
                        {u.endereco && <p className="text-[11px] text-zinc-400">{u.endereco}</p>}
                      </td>

                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.map((r) => {
                            const info = PERFIS_DISPONIVEIS.find((p) => p.id === r);
                            return (
                              <span
                                key={r}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  info ? info.badge : 'bg-zinc-100 text-zinc-800'
                                }`}
                              >
                                {r}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-2 text-xs text-zinc-600">
                        <p>{u.telefone || '—'}</p>
                        {u.dataNascimento && <p className="text-zinc-400">Nasc: {u.dataNascimento}</p>}
                        {u.responsavelFormatado && (
                          <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded mt-1">
                            Resp: {u.responsavelFormatado}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => carregarUsuarioParaEdicao(u)}
                          className="text-zinc-500 hover:text-[#4A041C] p-1.5"
                          title="Editar cadastro"
                        >
                          <Pencil size={16} />
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

  // ABA 2: CURSOS & TURMAS
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
                {MODALIDADES.map((m) => (
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Estilo / Nível</label>
                <input
                  type="text"
                  required
                  placeholder={frente === 'Ballet' ? 'Clássico, Baby...' : 'Forró, Bolero...'}
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

  // ABA 3: EVENTOS
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
              <div>
                <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                  <Calendar size={16} className="text-[#D81B60]" /> {ev.titulo}
                </h4>
                <p className="text-xs text-zinc-600 mt-1">
                  {ev.data} ({ev.horaInicio} às {ev.horaFim}) • {ev.local} • Ingresso: R$ {ev.valorIngresso}
                </p>
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
