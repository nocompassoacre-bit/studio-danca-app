import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { CheckCircle2, QrCode, Calendar, Clock, ArrowLeft, ShieldCheck, CreditCard } from 'lucide-react';
import { db } from './firebase';

export default function InscricaoPublica() {
  const { tipo, id } = useParams(); // tipo: 'curso' | 'evento'
  const [item, setItem] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Dados do inscrito (aluno avulso ou regular)
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('Mercado Pago (PIX / Cartão)');

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

  const handleConfirmarInscricao = async (e) => {
    e.preventDefault();
    setProcessando(true);
    try {
      const valorFinal = Number(tipo === 'evento' ? item.valorIngresso : item.valor) || 0;
      const codigoComprovante = `NC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const hoje = new Date().toISOString().split('T')[0];

      // 1. Registra o Aluno Avulso na base de usuários (se ainda não tiver conta)
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
        cursoId: id,
        cursoTitulo: item.titulo,
        tipoInscricao: tipo,
        codigoComprovante,
        dataMatricula: hoje,
        diasRestantes: tipo === 'curso' ? 30 : 1,
        status: 'ativa',
      });

      // 3. Lança o recebimento automaticamente no Financeiro dos Admins
      await addDoc(collection(db, 'financeiro'), {
        tipo: 'receita',
        alunoId: alunoAvulsoRef.id,
        alunoNomeAvulso: nome,
        cursoId: tipo === 'curso' ? id : '',
        eventoId: tipo === 'evento' ? id : '',
        valor: valorFinal,
        dataVencimento: hoje,
        dataPagamento: hoje,
        status: 'pago',
        metodo: metodoPagamento,
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
        valor: valorFinal,
        metodo: metodoPagamento,
      });
    } catch (err) {
      alert('Erro ao processar inscrição: ' + err.message);
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

  const valorExibido = Number(tipo === 'evento' ? item.valorIngresso : item.valor) || 0;

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500 hover:text-[#4A041C] mb-6">
          <ArrowLeft size={15} /> Voltar ao início
        </Link>

        {/* TELA DE COMPROVANTE COM QR CODE GERADO */}
        {comprovante ? (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#4A041C] to-[#D81B60] p-6 text-center text-white">
              <CheckCircle2 size={44} className="mx-auto mb-2 text-emerald-300" />
              <h1 className="text-2xl font-bold uppercase font-condensed">Inscrição Confirmada!</h1>
              <p className="text-xs opacity-90 mt-1">Apresente este QR Code na recepção do No Compasso Studio</p>
            </div>

            <div className="p-8 text-center space-y-5">
              {/* QR Code gerado dinamicamente com o código único da matrícula */}
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-dashed border-[#4A041C]/30 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `NOCOMPASSO|${comprovante.codigo}|${comprovante.nome}|${comprovante.titulo}`
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
                <p><strong>Valor Pago:</strong> R$ {comprovante.valor.toFixed(2).replace('.', ',')} ({comprovante.metodo})</p>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full rounded-xl bg-[#4A041C] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#2D0210]"
              >
                Salvar / Imprimir Comprovante
              </button>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO DE INSCRIÇÃO + PAGAMENTO */
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
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

            <form onSubmit={handleConfirmarInscricao} className="p-6 sm:p-8 space-y-4">
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
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">CPF (para comprovante)</label>
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

              {/* Bloco de Pagamento / Integração Mercado Pago */}
              <div className="mt-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1.5">
                    <CreditCard size={15} className="text-[#D81B60]" /> Pagamento Online
                  </span>
                  <span className="text-xl font-bold font-condensed text-[#4A041C]">
                    R$ {valorExibido.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <select
                  value={metodoPagamento}
                  onChange={(e) => setMetodoPagamento(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm font-semibold"
                >
                  <option value="Mercado Pago (PIX)">Mercado Pago — PIX Instantâneo</option>
                  <option value="Mercado Pago (Cartão)">Mercado Pago — Cartão de Crédito</option>
                </select>

                <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  Ao confirmar, sua vaga é reservada automaticamente e o QR Code de acesso é emitido.
                </p>
              </div>

              <button
                type="submit"
                disabled={processando}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] py-3.5 text-sm font-bold uppercase tracking-wider text-white transition shadow-md"
              >
                <QrCode size={18} />
                {processando ? 'Confirmando Vaga...' : 'Finalizar Pagamento & Gerar QR Code'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
