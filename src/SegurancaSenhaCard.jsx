import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { auth } from './firebase';
import { useAuth } from './AuthContext';

export default function SegurancaSenhaCard() {
  const { user, userData } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const emailAlvo = user?.email || userData?.email || '';

  const handleDispararCodigoEmail = async () => {
    if (!emailAlvo) {
      alert('Nenhum e-mail vinculado a esta conta.');
      return;
    }
    setEnviando(true);
    try {
      await sendPasswordResetEmail(auth, emailAlvo);
      setEnviado(true);
    } catch (err) {
      alert('Não foi possível enviar o código agora: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-pink-50 text-[#D81B60]">
          <KeyRound size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase text-[#4A041C]">Segurança & Senha de Acesso</h4>
          <p className="text-xs text-zinc-600 mt-0.5">
            Enviamos um código/link de verificação para <strong>{emailAlvo}</strong> para você definir uma nova senha.
          </p>
          {enviado && (
            <p className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1">
              <CheckCircle2 size={14} /> Código enviado! Verifique sua caixa de entrada ou spam.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={enviando}
        onClick={handleDispararCodigoEmail}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A041C] px-4 py-2.5 text-xs font-bold uppercase text-white hover:bg-[#D81B60] transition shrink-0"
      >
        <Mail size={15} />
        {enviando ? 'Enviando...' : enviado ? 'Reenviar Código' : 'Alterar Senha via E-mail'}
      </button>
    </div>
  );
}
