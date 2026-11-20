import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';

const PERFIL_INFO = {
  aluno: { titulo: 'Portal do Aluno', cor: 'border-[#800E30] text-[#E91E63]', rota: '/aluno' },
  bolsista: { titulo: 'Portal do Bolsista', cor: 'border-[#0E5A6D] text-[#22D3EE]', rota: '/bolsista' },
  prof: { titulo: 'Portal do Professor', cor: 'border-[#D81B60] text-[#D81B60]', rota: '/professor' },
  admin: { titulo: 'Coordenação / Admin', cor: 'border-[#C5A059] text-[#E5C17B]', rota: '/admin' },
};

export default function LoginModal({ perfil, onClose }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const { loginComPerfil } = useAuth();
  const navigate = useNavigate();

  if (!perfil) return null;
  const info = PERFIL_INFO[perfil];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await loginComPerfil(email, senha, perfil);
      onClose();
      navigate(info.rota);
    } catch (err) {
      setErro(err.message || 'E-mail ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-md rounded-2xl bg-[#16161B] border ${info.cor.split(' ')[0]} p-8 shadow-2xl`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
        >
          <X size={22} />
        </button>

        <div className="text-center mb-6">
          <img src="/logo-studio.png" alt="No Compasso" className="h-14 mx-auto mb-3 object-contain" />
          <h2 className={`text-2xl font-bold uppercase tracking-wider font-condensed ${info.cor.split(' ')[1]}`}>
            {info.titulo}
          </h2>
          <p className="text-xs text-zinc-400 tracking-widest uppercase mt-1">
            Insira suas credenciais de acesso
          </p>
        </div>

        {erro && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-950/70 border border-red-500/40 p-3 text-sm text-red-200">
            <AlertCircle size={18} className="shrink-0 text-red-400" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1.5 font-semibold">
              E-mail cadastrado
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-xl bg-[#0F0F12] border border-zinc-800 pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#D81B60] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1.5 font-semibold">
              Senha
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-3 text-zinc-500" />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl bg-[#0F0F12] border border-zinc-800 pl-10 pr-4 py-2.5 text-sm text-white focus:border-[#D81B60] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#5C0A24] to-[#D81B60] py-3 font-bold uppercase tracking-wider text-sm text-white hover:opacity-95 transition disabled:opacity-50"
          >
            {carregando ? 'Verificando...' : 'Entrar no Sistema'}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
