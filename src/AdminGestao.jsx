import { useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { UserPlus, Trash2, BookOpen, Calendar, Sparkles, Link2, Check, Users, X } from 'lucide-react';
import { db } from './firebase';

const MODALIDADES = [
  { id: 'fixo', label: 'Turma Fixa (Regular)' },
  { id: 'rapido', label: 'Curso Rápido' },
  { id: 'ferias', label: 'Curso de Férias' },
  { id: 'intensivo', label: 'Intensivo' },
  { id: 'workshop', label: 'Workshop' },
  { id: 'encontro', label: 'Encontro / Prática' },
];

export default function AdminGestao({ aba, usuarios, cursos, eventos, recarregar }) {
  const [copiadoId, setCopiadoId] = useState(null);

  // Modal de Participantes do Curso
  const [cursoSelecionado, setCursoSelecionado] = useState(null);
  const [participantesCurso, setParticipantesCurso] = useState([]);
  const [usuarioParaAdicionar, setUsuarioParaAdicionar] = useState('');
  const [situacaoFinanceiraAdd, setSituacaoFinanceiraAdd] = useState('bolsista_isento'); // 'bolsista_isento' | 'pago_balcao' | 'pendente'
  const [carregandoPart, setCarregandoPart] = useState(false);

  // Estados para Cadastro de Usuários
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');
  const [role, setRole] = useState('aluno');
  const [criandoUser, setCriandoUser] = useState(false);

  // Estados para Cadastro de Cursos
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
  const [gerarFormInscricao, setGerarFormInscricao] = useState(true);

  // Estados para Cadastro de Eventos
  const [tituloEvento, setTituloEvento] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [horaInicioEvento, setHoraInicioEvento] = useState('21:00');
  const [horaFimEvento, setHoraFimEvento] = useState('02:00');
  const [localEvento, setLocalEvento] = useState('No Compasso Studio de Dança');
  const [valorIngresso, setValorIngresso] = useState('');
  const [descEvento, setDescEvento] = useState('');

  const profs = usuarios.filter((u) => u.role === 'prof');
  const alunosEBolsistas = usuarios.filter((u) => u.role === 'aluno' || u.role === 'bolsista');

  const copiarLinkInscricao = (tipo, id) => {
    const url = `${window.location.origin}/inscricao/${tipo}/${id}`;
    navigator.clipboard.writeText(url);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  // Abrir gerenciador de participantes de um curso específico
  const abrirParticipantes = async (curso) => {
    setCursoSelecionado(curso);
    setCarregandoPart(true);
    try {
      const q = query(collection(db, 'matriculas'), where('cursoId', '==', curso.id));
      const snap = await getDocs(q);
      setParticipantesCurso(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setCarregandoPart(false);
    }
  };

  const handleAdicionarParticipanteManual = async (e) => {
    e.preventDefault();
    if (!usuarioParaAdicionar || !cursoSelecionado) return;
    const pessoa = usuarios.find((u) => u.id === usuarioParaAdicionar);
    if (!pessoa) return;

    const jaInscrito = participantesCurso.some((p) => p.alunoId === pessoa.id);
    if (jaInscrito) {
      alert('Esta pessoa já está na lista de participantes deste curso.');
      return;
    }

    const hoje = new Date().toISOString().split('T')[0];
    try {
      await addDoc(collection(db, 'matriculas'), {
        alunoId: pessoa.id,
        alunoNome: pessoa.nome,
        roleParticipante: pessoa.role, // 'aluno' ou 'bolsista'
        cursoId: cursoSelecionado.id,
        cursoTitulo: cursoSelecionado.titulo,
        tipoInscricao: 'manual_admin',
        dataMatricula: hoje,
        diasRestantes: 30,
        status: 'ativa',
      });

      // Se não for bolsista isento, gera lançamento no financeiro
      if (situacaoFinanceiraAdd !== 'bolsista_isento' && Number(cursoSelecionado.valor) > 0) {
        await addDoc(collection(db, 'financeiro'), {
          tipo: 'receita',
          alunoId: pessoa.id,
          cursoId: cursoSelecionado.id,
          valor: Number(cursoSelecionado.valor),
          dataVencimento: hoje,
          dataPagamento: situacaoFinanceiraAdd === 'pago_balcao' ? hoje : '',
          status: situacaoFinanceiraAdd === 'pago_balcao' ? 'pago' : 'pendente',
          metodo: situacaoFinanceiraAdd === 'pago_balcao' ? 'Recepção / Balcão' : 'A Receber',
          observacao: `Inclusão Manual (${cursoSelecionado.titulo}) - ${pessoa.nome}`,
          criadoEm: new Date().toISOString(),
        });
      }

      setUsuarioParaAdicionar('');
      abrirParticipantes(cursoSelecionado);
      recarregar();
    } catch (err) {
      alert('Erro ao adicionar participante: ' + err.message);
    }
  };

  const handleRemoverParticipante = async (matriculaId) => {
    if (!window.confirm('Remover este participante da turma?')) return;
    await deleteDoc(doc(db, 'matriculas', matriculaId));
    abrirParticipantes(cursoSelecionado);
  };

  const handleCriarUsuario = async (e) => {
    e.preventDefault();
    setCriandoUser(true);
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
        nome,
        email,
        telefone,
        dataNascimento: role === 'aluno' ? dataNascimento : '',
        cpf: role === 'aluno' ? cpf : '',
        endereco: role === 'aluno' ? endereco : '',
        contatoEmergencia: role === 'aluno' ? contatoEmergencia : '',
        role,
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      });

      setNome('');
      setEmail('');
      setSenha('');
      setTelefone('');
      setDataNascimento('');
      setCpf('');
      setEndereco('');
      setContatoEmergencia('');
      alert('Usuário cadastrado com sucesso!');
      recarregar();
    } catch (err) {
      alert('Erro ao cadastrar usuário: ' + err.message);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setCriandoUser(false);
    }
  };

  const handleExcluirUsuario = async (u) => {
    if (!window.confirm(`Deseja realmente excluir ${u.nome} do sistema?`)) return;
    try {
      await deleteDoc(doc(db, 'users', u.id));
      recarregar();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleCriarCurso = async (e) => {
    e.preventDefault();
    const profObj = profs.find((p) => p.id === profIdSelecionado);
    const modObj = MODALIDADES.find((m) => m.id === tipoCurso);
    try {
      await addDoc(collection(db, 'cursos'), {
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
        inscricaoAberta: gerarFormInscricao,
        ativo: true,
        criadoEm: new Date().toISOString(),
      });
      setTituloCurso('');
      setValorCurso('');
      setDataInfo('');
      alert('Curso lançado! Agora você pode copiar o link de inscrição ou adicionar participantes manualmente.');
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

  // ABA 1: USUÁRIOS
  if (aba === 'usuarios') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 text-[#4A041C]">
            <UserPlus size={20} />
            <h3 className="text-lg font-bold uppercase font-condensed">Cadastrar Usuário</h3>
          </div>

          <form onSubmit={handleCriarUsuario} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Perfil de Acesso</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900"
              >
                <option value="aluno">Aluno(a)</option>
                <option value="bolsista">Bolsista</option>
                <option value="prof">Professor(a)</option>
                <option value="admin">Coordenação / Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">WhatsApp</label>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(68) 99999-9999"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                />
              </div>
              {role === 'aluno' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data Nascimento</label>
                  <input
                    type="date"
                    required
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  />
                </div>
              )}
            </div>

            {role === 'aluno' && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    required
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, Número, Bairro - Rio Branco/AC"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Contato de Emergência</label>
                  <input
                    type="text"
                    value={contatoEmergencia}
                    onChange={(e) => setContatoEmergencia(e.target.value)}
                    placeholder="Nome e Telefone"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">E-mail de Login</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Senha Inicial (mín. 6 dígitos)</label>
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

            <button
              type="submit"
              disabled={criandoUser}
              className="w-full rounded-xl bg-[#D81B60] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#AD1457] transition"
            >
              {criandoUser ? 'Cadastrando...' : 'Criar Acesso com Senha'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
            Base de Usuários ({usuarios.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="py-3 px-2">Nome / Endereço</th>
                  <th className="py-3 px-2">Perfil</th>
                  <th className="py-3 px-2">Contato / Nasc.</th>
                  <th className="py-3 px-2 text-right">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50">
                    <td className="py-3 px-2">
                      <p className="font-semibold text-zinc-900">{u.nome}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                      {u.endereco && <p className="text-[11px] text-zinc-400 mt-0.5">{u.endereco}</p>}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                        u.role === 'admin' ? 'bg-amber-100 text-amber-800' :
                        u.role === 'prof' ? 'bg-pink-100 text-pink-800' :
                        u.role === 'bolsista' ? 'bg-cyan-100 text-cyan-800' :
                        'bg-zinc-100 text-zinc-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs text-zinc-600">
                      <p>{u.telefone || '—'}</p>
                      {u.dataNascimento && <p className="text-zinc-400">Nasc: {u.dataNascimento}</p>}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleExcluirUsuario(u)}
                        className="text-zinc-400 hover:text-red-600 p-1.5"
                        title="Excluir usuário"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ABA 2: CURSOS & TURMAS
  if (aba === 'cursos') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 text-[#4A041C]">
            <BookOpen size={20} />
            <h3 className="text-lg font-bold uppercase font-condensed">Lançar Curso / Turma</h3>
          </div>

          <form onSubmit={handleCriarCurso} className="space-y-3">
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
                placeholder="Ex: Intensivo de Bolero & Soltinho"
                value={tituloCurso}
                onChange={(e) => setTituloCurso(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Estilo</label>
                <input
                  type="text"
                  required
                  placeholder="Forró, Bolero..."
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
                placeholder="Ex: 15 e 16 de Jan • Sáb e Dom"
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

            <button
              type="submit"
              className="w-full rounded-xl bg-[#4A041C] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#2D0210] transition"
            >
              Publicar Curso & Gerar Link
            </button>
          </form>
        </div>

        {/* Lista de Cursos com Gerenciador de Participantes e Link */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
            Lançamentos & Histórico de Cursos ({cursos.length})
          </h3>

          <div className="space-y-3">
            {cursos.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-200 bg-zinc-50">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
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
                    onClick={() => abrirParticipantes(c)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#4A041C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2D0210] transition"
                  >
                    <Users size={14} />
                    Participantes
                  </button>

                  <button
                    onClick={() => copiarLinkInscricao('curso', c.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#D81B60]/40 bg-pink-50 px-3 py-1.5 text-xs font-bold text-[#D81B60] hover:bg-pink-100 transition"
                  >
                    {copiadoId === c.id ? <Check size={14} /> : <Link2 size={14} />}
                    {copiadoId === c.id ? 'Copiado!' : 'Link Form'}
                  </button>

                  <button
                    onClick={() => handleAlternarStatusCurso(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
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

        {/* MODAL: GERENCIAR PARTICIPANTES (ALUNOS E BOLSISTAS) NO CURSO */}
        {cursoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#D81B60]">Gestão de Turma</span>
                  <h3 className="text-xl font-bold uppercase font-condensed text-[#4A041C]">
                    Participantes: {cursoSelecionado.titulo}
                  </h3>
                </div>
                <button onClick={() => setCursoSelecionado(null)} className="text-zinc-400 hover:text-zinc-800">
                  <X size={20} />
                </button>
              </div>

              {/* Adicionar Aluno ou Bolsista manualmente */}
              <form onSubmit={handleAdicionarParticipanteManual} className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3 mb-4">
                <p className="text-xs font-bold uppercase text-zinc-600">Incluir Aluno ou Bolsista Manualmente</p>

                <select
                  required
                  value={usuarioParaAdicionar}
                  onChange={(e) => setUsuarioParaAdicionar(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900"
                >
                  <option value="">Selecione um Aluno ou Bolsista cadastrado...</option>
                  {alunosEBolsistas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={situacaoFinanceiraAdd}
                    onChange={(e) => setSituacaoFinanceiraAdd(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-300 bg-white p-2 text-xs font-semibold text-zinc-800"
                  >
                    <option value="bolsista_isento">Bolsista / Isento (Sem cobrança)</option>
                    <option value="pago_balcao">Aluno Pago no Balcão (Lança Receita)</option>
                    <option value="pendente">Aluno A Receber (Lança Pendência)</option>
                  </select>

                  <button
                    type="submit"
                    className="rounded-xl bg-[#D81B60] px-4 py-2 text-xs font-bold uppercase text-white hover:bg-[#AD1457]"
                  >
                    + Incluir na Turma
                  </button>
                </div>
              </form>

              {/* Lista de Inscritos */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {carregandoPart ? (
                  <p className="text-xs text-center text-zinc-500 py-4">Carregando participantes...</p>
                ) : participantesCurso.length === 0 ? (
                  <p className="text-xs text-center text-zinc-400 py-4">Nenhum participante inscrito nesta turma ainda.</p>
                ) : (
                  participantesCurso.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 text-sm">
                      <div>
                        <span className="font-semibold text-zinc-900">{p.alunoNome}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.roleParticipante === 'bolsista' ? 'bg-cyan-100 text-cyan-800' : 'bg-zinc-100 text-zinc-700'
                        }`}>
                          {p.roleParticipante || 'aluno'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoverParticipante(p.id)}
                        className="text-zinc-400 hover:text-red-600 p-1"
                        title="Remover da turma"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
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
