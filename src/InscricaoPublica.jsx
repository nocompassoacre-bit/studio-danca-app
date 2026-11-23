import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import {
  CheckCircle2, QrCode, Calendar, Clock, ArrowLeft,
  ShieldCheck, CreditCard, Copy, Check, ExternalLink, AlertCircle
} from 'lucide-react';
import { db } from './firebase';

// Configure aqui a Chave PIX do Studio e o Link Base do Mercado Pago quando vincular
const CHAVE_PIX_STUDIO = '68999999999'; // Substitua pela chave PIX real (CNPJ, e-mail ou telefone)
const LINK_MERCADO_PAGO = ''; // Cole aqui o link de checkout do Mercado Pago quando quiser redirecionar

export default function InscricaoPublica() {
  const { tipo, id } = useParams();
  const [item, setItem] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Etapa: 'dados' -> 'pagamento' -> 'comprovante'
  const [etapa, setEtapa] = useState('dados');
  const [pixCopiado, setPixCopiado] = useState(false);

  // Dados do inscrito
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');
  const [idTransacao, setIdTransacao] = useState('');

  const [processando, setProcessando] = useState(false);
  const [comprovante, setComprovante] = useState(null);

  useEffect(() => {
    const carregarItem = async () => {
      try {
        const colecao = tipo === 'evento' ? 'eventos' : 'cursos';
        const snap = await getDoc(doc(db, colecao, id));
        if (snap.exists()) {
          setItem({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error('Erro ao carregar inscrição:', err);
      } finally {
        setCarregando(false);
      }
    };
    carregarItem();
  }, [tipo, id]);

  const valorExibido = Number(tipo === 'evento' ? item?.valorIngresso : item?.valor) || 0;

  const avancarParaPagamento = (e) => {
    e.preventDefault();
    if (valorExibido === 0) {
      // Se o curso/evento for gratuito (R$ 0,00), confirma direto
      finalizarRegistroPago(true);
    } else {
      setEtapa('pagamento');
    }
  };

  const copiarChavePix = () => {
    navigator.clipboard.writeText(CHAVE_PIX_STUDIO);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 2500);
  };

  const finalizarRegistroPago = async (isGratuito = false) => {
    if (!isGratuito && !idTransacao.trim()) {
      alert('Informe o código/ID do comprovante PIX ou da transação do Mercado Pago para validar o pagamento integral.');
      return;
    }

    setProcessando(true);
    try {
      const codigoComprovante = `NC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const hoje = new Date().toISOString().split('T')[0];

      // 1. Registra o Aluno Avulso na base
      const alunoAvulsoRef = await addDoc(collection(db, 'users'), {
        nome,
        email,
        telefone,
        dataNascimento,
        cpf,
        endereco,
        role: 'aluno',
        tipoCadastro: 'avulso_online',
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      });

      // 2. Registra a Matrícula na turma / evento
      await addDoc(collection(db, 'matriculas'), {
        alunoId: alunoAvulsoRef.id,
        alunoNome: nome,
        roleParticipante: 'aluno',
        cursoId: id,
        cursoTitulo: item.titulo,
        tipoInscricao: tipo,
        codigoComprovante,
        dataMatricula: hoje,
        diasRestantes: tipo === 'curso' ? 30 : 1,
        status: 'ativa',
      });

      // 3. Lança no Financeiro apenas com o valor integral confirmado
      await addDoc(collection(db, 'financeiro'), {
        tipo: 'receita',
        alunoId: alunoAvulsoRef.id,
        alunoNomeAvulso: nome,
        cursoId: tipo === 'curso' ? id : '',
        eventoId: tipo === 'evento' ? id : '',
        valor: valorExibido,
        dataVencimento: hoje,
        dataPagamento: hoje,
        status: 'pago',
        metodo: isGratuito ? 'Isento / Gratuito' : `${metodoPagamento} (Ref: ${idTransacao})`,
        codigoComprovante,
        observacao: `Inscrição Online (${item.titulo}) - ${nome}`,
        criadoEm: new Date().toISOString(),
      });

      setComprovante({
        codigo: codigoComprovante,
        nome,
        cpf,
        titulo: item.titulo,
        data: tipo === 'evento' ? item.data : item.dataInfo,
        horario: `${item.horaInicio || '19:00'} às ${item.horarioFim || item.horaFim || '21:00'}`,
        valor: valorExibido,
        metodo: isGratuito ? 'Gratuito' : `${metodoPagamento} • Ref: ${idTransacao}`,
      });
      setEtapa('comprovante');
    } catch (err) {
      alert('Erro ao registrar inscrição: ' + err.message);
    } finally {
      setProcessando(false);
    }
  };

  if (carregando) {
    return <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center text-zinc-600">Carregando formulário...</div>;
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-bold text-zinc-800">Link de inscrição inválido ou encerrado.</p>
        <Link to="/" className="mt-4 text-sm font-bold text-[#D81B60] underline">Voltar para o site do Studio</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500 hover:text-[#4A041C] mb-6">
          <ArrowLeft size={15} /> Voltar ao início
        </Link>

        {/* ETAPA 3: COMPROVANTE COM QR CODE (Só aparece após pagamento finalizado) */}
        {etapa === 'comprovante' && comprovante && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#4A041C] to-[#D81B60] p-6 text-center text-white">
              <CheckCircle2 size={44} className="mx-auto mb-2 text-emerald-300" />
              <h1 className="text-2xl font-bold uppercase font-condensed">Pagamento Confirmado!</h1>
              <p className="text-xs opacity-90 mt-1">Comprovante oficial de quitação integral — No Compasso Studio</p>
            </div>

            <div className="p-8 text-center space-y-5">
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-dashed border-[#4A041C]/30 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `PAGO|${comprovante.codigo}|${comprovante.nome}|R$${comprovante.valor.toFixed(2)}|${comprovante.titulo}`
                  )}`}
                  alt="QR Code Comprovante"
                  className="w-44 h-44 mx-auto"
                />
                <span className="block mt-2 font-mono text-sm font-bold tracking-widest text-[#4A041C]">
                  {comprovante.codigo}
                </span>
              </div>

              <div className="bg-zinc-50 rounded-2xl p-4 text-left text-sm space-y-2 border border-zinc-200">
                <p><strong>Participante:</strong> {comprovante.nome}</p>
                <p><strong>Atividade:</strong> {comprovante.titulo}</p>
                <p><strong>Data / Horário:</strong> {comprovante.data} • {comprovante.horario}</p>
                <p className="text-emerald-700 font-bold">
                  <strong>Valor Pago Integral:</strong> R$ {comprovante.valor.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs text-zinc-500"><strong>Forma:</strong> {comprovante.metodo}</p>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full rounded-xl bg-[#4A041C] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#2D0210]"
              >
                Salvar / Imprimir Comprovante
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 1 E 2: DADOS E CHECKOUT DE PAGAMENTO */}
        {etapa !== 'comprovante' && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
            {item.cardUrl && (
  <img src={item.cardUrl} alt={item.titulo} className="w-full max-h-80 object-cover" />
)}
            <div className="bg-[#4A041C] p-6 text-white">
              <span className="inline-block px-2.5 py-0.5 rounded bg-[#D81B60] text-[10px] font-bold uppercase tracking-widest mb-2">
                {tipo === 'evento' ? 'Ingresso / Evento' : item.tipoLabel || 'Inscrição Online'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold uppercase font-condensed">{item.titulo}</h1>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-200">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-[#E5C17B]" /> {tipo === 'evento' ? item.data : item.dataInfo}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-[#E5C17B]" /> {item.horaInicio || '19:00'} às {item.horarioFim || item.horaFim || '21:00'}
                </span>
              </div>
            </div>

            {/* ETAPA 1: FORMULÁRIO DE DADOS */}
            {etapa === 'dados' && (
              <form onSubmit={avancarParaPagamento} className="p-6 sm:p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">WhatsApp</label>
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
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      required
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">CPF</label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Endereço</label>
                  <input
                    type="text"
                    required
                    placeholder="Rua, Número, Bairro"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] py-3.5 text-sm font-bold uppercase tracking-wider text-white transition shadow-md"
                  >
                    <CreditCard size={18} />
                    Continuar para Pagamento (R$ {valorExibido.toFixed(2).replace('.', ',')})
                  </button>
                </div>
              </form>
            )}

            {/* ETAPA 2: TELA DE PAGAMENTO (ANTES DE LIBERAR O QR CODE) */}
            {etapa === 'pagamento' && (
              <div className="p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-zinc-500">Valor Integral a Pagar</span>
                    <p className="text-3xl font-bold font-condensed text-[#4A041C]">
                      R$ {valorExibido.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                  <button
                    onClick={() => setEtapa('dados')}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline"
                  >
                    Editar dados
                  </button>
                </div>

                {/* Opção PIX */}
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <p className="text-xs font-bold uppercase text-[#4A041C]">
                    1. Pague via PIX ou Mercado Pago
                  </p>

                  <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-zinc-300">
                    <div className="truncate">
                      <span className="block text-[10px] uppercase text-zinc-400">Chave PIX No Compasso Studio</span>
                      <span className="font-mono text-sm font-bold text-zinc-800">{CHAVE_PIX_STUDIO}</span>
                    </div>
                    <button
                      type="button"
                      onClick={copiarChavePix}
                      className="flex items-center gap-1 rounded-lg bg-[#4A041C] px-3 py-2 text-xs font-bold text-white shrink-0"
                    >
                      {pixCopiado ? <Check size={14} /> : <Copy size={14} />}
                      {pixCopiado ? 'Copiado!' : 'Copiar Chave'}
                    </button>
                  </div>

                  {LINK_MERCADO_PAGO && (
                    <a
                      href={LINK_MERCADO_PAGO}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full rounded-xl bg-sky-600 hover:bg-sky-700 py-2.5 text-xs font-bold uppercase text-white"
                    >
                      Pagar com Cartão no Mercado Pago <ExternalLink size={14} />
                    </a>
                  )}
                </div>

                {/* Validação do Comprovante Pago */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <p className="text-xs font-bold uppercase text-amber-900 flex items-center gap-1.5">
                    <AlertCircle size={15} /> 2. Confirme o Pagamento para Emitir o QR Code
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={metodoPagamento}
                      onChange={(e) => setMetodoPagamento(e.target.value)}
                      className="rounded-xl border border-zinc-300 bg-white p-2.5 text-xs font-semibold"
                    >
                      <option value="PIX">Transferência PIX</option>
                      <option value="Mercado Pago">Mercado Pago</option>
                    </select>

                    <input
                      type="text"
                      required
                      placeholder="ID / Código da transação"
                      value={idTransacao}
                      onChange={(e) => setIdTransacao(e.target.value)}
                      className="rounded-xl border border-zinc-300 bg-white p-2.5 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={processando}
                  onClick={() => finalizarRegistroPago(false)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition shadow-md"
                >
                  <QrCode size={18} />
                  {processando ? 'Validando...' : 'Já Paguei — Gerar Meu QR Code'}
                </button>

                <p className="text-[11px] text-center text-zinc-500 flex items-center justify-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  O QR Code só é emitido mediante confirmação do valor integral.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
