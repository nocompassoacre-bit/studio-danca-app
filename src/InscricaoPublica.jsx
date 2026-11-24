import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import {
  CheckCircle2,
  QrCode,
  Calendar,
  Clock,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Ticket,
  MapPin,
} from 'lucide-react';
import { db } from './firebase';

const CHAVE_PIX_STUDIO = '20936547000100'; // Substitua pela chave PIX real do studio

export default function InscricaoPublica() {
  const { tipo, id } = useParams();
  const [searchParams] = useSearchParams();
  const [item, setItem] = useState(null);
  const [vendasExistentes, setVendasExistentes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Etapa: 'dados' -> 'pagamento' -> 'comprovante'
  const [etapa, setEtapa] = useState('dados');
  const [pixCopiado, setPixCopiado] = useState(false);
  const [gerandoLinkMp, setGerandoLinkMp] = useState(false);

  // Seleção de Sessão e Ingressos (para eventos)
  const [sessaoSelecionadaId, setSessaoSelecionadaId] = useState('');
  const [qtdInteira, setQtdInteira] = useState(1);
  const [qtdMeia, setQtdMeia] = useState(0);

  // Dados do inscrito/comprador
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [endereco, setEndereco] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('Mercado Pago');
  const [idTransacao, setIdTransacao] = useState('');

  const [processando, setProcessando] = useState(false);
  const [comprovante, setComprovante] = useState(null);

  useEffect(() => {
    const carregarItem = async () => {
      try {
        const colecao = tipo === 'evento' ? 'eventos' : 'cursos';
        const snap = await getDoc(doc(db, colecao, id));
        if (snap.exists()) {
          const dados = { id: snap.id, ...snap.data() };
          setItem(dados);

          if (tipo === 'evento') {
            const listaSessoes =
              Array.isArray(dados.sessoes) && dados.sessoes.length > 0
                ? dados.sessoes
                : [
                    {
                      id: 'sessao_1',
                      data: dados.data,
                      horaInicio: dados.horaInicio || '19:00',
                      horaFim: dados.horaFim || '22:00',
                      capacidadeTotal: dados.capacidadeGeral || 100,
                    },
                  ];
            setSessaoSelecionadaId(listaSessoes[0].id);

            const vendasSnap = await getDocs(
              query(collection(db, 'financeiro'), where('eventoId', '==', id))
            );
            setVendasExistentes(
              vendasSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
            );
          }
        }

        // Verifica retorno automático aprovado do Mercado Pago
        const mpStatus = searchParams.get('mp_status');
        const refFinId = searchParams.get('ref');
        if (mpStatus === 'approved' && refFinId) {
          const finSnap = await getDoc(doc(db, 'financeiro', refFinId));
          if (finSnap.exists()) {
            const finData = finSnap.data();
            if (finData.status !== 'pago') {
              await updateDoc(doc(db, 'financeiro', refFinId), {
                status: 'pago',
                dataPagamento: new Date().toISOString().split('T')[0],
                metodo: 'Mercado Pago (Aprovado Online)',
              });
            }
            setComprovante({
              codigo: finData.codigoComprovante,
              nome: finData.alunoNomeAvulso,
              cpf: finData.cpfComprador || '',
              titulo: finData.tituloItem || 'Evento No Compasso',
              data: finData.dataSessao || '',
              horario: finData.horarioSessao || '',
              valor: Number(finData.valor || 0),
              metodo: 'Mercado Pago Online (Confirmado)',
              detalheIngressos: `${finData.qtdInteira || 0} Inteira(s), ${finData.qtdMeia || 0} Meia(s)`,
            });
            setEtapa('comprovante');
          }
        }
      } catch (err) {
        console.error('Erro ao carregar inscrição:', err);
      } finally {
        setCarregando(false);
      }
    };
    carregarItem();
  }, [tipo, id, searchParams]);

  const sessoesDisponiveis = useMemo(() => {
    if (tipo !== 'evento' || !item) return [];
    return Array.isArray(item.sessoes) && item.sessoes.length > 0
      ? item.sessoes
      : [
          {
            id: 'sessao_1',
            data: item.data,
            horaInicio: item.horaInicio || '19:00',
            horaFim: item.horaFim || '22:00',
            capacidadeTotal: item.capacidadeGeral || 100,
          },
        ];
  }, [tipo, item]);

  const sessaoAtual =
    sessoesDisponiveis.find((s) => s.id === sessaoSelecionadaId) ||
    sessoesDisponiveis[0];

  const ingressosRestantesSessao = useMemo(() => {
    if (tipo !== 'evento' || !sessaoAtual) return 999;
    const vendidosDia = vendasExistentes
      .filter((v) => v.sessaoId === sessaoAtual.id || v.dataSessao === sessaoAtual.data)
      .reduce(
        (acc, v) =>
          acc +
          Number(v.qtdInteira ?? (v.tipoIngresso === 'meia' ? 0 : 1)) +
          Number(v.qtdMeia ?? (v.tipoIngresso === 'meia' ? 1 : 0)),
        0
      );
    return Math.max(0, Number(sessaoAtual.capacidadeTotal || 0) - vendidosDia);
  }, [tipo, sessaoAtual, vendasExistentes]);

  const precoInteira = Number(item?.valorInteira ?? item?.valorIngresso ?? 0);
  const precoMeia = Number(
    item?.valorMeia ?? (precoInteira > 0 ? precoInteira / 2 : 0)
  );

  const totalIngressosSelecionados =
    tipo === 'evento' ? Number(qtdInteira) + Number(qtdMeia) : 1;

  const valorTotalCalculado =
    tipo === 'evento'
      ? Number(qtdInteira) * precoInteira + Number(qtdMeia) * precoMeia
      : Number(item?.valor || 0);

  const avancarParaPagamento = (e) => {
    e.preventDefault();
    if (tipo === 'evento') {
      if (totalIngressosSelecionados <= 0) {
        alert('Selecione pelo menos 1 ingresso (Inteira ou Meia).');
        return;
      }
      if (totalIngressosSelecionados > ingressosRestantesSessao) {
        alert(
          `Restam apenas ${ingressosRestantesSessao} ingresso(s) disponíveis para este dia.`
        );
        return;
      }
    }

    if (valorTotalCalculado === 0) {
      finalizarRegistroPago(true);
    } else {
      setEtapa('pagamento');
    }
  };

  const handlePagarComMercadoPago = async () => {
    setGerandoLinkMp(true);
    try {
      const codigoComprovante = `NC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const hoje = new Date().toISOString().split('T')[0];

      // Salva pré-reserva no Firestore antes de ir para o Mercado Pago
      const finRef = await addDoc(collection(db, 'financeiro'), {
        tipo: 'receita',
        alunoNomeAvulso: nome,
        compradorEmail: email,
        compradorTelefone: telefone,
        cpfComprador: cpf,
        cursoId: tipo === 'curso' ? id : '',
        eventoId: tipo === 'evento' ? id : '',
        tituloItem: item.titulo,
        sessaoId: sessaoAtual?.id || 'sessao_1',
        dataSessao: sessaoAtual?.data || item.data || '',
        horarioSessao: `${sessaoAtual?.horaInicio || item.horaInicio || '19:00'} às ${
          sessaoAtual?.horaFim || item.horaFim || '22:00'
        }`,
        qtdInteira: tipo === 'evento' ? Number(qtdInteira) : 1,
        qtdMeia: tipo === 'evento' ? Number(qtdMeia) : 0,
        valor: valorTotalCalculado,
        dataVencimento: hoje,
        status: 'pendente_mp',
        metodo: 'Mercado Pago Checkout',
        codigoComprovante,
        observacao: `Checkout Online (${item.titulo}) - ${nome}`,
        criadoEm: new Date().toISOString(),
      });

      const resp = await fetch('/api/criar-pagamento-mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscricaoId: finRef.id,
          tituloEvento: item.titulo,
          dataSessao: sessaoAtual?.data || item.data || item.dataInfo || '',
          qtdInteira: tipo === 'evento' ? Number(qtdInteira) : 1,
          valorInteira: tipo === 'evento' ? precoInteira : valorTotalCalculado,
          qtdMeia: tipo === 'evento' ? Number(qtdMeia) : 0,
          valorMeia: precoMeia,
          compradorNome: nome,
          compradorEmail: email,
          originUrl: window.location.origin,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.init_point) {
        throw new Error(data.error || 'Não foi possível gerar o checkout do Mercado Pago.');
      }

      window.location.href = data.init_point;
    } catch (err) {
      alert('Erro ao conectar com Mercado Pago: ' + err.message);
    } finally {
      setGerandoLinkMp(false);
    }
  };

  const copiarChavePix = () => {
    navigator.clipboard.writeText(CHAVE_PIX_STUDIO);
    setPixCopiado(true);
    setTimeout(() => setPixCopiado(false), 2500);
  };

  const finalizarRegistroPago = async (isGratuito = false) => {
    if (!isGratuito && !idTransacao.trim()) {
      alert(
        'Informe o código/ID do comprovante PIX ou da transação para validar o pagamento.'
      );
      return;
    }

    setProcessando(true);
    try {
      const codigoComprovante = `NC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const hoje = new Date().toISOString().split('T')[0];

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

      await addDoc(collection(db, 'financeiro'), {
        tipo: 'receita',
        alunoId: alunoAvulsoRef.id,
        alunoNomeAvulso: nome,
        cursoId: tipo === 'curso' ? id : '',
        eventoId: tipo === 'evento' ? id : '',
        tituloItem: item.titulo,
        sessaoId: sessaoAtual?.id || 'sessao_1',
        dataSessao: sessaoAtual?.data || item.data || '',
        qtdInteira: tipo === 'evento' ? Number(qtdInteira) : 1,
        qtdMeia: tipo === 'evento' ? Number(qtdMeia) : 0,
        valor: valorTotalCalculado,
        dataVencimento: hoje,
        dataPagamento: hoje,
        status: 'pago',
        metodo: isGratuito
          ? 'Isento / Gratuito'
          : `${metodoPagamento} (Ref: ${idTransacao})`,
        codigoComprovante,
        observacao: `Inscrição Online (${item.titulo}) - ${nome}`,
        criadoEm: new Date().toISOString(),
      });

      setComprovante({
        codigo: codigoComprovante,
        nome,
        cpf,
        titulo: item.titulo,
        data:
          tipo === 'evento'
            ? (sessaoAtual?.data || item.data)?.split('-').reverse().join('/')
            : item.dataInfo,
        horario: `${sessaoAtual?.horaInicio || item.horaInicio || '19:00'} às ${
          sessaoAtual?.horaFim || item.horarioFim || item.horaFim || '21:00'
        }`,
        valor: valorTotalCalculado,
        metodo: isGratuito ? 'Gratuito' : `${metodoPagamento} • Ref: ${idTransacao}`,
        detalheIngressos:
          tipo === 'evento' ? `${qtdInteira} Inteira(s), ${qtdMeia} Meia(s)` : 'Inscrição Individual',
      });
      setEtapa('comprovante');
    } catch (err) {
      alert('Erro ao registrar inscrição: ' + err.message);
    } finally {
      setProcessando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center text-zinc-600">
        Carregando bilheteria / inscrição...
      </div>
    );
  }

  if (!item || item.apenasEquipeBolsistas) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg font-bold text-zinc-800">
          Link inválido, interno ou bilheteria encerrada.
        </p>
        <Link to="/" className="mt-4 text-sm font-bold text-[#D81B60] underline">
          Voltar para o site do Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500 hover:text-[#4A041C] mb-6"
        >
          <ArrowLeft size={15} /> Voltar ao início
        </Link>

        {etapa === 'comprovante' && comprovante && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#4A041C] to-[#D81B60] p-6 text-center text-white">
              <CheckCircle2 size={44} className="mx-auto mb-2 text-emerald-300" />
              <h1 className="text-2xl font-bold uppercase font-condensed">
                Ingresso / Inscrição Confirmada!
              </h1>
              <p className="text-xs opacity-90 mt-1">
                Apresente este QR Code na entrada — No Compasso Studio
              </p>
            </div>

            <div className="p-8 text-center space-y-5">
              <div className="inline-block p-4 bg-white rounded-2xl border-2 border-dashed border-[#4A041C]/30 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    `PAGO|${comprovante.codigo}|${comprovante.nome}|${comprovante.detalheIngressos}|${comprovante.titulo}`
                  )}`}
                  alt="QR Code Comprovante"
                  className="w-44 h-44 mx-auto"
                />
                <span className="block mt-2 font-mono text-sm font-bold tracking-widest text-[#4A041C]">
                  {comprovante.codigo}
                </span>
              </div>

              <div className="bg-zinc-50 rounded-2xl p-4 text-left text-sm space-y-2 border border-zinc-200">
                <p><strong>Titular:</strong> {comprovante.nome}</p>
                <p><strong>Atividade:</strong> {comprovante.titulo}</p>
                <p><strong>Ingressos:</strong> {comprovante.detalheIngressos}</p>
                <p><strong>Data / Horário:</strong> {comprovante.data} • {comprovante.horario}</p>
                <p className="text-emerald-700 font-bold">
                  <strong>Valor Pago:</strong> R$ {comprovante.valor.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs text-zinc-500"><strong>Pagamento:</strong> {comprovante.metodo}</p>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full rounded-xl bg-[#4A041C] py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#2D0210]"
              >
                Salvar / Imprimir Ingresso
              </button>
            </div>
          </div>
        )}

        {etapa !== 'comprovante' && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
            {item.cardUrl && (
              <img src={item.cardUrl} alt={item.titulo} className="w-full max-h-80 object-cover" />
            )}
            <div className="bg-[#4A041C] p-6 text-white">
              <span className="inline-block px-2.5 py-0.5 rounded bg-[#D81B60] text-[10px] font-bold uppercase tracking-widest mb-2">
                {tipo === 'evento' ? 'Bilheteria Oficial' : item.tipoLabel || 'Inscrição Online'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold uppercase font-condensed">{item.titulo}</h1>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-200">
                {item.local && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#E5C17B]" /> {item.local}
                  </span>
                )}
                {tipo !== 'evento' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-[#E5C17B]" /> {item.dataInfo}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} className="text-[#E5C17B]" /> {item.horaInicio || '19:00'} às{' '}
                      {item.horarioFim || '21:00'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {etapa === 'dados' && (
              <form onSubmit={avancarParaPagamento} className="p-6 sm:p-8 space-y-4">
                {/* SELETOR DE DIA E INGRESSOS INTEIRA/MEIA PARA EVENTOS */}
                {tipo === 'evento' && (
                  <div className="p-4 rounded-2xl bg-pink-50/70 border border-[#D81B60]/30 space-y-3">
                    <p className="text-xs font-bold uppercase text-[#4A041C] flex items-center gap-1.5">
                      <Ticket size={16} className="text-[#D81B60]" /> Escolha o Dia & Seus Ingressos
                    </p>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-zinc-600 mb-1">
                        Data / Sessão do Espetáculo
                      </label>
                      <select
                        value={sessaoSelecionadaId}
                        onChange={(e) => setSessaoSelecionadaId(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm font-bold text-zinc-900"
                      >
                        {sessoesDisponiveis.map((s, idx) => (
                          <option key={s.id} value={s.id}>
                            Dia {idx + 1}: {s.data?.split('-').reverse().join('/')} ({s.horaInicio} às {s.horaFim})
                          </option>
                        ))}
                      </select>
                      <span className="inline-block mt-1 text-[11px] font-bold text-emerald-700">
                        🎟️ {ingressosRestantesSessao} ingresso(s) disponíveis neste dia
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white border border-zinc-200">
                        <span className="block text-xs font-bold text-zinc-900">Inteira</span>
                        <span className="block text-xs font-bold text-[#D81B60] mb-1.5">
                          R$ {precoInteira.toFixed(2).replace('.', ',')}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={ingressosRestantesSessao}
                          value={qtdInteira}
                          onChange={(e) => setQtdInteira(Math.max(0, Number(e.target.value)))}
                          className="w-full rounded-lg border border-zinc-300 p-1.5 text-center font-bold text-sm"
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-zinc-200">
                        <span className="block text-xs font-bold text-zinc-900">Meia-Entrada</span>
                        <span className="block text-xs font-bold text-[#D81B60] mb-1.5">
                          R$ {precoMeia.toFixed(2).replace('.', ',')}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={ingressosRestantesSessao}
                          value={qtdMeia}
                          onChange={(e) => setQtdMeia(Math.max(0, Number(e.target.value)))}
                          className="w-full rounded-lg border border-zinc-300 p-1.5 text-center font-bold text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

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
                    Ir para Pagamento (R$ {valorTotalCalculado.toFixed(2).replace('.', ',')})
                  </button>
                </div>
              </form>
            )}

            {etapa === 'pagamento' && (
              <div className="p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-zinc-500">Total a Pagar</span>
                    <p className="text-3xl font-bold font-condensed text-[#4A041C]">
                      R$ {valorTotalCalculado.toFixed(2).replace('.', ',')}
                    </p>
                    {tipo === 'evento' && (
                      <span className="text-xs text-zinc-500">
                        {qtdInteira} Inteira(s) + {qtdMeia} Meia(s)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEtapa('dados')}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-800 underline"
                  >
                    Editar dados
                  </button>
                </div>

                {/* BOTÃO OFICIAL CHECKOUT MERCADO PAGO (PIX AUTOMÁTICO + CARTÃO) */}
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-300 space-y-2.5">
                  <p className="text-xs font-bold uppercase text-sky-950">
                    Opção 1: Checkout Automático Mercado Pago (PIX ou Cartão)
                  </p>
                  <button
                    type="button"
                    disabled={gerandoLinkMp}
                    onClick={handlePagarComMercadoPago}
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-sky-600 hover:bg-sky-700 py-3 text-xs font-bold uppercase text-white shadow-sm transition"
                  >
                    {gerandoLinkMp
                      ? 'Gerando Link Mercado Pago...'
                      : 'Pagar Agora no Mercado Pago'}
                    <ExternalLink size={15} />
                  </button>
                </div>

                {/* OPÇÃO 2: PIX DIRETO COM COMPROVANTE */}
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                  <p className="text-xs font-bold uppercase text-[#4A041C]">
                    Opção 2: Transferência PIX Direta
                  </p>

                  <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-zinc-300">
                    <div className="truncate">
                      <span className="block text-[10px] uppercase text-zinc-400">
                        Chave PIX No Compasso Studio
                      </span>
                      <span className="font-mono text-sm font-bold text-zinc-800">
                        {CHAVE_PIX_STUDIO}
                      </span>
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

                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                    <p className="text-[11px] font-bold uppercase text-amber-900 flex items-center gap-1">
                      <AlertCircle size={14} /> Cole o ID da transação PIX para emitir o QR Code:
                    </p>
                    <input
                      type="text"
                      placeholder="ID / Código do comprovante PIX"
                      value={idTransacao}
                      onChange={(e) => setIdTransacao(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={processando}
                      onClick={() => finalizarRegistroPago(false)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold uppercase tracking-wider text-white transition"
                    >
                      <QrCode size={16} />
                      {processando ? 'Validando...' : 'Confirmar PIX & Gerar QR Code'}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-center text-zinc-500 flex items-center justify-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  O ingresso QR Code é validado automaticamente após confirmação.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
