import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, AlertCircle } from 'lucide-react';
import { auth, db } from './firebase';

const TITULOS_PERFIL = {
  aluno: 'Área do Aluno',
  bolsista: 'Portal do Bolsista',
  prof: 'Área do Professor',
  admin: 'Coordenação / Admin',
};

const ROTAS_PERFIL = {
  aluno: '/aluno',
  bolsista: '/bolsista',
  prof: '/professor',
  admin: '/admin',
};

export default function LoginModal({ perfil, onClose }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  if (!perfil) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      const userSnap = await getDoc(doc(db, 'users', cred.user.uid));

      if (!userSnap.exists()) {
        setErro('Perfil não encontrado na base do Studio. Contate a coordenação.');
        setCarregando(false);
        return;
      }

      const dados = userSnap.data();
      const listaRoles = Array.isArray(dados.roles) && dados.roles.length > 0
        ? dados.roles
        : [dados.role];

      if (!listaRoles.includes(perfil)) {
        setErro(`Esta conta não possui acesso liberado para ${TITULOS_PERFIL[perfil]}.`);
        setCarregando(false);
        return;
      }

      onClose();
      navigate(ROTAS_PERFIL[perfil]);
    } catch (err) {
      setErro('E-mail ou senha inválidos. Verifique os dados informados pela coordenação.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-[#18181F] border border-[#C5A059]/40 p-8 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-white transition"
        >
          <X size={22} />
        </button>

        <div className="text-center mb-6">
          <span className="text-xs uppercase tracking-[0.25em] text-[#C5A059] font-semibold">
            No Compasso Studio
          </span>
          <h2 className="text-3xl font-bold uppercase tracking-tight font-condensed mt-1">
            {TITULOS_PERFIL[perfil]}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Acesso restrito com credenciais fornecidas pela coordenação
          </p>
        </div>

        {erro && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-950/70 border border-red-500/50 p-3 text-xs text-red-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1.5">
              E-mail Cadastrado
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-xl bg-[#0F0F12] border border-zinc-700 pl-10 pr-4 py-3 text-sm text-white focus:border-[#D81B60] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-3.5 text-zinc-500" />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-[#0F0F12] border border-zinc-700 pl-10 pr-4 py-3 text-sm text-white focus:border-[#D81B60] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-gradient-to-r from-[#D81B60] to-[#9C1445] py-3.5 text-sm font-bold uppercase tracking-widest text-white shadow-lg hover:brightness-110 transition disabled:opacity-50"
          >
            {carregando ? 'Entrando...' : 'Acessar Painel'}
          </button>
        </form>
      </div>
    </div>
  );
}
