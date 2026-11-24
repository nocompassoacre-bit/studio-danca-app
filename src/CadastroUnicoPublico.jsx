import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { auth, db } from './firebase';

const ROTULOS_MODALIDADE = {
  aluno: {
    titulo: 'Cadastro de Aluno(a)',
    badge: 'Modalidade: Aluno(a)',
    rotaDestino: '/aluno',
    corBadge: 'bg-zinc-900 text-white',
  },
  prof: {
    titulo: 'Cadastro de Professor(a)',
    badge: 'Modalidade: Professor(a)',
    rotaDestino: '/professor',
    corBadge: 'bg-[#D81B60] text-white',
  },
  bolsista: {
    titulo: 'Cadastro de Bolsista',
    badge: 'Modalidade: Bolsista',
    rotaDestino: '/bolsista',
    corBadge: 'bg-cyan-700 text-white',
  },
  admin: {
    titulo: 'Cadastro de Admin / Coordenação',
    badge: 'Modalidade: Admin / Coordenação',
    rotaDestino: '/admin',
    corBadge: 'bg-amber-600 text-white',
  },
};

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

  return {
    dataFimIso: dataFimObj.toISOString().split('T')[0],
    dataFimBr: dataFimObj.toLocaleDateString('pt-BR'),
  };
}

export default function CadastroUnicoPublico() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [statusConvite, setStatusConvite] = useState('carregando'); // carregando | valido | expirado | invalido | concluido
  const [convite, setConvite] = useState(null);

  // Campos do formulário
  const [frentesAluno, setFrentesAluno] = useState(['Dança de Salão']);
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Responsável legal (Menor de 15 anos)
  const [tipoResponsavel, setTipoResponsavel] = useState('Mãe');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [telefoneSecundarioAluno, setTelefoneSecundarioAluno] = useState('');
  const [emailSecundarioAluno, setEmailSecundarioAluno] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  useEffect(() => {
    const validarToken = async () => {
      if (!token) {
        setStatusConvite('invalido');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'convites_cadastro', token));
        if (!snap.exists()) {
          setStatusConvite('invalido');
          return;
        }
        const dados = { id: snap.id, ...snap.data() };
        if (dados.usado || dados.status === 'expirado' || dados.status === 'usado') {
          setConvite(dados);
          setStatusConvite('expirado');
          return;
        }
        setConvite(dados);
        if (dados.nomeSugerido) setNome(dados.nomeSugerido);
        setStatusConvite('valido');
      } catch (err) {
        console.error('Erro ao validar convite:', err);
        setStatusConvite('invalido');
      }
    };

    validarToken();
  }, [token]);

  const modalidade = convite?.modalidade || 'aluno';
  const infoMod = ROTULOS_MODALIDADE[modalidade] || ROTULOS_MODALIDADE.aluno;
  const isAlunoOuBolsista = modalidade === 'aluno' || modalidade === 'bolsista';
  const isBolsista = modalidade === 'bolsista';

  const idadeCalculada = calcularIdade(dataNascimento);
  const isMenorDe15 = isAlunoOuBolsista && idadeCalculada !== null && idadeCalculada < 15;

  const toggleFrenteAluno = (itemFrente) => {
    setFrentesAluno((prev) =>
      prev.includes(itemFrente)
        ? prev.length > 1
          ? prev.filter((f) => f !== itemFrente)
          : prev
        : [...prev, itemFrente]
    );
  };

  const handleConcluirCadastro = async (e) => {
    e.preventDefault();
    setErroForm('');

    if (senha.length < 6) {
      setErroForm('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErroForm('As senhas digitadas não conferem.');
      return;
    }

    setEnviando(true);
    try {
      // Revalida no Firestore antes de criar conta para evitar uso duplo simultâneo
      const checkSnap = await getDoc(doc(db, 'convites_cadastro', token));
      if (!checkSnap.exists() || checkSnap.data().usado || checkSnap.data().status !== 'ativo') {
        setStatusConvite('expirado');
        setEnviando(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);

      const rotuloResp = `${tipoResponsavel}${nomeResponsavel ? ` - ${nomeResponsavel}` : ''}`;
      const telefoneFormatado = isMenorDe15
        ? `${telefone} (${rotuloResp})${telefoneSecundarioAluno ? ` | ${telefoneSecundarioAluno} (Aluno)` : ''}`
        : telefone;

      const emailFormatadoExibicao = isMenorDe15
        ? `${email.trim()} (${rotuloResp})${emailSecundarioAluno ? ` | ${emailSecundarioAluno} (Aluno)` : ''}`
        : email.trim();

      const vigenciaCalc = isBolsista
        ? calcularVigenciaBolsa(
            convite?.dataEntradaBolsa || new Date().toISOString().split('T')[0],
            convite?.vigenciaBolsaMeses || 6,
            convite?.dataFimBolsa || ''
          )
        : null;

      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        nome: nome.trim(),
        email: email.trim(),
        emailExibicao: emailFormatadoExibicao,
        telefone: telefoneFormatado,
        telefoneRaw: telefone,
        dataNascimento: isAlunoOuBolsista ? dataNascimento : '',
        isMenorDe15: isAlunoOuBolsista ? isMenorDe15 : false,
        tipoResponsavel: isMenorDe15 ? tipoResponsavel : '',
        nomeResponsavel: isMenorDe15 ? nomeResponsavel : '',
        telefoneSecundarioAluno: isMenorDe15 ? telefoneSecundarioAluno : '',
        emailSecundarioAluno: isMenorDe15 ? emailSecundarioAluno : '',
        cpf: cpf.trim(),
        endereco: isAlunoOuBolsista ? endereco.trim() : '',
        contatoEmergencia: isAlunoOuBolsista ? contatoEmergencia.trim() : '',
        frentes: isAlunoOuBolsista ? frentesAluno : [],
        role: modalidade,
        roles: [modalidade],
        podeAvaliarBolsistas: modalidade === 'prof' ? Boolean(convite?.podeAvaliarBolsistas) : false,
        dataEntradaBolsa: isBolsista
          ? convite?.dataEntradaBolsa || new Date().toISOString().split('T')[0]
          : '',
        vigenciaBolsaMeses: isBolsista ? Number(convite?.vigenciaBolsaMeses || 6) : 0,
        dataFimBolsa: vigenciaCalc ? vigenciaCalc.dataFimIso : '',
        status: 'ativo',
        origemCadastro: 'link_unico',
        conviteId: token,
        criadoEm: new Date().toISOString(),
      });

      // Expira imediatamente o link de uso único
      await updateDoc(doc(db, 'convites_cadastro', token), {
        usado: true,
        status: 'expirado',
        usadoPorUid: cred.user.uid,
        usadoPorNome: nome.trim(),
        usadoPorEmail: email.trim(),
        usadoEm: new Date().toISOString(),
      });

      setStatusConvite('concluido');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setErroForm('Este e-mail já possui cadastro no portal. Faça login na página inicial.');
      } else {
        setErroForm('Erro ao concluir cadastro: ' + err.message);
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900 flex flex-col">
      <div className="h-1.5 bg-gradient-to-r from-[#4A041C] via-[#D81B60] to-[#4A041C]" />

      <header className="bg-white border-b border-zinc-200 py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-studio.png" alt="No Compasso" className="h-11 object-contain" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D81B60] block">
                Convite Exclusivo • Uso Único
              </span>
              <h1 className="text-base sm:text-lg font-bold uppercase font-condensed text-[#4A041C] leading-none">
                No Compasso Studio de Dança
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        {statusConvite === 'carregando' && (
          <div className="bg-white p-10 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-500">
            Validando link de convite...
          </div>
        )}

        {(statusConvite === 'invalido' || statusConvite === 'expirado') && (
          <div className="bg-white p-8 rounded-3xl border border-red-200 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Lock size={28} />
            </div>
            <h2 className="text-2xl font-bold uppercase font-condensed text-zinc-900">
              {statusConvite === 'expirado'
                ? 'Este link de cadastro já expirou'
                : 'Link de convite inválido'}
            </h2>
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              {statusConvite === 'expirado'
                ? 'Por segurança, este convite era de uso único e já foi preenchido anteriormente.'
                : 'Não encontramos este convite. Verifique o endereço ou solicite um novo link à coordenação.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A041C] px-6 py-3 text-xs font-bold uppercase text-white hover:bg-[#2D0210]"
            >
              Ir para a Página Inicial
            </button>
          </div>
        )}

        {statusConvite === 'concluido' && (
          <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 size={34} />
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase ${infoMod.corBadge}`}>
              {infoMod.badge}
            </span>
            <h2 className="text-2xl font-bold uppercase font-condensed text-[#4A041C]">
              Cadastro Concluído com Sucesso!
            </h2>
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              Seu acesso já está ativo no portal e este link de convite foi encerrado automaticamente.
            </p>
            <button
              type="button"
              onClick={() => navigate(infoMod.rotaDestino)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#D81B60] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#AD1457] shadow-md"
            >
              Acessar Meu Portal Agora <ArrowRight size={16} />
            </button>
          </div>
        )}

        {statusConvite === 'valido' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-5">
            <div className="border-b border-zinc-200 pb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${infoMod.corBadge}`}>
                  {infoMod.badge}
                </span>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  ⚠️ Expira após o envio
                </span>
              </div>

              <h2 className="text-2xl font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2 pt-1">
                <UserPlus size={22} className="text-[#D81B60]" /> {infoMod.titulo}
              </h2>
              <p className="text-xs text-zinc-500">
                Preencha seus dados abaixo e defina sua senha para liberar seu acesso imediato ao portal.
              </p>

              {isBolsista && convite?.vigenciaBolsaMeses && (
                <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-xs text-cyan-950 flex items-center gap-2">
                  <Clock size={15} className="text-cyan-700 shrink-0" />
                  <span>
                    Vigência definida pela coordenação: <strong>{convite.vigenciaBolsaMeses} mês(es)</strong>{' '}
                    (Início: {convite.dataEntradaBolsa?.split('-').reverse().join('/')}).
                  </span>
                </div>
              )}
            </div>

            {erroForm && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs font-bold text-red-800 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{erroForm}</span>
              </div>
            )}

            <form onSubmit={handleConcluirCadastro} className="space-y-4">
              {isAlunoOuBolsista && (
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
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
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold uppercase border transition ${
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    CPF *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>
              </div>

              {isAlunoOuBolsista && (
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Data de Nascimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                  {idadeCalculada !== null && (
                    <span
                      className={`inline-block mt-1 text-[11px] font-bold ${
                        isMenorDe15 ? 'text-amber-700' : 'text-zinc-500'
                      }`}
                    >
                      Idade: {idadeCalculada} anos{' '}
                      {isMenorDe15 ? '— Preencha os dados do responsável abaixo' : ''}
                    </span>
                  )}
                </div>
              )}

              {isMenorDe15 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3">
                  <p className="text-xs font-bold uppercase text-amber-900 flex items-center gap-1.5">
                    <ShieldAlert size={15} /> Dados do Responsável Legal (Menor de 15 anos)
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                        Vínculo
                      </label>
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
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                        Nome do Responsável *
                      </label>
                      <input
                        type="text"
                        required
                        value={nomeResponsavel}
                        onChange={(e) => setNomeResponsavel(e.target.value)}
                        placeholder="Nome completo do pai/mãe"
                        className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                        WhatsApp do Responsável *
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
                        E-mail do Responsável (Login) *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="responsavel@email.com"
                        className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                        WhatsApp do Aluno (Opcional)
                      </label>
                      <input
                        type="text"
                        value={telefoneSecundarioAluno}
                        onChange={(e) => setTelefoneSecundarioAluno(e.target.value)}
                        placeholder="(68) 99999-9999"
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
                        placeholder="aluno@email.com"
                        className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      WhatsApp *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="(68) 99999-9999"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      E-mail de Acesso *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="seuemail@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {isAlunoOuBolsista && (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Endereço Completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Rua, Número, Bairro - Cidade/UF"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Contato de Emergência
                    </label>
                    <input
                      type="text"
                      placeholder="Nome e Telefone de um familiar/contato"
                      value={contatoEmergencia}
                      onChange={(e) => setContatoEmergencia(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Crie sua Senha (mín. 6 dígitos) *
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 pr-10 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-zinc-500"
                    >
                      {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Confirmar Senha *
                  </label>
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Repita a senha"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-xl bg-gradient-to-r from-[#4A041C] to-[#D81B60] py-3.5 text-xs font-bold uppercase tracking-wider text-white hover:brightness-110 transition shadow-md"
              >
                {enviando
                  ? 'Finalizando Cadastro e Ativando Acesso...'
                  : 'Concluir Cadastro & Entrar no Portal'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
