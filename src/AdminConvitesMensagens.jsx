import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  Link2,
  Copy,
  Check,
  Trash2,
  MessageSquare,
  Send,
  UserPlus,
  ShieldCheck,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { db } from './firebase';
import { useAuth } from './AuthContext';

const LABELS_MOD = {
  aluno: { nome: 'Aluno(a)', cor: 'bg-zinc-900 text-white' },
  prof: { nome: 'Professor(a)', cor: 'bg-[#D81B60] text-white' },
  bolsista: { nome: 'Bolsista', cor: 'bg-cyan-700 text-white' },
};

export function GeradorLinkCadastroUnico() {
  const { userData } = useAuth();
  const [modalidade, setModalidade] = useState('aluno');
  const [nomeSugerido, setNomeSugerido] = useState('');
  const [dataEntradaBolsa, setDataEntradaBolsa] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [vigenciaBolsaMeses, setVigenciaBolsaMeses] = useState(6);
  const [podeAvaliarBolsistas, setPodeAvaliarBolsistas] = useState(false);

  const [convites, setConvites] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [ultimoLinkGerado, setUltimoLinkGerado] = useState('');
  const [copiadoId, setCopiadoId] = useState('');

  const carregarConvites = async () => {
    try {
      const snap = await getDocs(collection(db, 'convites_cadastro'));
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
      setConvites(lista);
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
    }
  };

  useEffect(() => {
    carregarConvites();
  }, []);

  const gerarTokenUnico = () => {
    const parte1 = Math.random().toString(36).substring(2, 10);
    const parte2 = Date.now().toString(36);
    const parte3 = Math.random().toString(36).substring(2, 8);
    return `${parte1}-${parte2}-${parte3}`;
  };

  const handleGerarLink = async (e) => {
    e.preventDefault();
    setGerando(true);
    try {
      const token = gerarTokenUnico();
      const urlCompleta = `${window.location.origin}/cadastro-unico/${token}`;

      await setDoc(doc(db, 'convites_cadastro', token), {
        token,
        modalidade,
        nomeSugerido: nomeSugerido.trim(),
        dataEntradaBolsa: modalidade === 'bolsista' ? dataEntradaBolsa : '',
        vigenciaBolsaMeses: modalidade === 'bolsista' ? Number(vigenciaBolsaMeses) : 0,
        podeAvaliarBolsistas: modalidade === 'prof' ? podeAvaliarBolsistas : false,
        status: 'ativo',
        usado: false,
        criadoPor: userData?.nome || 'Coordenação',
        criadoEm: new Date().toISOString(),
      });

      setUltimoLinkGerado(urlCompleta);
      setNomeSugerido('');
      await carregarConvites();
    } catch (err) {
      alert('Erro ao gerar link de convite: ' + err.message);
    } finally {
      setGerando(false);
    }
  };

  const copiarTexto = async (texto, idRef) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(idRef);
      setTimeout(() => setCopiadoId(''), 2500);
    } catch {
      alert('Não foi possível copiar automaticamente. Selecione e copie o link manualmente.');
    }
  };

  const abrirWhatsAppConvite = (url, mod, nomeRef) => {
    const rotulo = LABELS_MOD[mod]?.nome || 'Integrante';
    const saudacao = nomeRef ? `Olá, ${nomeRef}!` : 'Olá!';
    const msg = `${saudacao} Segue seu link exclusivo (uso único) para realizar seu cadastro como *${rotulo}* no portal do *No Compasso Studio de Dança*:\n\n${url}\n\n⚠️ Atenção: este link expira assim que você concluir o envio.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const revogarConvite = async (id) => {
    if (!window.confirm('Deseja invalidar/excluir este link de convite?')) return;
    try {
      await deleteDoc(doc(db, 'convites_cadastro', id));
      carregarConvites();
    } catch (err) {
      alert('Erro ao excluir convite: ' + err.message);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#D81B60] block">
            Autocadastro Seguro • Uso Único
          </span>
          <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
            <Link2 size={19} className="text-[#D81B60]" /> Gerar Link de Cadastro Único
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-600" /> Expira automaticamente após o 1º envio
        </span>
      </div>

      <form onSubmit={handleGerarLink} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
            Modalidade do Cadastro *
          </label>
          <select
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-bold text-zinc-900"
          >
            <option value="aluno">Aluno(a)</option>
            <option value="prof">Professor(a)</option>
            <option value="bolsista">Bolsista</option>
          </select>
        </div>

        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
            Nome de Referência / Destinatário (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Maria Clara (para identificar o link)"
            value={nomeSugerido}
            onChange={(e) => setNomeSugerido(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
          />
        </div>

        <div className="md:col-span-4">
          <button
            type="submit"
            disabled={gerando}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-white transition shadow-sm"
          >
            <UserPlus size={16} />
            {gerando ? 'Gerando...' : 'Gerar Link Exclusivo'}
          </button>
        </div>

        {modalidade === 'bolsista' && (
          <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-cyan-50 border border-cyan-200">
            <div>
              <label className="block text-[11px] font-bold uppercase text-cyan-900 mb-1">
                Data de Início da Bolsa
              </label>
              <input
                type="date"
                value={dataEntradaBolsa}
                onChange={(e) => setDataEntradaBolsa(e.target.value)}
                className="w-full rounded-lg border border-cyan-300 bg-white p-2 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-cyan-900 mb-1">
                Vigência do Ciclo (Meses)
              </label>
              <input
                type="number"
                min="1"
                max="36"
                value={vigenciaBolsaMeses}
                onChange={(e) => setVigenciaBolsaMeses(e.target.value)}
                className="w-full rounded-lg border border-cyan-300 bg-white p-2 text-xs font-semibold"
              />
            </div>
          </div>
        )}

        {modalidade === 'prof' && (
          <div className="md:col-span-12 p-3 rounded-xl bg-pink-50 border border-pink-200 flex items-center gap-2">
            <input
              id="permAvaliarLink"
              type="checkbox"
              checked={podeAvaliarBolsistas}
              onChange={(e) => setPodeAvaliarBolsistas(e.target.checked)}
              className="rounded border-zinc-400"
            />
            <label htmlFor="permAvaliarLink" className="text-xs font-semibold text-zinc-800">
              Liberar permissão para este(a) professor(a) avaliar bolsistas no portal
            </label>
          </div>
        )}
      </form>

      {ultimoLinkGerado && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2.5">
          <p className="text-xs font-bold uppercase text-emerald-900">
            ✅ Link Único Gerado! Envie para a pessoa preencher:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={ultimoLinkGerado}
              className="flex-1 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-mono text-zinc-800"
            />
            <button
              type="button"
              onClick={() => copiarTexto(ultimoLinkGerado, 'topo')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold uppercase text-white"
            >
              {copiadoId === 'topo' ? <Check size={15} /> : <Copy size={15} />}
              {copiadoId === 'topo' ? 'Copiado!' : 'Copiar Link'}
            </button>
            <button
              type="button"
              onClick={() =>
                abrirWhatsAppConvite(ultimoLinkGerado, modalidade, nomeSugerido)
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] hover:brightness-95 px-4 py-2 text-xs font-bold uppercase text-white"
            >
              <ExternalLink size={15} /> WhatsApp
            </button>
          </div>
        </div>
      )}

      {convites.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="block text-[11px] font-bold uppercase text-zinc-500">
            Histórico de Links Gerados ({convites.length})
          </span>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {convites.map((c) => {
              const expirado = c.usado || c.status === 'expirado';
              const linkItem = `${window.location.origin}/cadastro-unico/${c.token}`;
              const info = LABELS_MOD[c.modalidade] || LABELS_MOD.aluno;

              return (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    expirado
                      ? 'bg-zinc-100 border-zinc-200 opacity-75'
                      : 'bg-zinc-50 border-zinc-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${info.cor}`}>
                        {info.nome}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          expirado
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {expirado ? 'Expirado (Utilizado)' : 'Ativo • Aguardando Uso'}
                      </span>
                      {c.nomeSugerido && (
                        <strong className="text-zinc-900">• {c.nomeSugerido}</strong>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-500">
                      {expirado
                        ? `Preenchido por: ${c.usadoPorNome || 'Usuário'} (${c.usadoPorEmail || ''}) em ${
                            c.usadoEm ? new Date(c.usadoEm).toLocaleDateString('pt-BR') : ''
                          }`
                        : `Criado em ${
                            c.criadoEm ? new Date(c.criadoEm).toLocaleDateString('pt-BR') : ''
                          }`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {!expirado && (
                      <>
                        <button
                          type="button"
                          onClick={() => copiarTexto(linkItem, c.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100"
                        >
                          {copiadoId === c.id ? <Check size={13} /> : <Copy size={13} />}
                          {copiadoId === c.id ? 'Copiado' : 'Copiar'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            abrirWhatsAppConvite(linkItem, c.modalidade, c.nomeSugerido)
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          WhatsApp
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => revogarConvite(c.id)}
                      title="Excluir registro do convite"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CentralMensagensCoordenacao() {
  const { userData } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [respostasTexto, setRespostasTexto] = useState({});
  const [enviandoId, setEnviandoId] = useState('');

  const carregarMensagens = async () => {
    setCarregando(true);
    try {
      const snap = await getDocs(collection(db, 'mensagens'));
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataEnvio || '').localeCompare(a.dataEnvio || ''));
      setMensagens(lista);
    } catch (err) {
      console.error('Erro ao carregar mensagens da coordenação:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarMensagens();
  }, []);

  const handleResponder = async (msg) => {
    const textoResp = (respostasTexto[msg.id] || '').trim();
    if (!textoResp) return;

    setEnviandoId(msg.id);
    try {
      await updateDoc(doc(db, 'mensagens', msg.id), {
        resposta: textoResp,
        respondidoPor: userData?.nome || 'Coordenação Geral',
        dataResposta: new Date().toISOString(),
        lida: true,
      });

      setRespostasTexto((prev) => ({ ...prev, [msg.id]: '' }));
      await carregarMensagens();
    } catch (err) {
      alert('Erro ao salvar resposta: ' + err.message);
    } finally {
      setEnviandoId('');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#D81B60] block">
            Comunicação Interna & Secretaria
          </span>
          <h3 className="text-xl font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
            <MessageSquare size={20} className="text-[#D81B60]" /> Mensagens de Alunos & Bolsistas ({mensagens.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={carregarMensagens}
          className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
        >
          Atualizar
        </button>
      </div>

      {carregando ? (
        <p className="text-xs text-zinc-500 py-8 text-center">Carregando mensagens...</p>
      ) : mensagens.length === 0 ? (
        <p className="text-xs text-zinc-400 py-8 text-center">
          Nenhuma mensagem recebida ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                msg.resposta
                  ? 'bg-zinc-50 border-zinc-200'
                  : 'bg-pink-50/40 border-pink-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      msg.destinoTipo === 'coordenacao'
                        ? 'bg-[#4A041C] text-white'
                        : 'bg-[#D81B60] text-white'
                    }`}
                  >
                    Para: {msg.destinatarioNome || 'Coordenação'}
                  </span>
                  <strong className="text-sm text-zinc-900">{msg.remetenteNome}</strong>
                  {msg.remetenteTelefone && (
                    <span className="text-zinc-500">({msg.remetenteTelefone})</span>
                  )}
                </div>

                <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <Clock size={12} />
                  {msg.dataEnvio
                    ? new Date(msg.dataEnvio).toLocaleString('pt-BR')
                    : ''}
                </span>
              </div>

              {msg.cursoTitulo && (
                <p className="text-[11px] font-semibold text-zinc-500">
                  Referência: {msg.cursoTitulo}
                </p>
              )}

              <p className="p-3 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-sm">
                {msg.texto}
              </p>

              {msg.resposta ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                  <strong className="block text-[10px] uppercase text-emerald-800 mb-0.5">
                    Respondido por {msg.respondidoPor || 'Coordenação'}:
                  </strong>
                  {msg.resposta}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Escreva uma resposta para aparecer no painel do aluno/bolsista..."
                    value={respostasTexto[msg.id] || ''}
                    onChange={(e) =>
                      setRespostasTexto((prev) => ({
                        ...prev,
                        [msg.id]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    disabled={enviandoId === msg.id}
                    onClick={() => handleResponder(msg)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4A041C] hover:bg-[#2D0210] px-4 py-2 text-xs font-bold uppercase text-white"
                  >
                    <Send size={13} />
                    {enviandoId === msg.id ? 'Enviando...' : 'Responder'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
