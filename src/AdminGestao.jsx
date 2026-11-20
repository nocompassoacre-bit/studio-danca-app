import { useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { UserPlus, Trash2, BookOpen, Calendar, Sparkles, CheckCircle } from 'lucide-react';
import { db } from './firebase';

export default function AdminGestao({ aba, usuarios, cursos, eventos, recarregar }) {
  // Estados para Cadastro de Usuários
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [role, setRole] = useState('aluno');
  const [criandoUser, setCriandoUser] = useState(false);

  // Estados para Cadastro de Cursos
  const [tituloCurso, setTituloCurso] = useState('');
  const [tipoCurso, setTipoCurso] = useState('fixo');
  const [estilo, setEstilo] = useState('Forró');
  const [valorCurso, setValorCurso] = useState('');
  const [dataInfo, setDataInfo] = useState('');
  const [duracaoAula, setDuracaoAula] = useState('1h30');
  const [duracaoTotal, setDuracaoTotal] = useState('Mensal');
  const [horarioFim, setHorarioFim] = useState('21:00');
  const [profIdSelecionado, setProfIdSelecionado] = useState('');

  // Estados para Cadastro de Eventos
  const [tituloEvento, setTituloEvento] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [localEvento, setLocalEvento] = useState('No Compasso Studio de Dança');
  const [valorIngresso, setValorIngresso] = useState('');
  const [descEvento, setDescEvento] = useState('');

  const profs = usuarios.filter((u) => u.role === 'prof');

  // Cria usuário no Firebase Auth sem deslogar o Admin atual
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
        role,
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      });

      setNome('');
      setEmail('');
      setSenha('');
      setTelefone('');
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
    try {
      await addDoc(collection(db, 'cursos'), {
        titulo: tituloCurso,
        tipo: tipoCurso,
        estilo,
        valor: Number(valorCurso),
        dataInfo,
        duracaoAula,
        duracaoTotal,
        horarioFim,
        profId: profIdSelecionado,
        professoresNomes: profObj ? profObj.nome : 'Equipe No Compasso',
        ativo: true,
        criadoEm: new Date().toISOString(),
      });
      setTituloCurso('');
      setValorCurso('');
      setDataInfo('');
      alert('Curso lançado na vitrine com sucesso!');
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
        local: localEvento,
        valorIngresso: Number(valorIngresso || 0),
        descricao: descEvento,
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

  // ABA: USUÁRIOS (Alunos, Bolsistas, Professores, Admins)
  if (aba === 'usuarios') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Novo Cadastro com Senha */}
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

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">WhatsApp / Telefone</label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(68) 99999-9999"
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

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

        {/* Lista Geral de Usuários */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
            Base de Usuários ({usuarios.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="py-3 px-2">Nome</th>
                  <th className="py-3 px-2">Perfil</th>
                  <th className="py-3 px-2">Contato</th>
                  <th className="py-3 px-2 text-right">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50">
                    <td className="py-3 px-2">
                      <p className="font-semibold text-zinc-900">{u.nome}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
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
                    <td className="py-3 px-2 text-zinc-600">{u.telefone || '—'}</td>
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

  // ABA: CURSOS & TURMAS
  if (aba === 'cursos') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 text-[#4A041C]">
            <BookOpen size={20} />
            <h3 className="text-lg font-bold uppercase font-condensed">Lançar Novo Curso</h3>
          </div>

          <form onSubmit={handleCriarCurso} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Modalidade</label>
              <select
                value={tipoCurso}
                onChange={(e) => setTipoCurso(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              >
                <option value="fixo">Turma Fixa (Regular)</option>
                <option value="ferias">Curso de Férias / Intensivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Nome da Turma / Curso</label>
              <input
                type="text"
                required
                placeholder="Ex: Forró Pé de Serra Iniciante"
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
                  required
                  placeholder="120"
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
                placeholder="Ter e Qui • 19h30 às 21h"
                value={dataInfo}
                onChange={(e) => setDataInfo(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">Duração Aula</label>
                <input
                  type="text"
                  value={duracaoAula}
                  onChange={(e) => setDuracaoAula(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">Duração Total</label>
                <input
                  type="text"
                  value={duracaoTotal}
                  onChange={(e) => setDuracaoTotal(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">Hora Fim</label>
                <input
                  type="time"
                  value={horarioFim}
                  onChange={(e) => setHorarioFim(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2 text-sm text-zinc-900"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[#4A041C] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#2D0210] transition"
            >
              Publicar Curso no Site
            </button>
          </form>
        </div>

        {/* Histórico e Status dos Cursos */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
            Lançamentos & Histórico de Cursos ({cursos.length})
          </h3>

          <div className="space-y-3">
            {cursos.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-200 bg-zinc-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      c.tipo === 'ferias' ? 'bg-[#D81B60] text-white' : 'bg-zinc-800 text-white'
                    }`}>
                      {c.tipo === 'ferias' ? 'Férias' : 'Fixo'}
                    </span>
                    <h4 className="font-bold text-zinc-900">{c.titulo}</h4>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1">
                    {c.estilo} • Prof: <strong>{c.professoresNomes}</strong> • {c.dataInfo} • R$ {c.valor}
                  </p>
                </div>

                <button
                  onClick={() => handleAlternarStatusCurso(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                    c.ativo
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                  }`}
                >
                  {c.ativo ? 'Ativo na Vitrine' : 'Encerrado (Histórico)'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ABA: EVENTOS
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
            <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data e Horário</label>
            <input
              type="text"
              required
              placeholder="Ex: 20/12 às 21h"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
            />
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
            Publicar Evento
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
          Eventos Cadastrados ({eventos.length})
        </h3>
        <div className="space-y-3">
          {eventos.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-zinc-50">
              <div>
                <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                  <Calendar size={16} className="text-[#D81B60]" /> {ev.titulo}
                </h4>
                <p className="text-xs text-zinc-600 mt-1">
                  {ev.data} • {ev.local} • Ingresso: R$ {ev.valorIngresso}
                </p>
              </div>
              <button
                onClick={async () => { await deleteDoc(doc(db, 'eventos', ev.id)); recarregar(); }}
                className="text-zinc-400 hover:text-red-600 p-2"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
