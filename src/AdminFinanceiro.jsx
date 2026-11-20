import { useState, useMemo } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import {
  TrendingUp, Clock, AlertTriangle, RotateCcw, PlusCircle,
  CheckCircle2, DollarSign, Award, Filter
} from 'lucide-react';
import { db } from './firebase';

export default function AdminFinanceiro({ financeiro, cursos, usuarios, recarregar }) {
  const [periodo, setPeriodo] = useState('todos'); // 'todos' ou 'YYYY-MM'
  const [modalAberto, setModalAberto] = useState(false);

  // Formulário de novo lançamento (Receita ou Pagamento de Prof)
  const [tipo, setTipo] = useState('receita'); // 'receita' | 'despesa_prof'
  const [alunoId, setAlunoId] = useState('');
  const [profId, setProfId] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('pago');
  const [metodo, setMetodo] = useState('PIX');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const alunos = usuarios.filter((u) => u.role === 'aluno');
  const profs = usuarios.filter((u) => u.role === 'prof');

  // Filtragem por período (YYYY-MM)
  const lancamentosFiltrados = useMemo(() => {
    if (periodo === 'todos') return financeiro;
    return financeiro.filter((item) => {
      const dataRef = item.dataPagamento || item.dataVencimento || '';
      return dataRef.startsWith(periodo);
    });
  }, [financeiro, periodo]);

  // Cálculos dos KPIs
  const resumo = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0];
    let recebidas = 0;
    let aReceber = 0;
    let vencidos = 0;
    let pagoProfs = 0;

    lancamentosFiltrados.forEach((item) => {
      const val = Number(item.valor) || 0;
      if (item.tipo === 'receita') {
        if (item.status === 'pago') recebidas += val;
        else if (item.status === 'pendente') {
          if (item.dataVencimento && item.dataVencimento < hoje) vencidos += val;
          else aReceber += val;
        }
      } else if (item.tipo === 'despesa_prof' && item.status === 'pago') {
        pagoProfs += val;
      }
    });

    return { recebidas, aReceber, vencidos, pagoProfs, liquido: recebidas - pagoProfs };
  }, [lancamentosFiltrados]);

  // Ranking dos Cursos Mais Lucrativos
  const rankingCursos = useMemo(() => {
    const mapa = {};
    lancamentosFiltrados.forEach((item) => {
      if (!item.cursoId) return;
      if (!mapa[item.cursoId]) mapa[item.cursoId] = { receita: 0, custoProf: 0, qtd: 0 };
      const val = Number(item.valor) || 0;
      if (item.tipo === 'receita' && item.status === 'pago') {
        mapa[item.cursoId].receita += val;
        mapa[item.cursoId].qtd += 1;
      } else if (item.tipo === 'despesa_prof' && item.status === 'pago') {
        mapa[item.cursoId].custoProf += val;
      }
    });

    return cursos
      .map((c) => {
        const dados = mapa[c.id] || { receita: 0, custoProf: 0, qtd: 0 };
        return {
          ...c,
          receita: dados.receita,
          custoProf: dados.custoProf,
          lucro: dados.receita - dados.custoProf,
          pagamentos: dados.qtd,
        };
      })
      .sort((a, b) => b.lucro - a.lucro);
  }, [lancamentosFiltrados, cursos]);

  const handleSalvarLancamento = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await addDoc(collection(db, 'financeiro'), {
        tipo,
        alunoId: tipo === 'receita' ? alunoId : '',
        profId: tipo === 'despesa_prof' ? profId : '',
        cursoId,
        valor: Number(valor),
        dataVencimento,
        dataPagamento: status === 'pago' ? new Date().toISOString().split('T')[0] : '',
        status,
        metodo,
        observacao,
        criadoEm: new Date().toISOString(),
      });
      setModalAberto(false);
      setValor('');
      setObservacao('');
      recarregar();
    } catch (err) {
      alert('Erro ao salvar lançamento: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleEstornar = async (item) => {
    const motivo = window.prompt('Informe o motivo do estorno deste pagamento:');
    if (!motivo) return;
    try {
      await updateDoc(doc(db, 'financeiro', item.id), {
        status: 'estornado',
        motivoEstorno: motivo,
        dataEstorno: new Date().toISOString().split('T')[0],
      });
      recarregar();
    } catch (err) {
      alert('Erro ao estornar: ' + err.message);
    }
  };

  const handleBaixarPagamento = async (item) => {
    try {
      await updateDoc(doc(db, 'financeiro', item.id), {
        status: 'pago',
        dataPagamento: new Date().toISOString().split('T')[0],
      });
      recarregar();
    } catch (err) {
      alert('Erro ao confirmar pagamento: ' + err.message);
    }
  };

  const getNomeUsuario = (id) => usuarios.find((u) => u.id === id)?.nome || '—';
  const getNomeCurso = (id) => cursos.find((c) => c.id === id)?.titulo || 'Geral / Evento';

  return (
    <div className="space-y-6">
      {/* Barra de Filtro e Botões de Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Filter size={18} className="text-[#4A041C]" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Período:</span>
          <input
            type="month"
            value={periodo === 'todos' ? '' : periodo}
            onChange={(e) => setPeriodo(e.target.value || 'todos')}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 focus:border-[#D81B60] focus:outline-none"
          />
          {periodo !== 'todos' && (
            <button
              onClick={() => setPeriodo('todos')}
              className="text-xs font-semibold text-[#D81B60] hover:underline"
            >
              Ver todo o histórico
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setTipo('receita'); setModalAberto(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition shadow-sm"
          >
            <PlusCircle size={16} />
            Registrar Pagamento
          </button>
          <button
            onClick={() => { setTipo('despesa_prof'); setModalAberto(true); }}
            className="flex items-center gap-2 rounded-xl bg-[#4A041C] hover:bg-[#2D0210] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition shadow-sm"
          >
            <DollarSign size={16} />
            Pagar Professor
          </button>
        </div>
      </div>

      {/* Cards de Indicadores Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Receitas Recebidas</span>
            <TrendingUp size={20} />
          </div>
          <p className="text-3xl font-bold font-condensed text-zinc-900">
            R$ {resumo.recebidas.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Líquido após profs: <strong className="text-zinc-800">R$ {resumo.liquido.toFixed(2).replace('.', ',')}</strong>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Valores a Receber</span>
            <Clock size={20} />
          </div>
          <p className="text-3xl font-bold font-condensed text-zinc-900">
            R$ {resumo.aReceber.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Parcelas dentro do prazo</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm">
          <div className="flex items-center justify-between text-red-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Valores Vencidos</span>
            <AlertTriangle size={20} />
          </div>
          <p className="text-3xl font-bold font-condensed text-red-600">
            R$ {resumo.vencidos.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Inadimplência em aberto</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between text-[#4A041C] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Repasse Professores</span>
            <DollarSign size={20} />
          </div>
          <p className="text-3xl font-bold font-condensed text-zinc-900">
            R$ {resumo.pagoProfs.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Total pago no período</p>
        </div>
      </div>

      {/* Análise dos Cursos Mais Lucrativos */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Award size={20} className="text-[#D81B60]" />
          <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900">
            Análise de Lucratividade por Curso
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="py-3 px-2">Curso / Turma</th>
                <th className="py-3 px-2">Estilo</th>
                <th className="py-3 px-2">Receita Bruta</th>
                <th className="py-3 px-2">Custo Prof(s)</th>
                <th className="py-3 px-2">Lucro Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rankingCursos.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="py-3 px-2 font-semibold text-zinc-900">{c.titulo}</td>
                  <td className="py-3 px-2 text-zinc-600">{c.estilo}</td>
                  <td className="py-3 px-2 text-emerald-700 font-semibold">
                    R$ {c.receita.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 px-2 text-zinc-600">
                    R$ {c.custoProf.toFixed(2).replace('.', ',')}
                  </td>
                  <td className="py-3 px-2 font-bold text-[#4A041C]">
                    R$ {c.lucro.toFixed(2).replace('.', ',')}
                  </td>
                </tr>
              ))}
              {rankingCursos.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-zinc-400">
                    Nenhum curso cadastrado para análise ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extrato Geral e Estornos */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-lg font-bold uppercase font-condensed text-zinc-900 mb-4">
          Movimentações Financeiras & Estornos
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="py-3 px-2">Tipo</th>
                <th className="py-3 px-2">Aluno / Professor</th>
                <th className="py-3 px-2">Curso</th>
                <th className="py-3 px-2">Vencimento / Pagto</th>
                <th className="py-3 px-2">Valor</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {lancamentosFiltrados.map((item) => {
                const isReceita = item.tipo === 'receita';
                return (
                  <tr key={item.id} className="hover:bg-zinc-50">
                    <td className="py-3 px-2">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                        isReceita ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {isReceita ? 'Entrada' : 'Pagto Prof'}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-medium text-zinc-900">
                      {isReceita ? getNomeUsuario(item.alunoId) : getNomeUsuario(item.profId)}
                    </td>
                    <td className="py-3 px-2 text-zinc-600">{getNomeCurso(item.cursoId)}</td>
                    <td className="py-3 px-2 text-zinc-600 text-xs">
                      Venc: {item.dataVencimento || '—'}
                      {item.dataPagamento && <span className="block text-emerald-700">Pago: {item.dataPagamento}</span>}
                    </td>
                    <td className="py-3 px-2 font-bold text-zinc-900">
                      R$ {Number(item.valor).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-3 px-2">
                      {item.status === 'pago' && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 size={14} /> Pago ({item.metodo})
                        </span>
                      )}
                      {item.status === 'pendente' && (
                        <span className="text-xs font-bold text-amber-600">Pendente</span>
                      )}
                      {item.status === 'estornado' && (
                        <span className="text-xs font-bold text-red-600" title={item.motivoEstorno}>
                          Estornado
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right space-x-2">
                      {item.status === 'pendente' && (
                        <button
                          onClick={() => handleBaixarPagamento(item)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Confirmar Pagto
                        </button>
                      )}
                      {item.status === 'pago' && (
                        <button
                          onClick={() => handleEstornar(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <RotateCcw size={13} /> Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Lançamento */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200">
            <h3 className="text-xl font-bold uppercase font-condensed text-[#4A041C] mb-4">
              {tipo === 'receita' ? 'Registrar Pagamento de Aluno' : 'Registrar Pagamento a Professor'}
            </h3>

            <form onSubmit={handleSalvarLancamento} className="space-y-4">
              {tipo === 'receita' ? (
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Aluno</label>
                  <select
                    required
                    value={alunoId}
                    onChange={(e) => setAlunoId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  >
                    <option value="">Selecione o aluno...</option>
                    {alunos.map((a) => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Professor</label>
                  <select
                    required
                    value={profId}
                    onChange={(e) => setProfId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  >
                    <option value="">Selecione o professor...</option>
                    {profs.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Curso / Turma</label>
                <select
                  value={cursoId}
                  onChange={(e) => setCursoId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                >
                  <option value="">Geral / Avulso</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>{c.titulo}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="150.00"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Vencimento / Data</label>
                  <input
                    type="date"
                    required
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Situação</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  >
                    <option value="pago">Já Pago</option>
                    <option value="pendente">A Receber / Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Forma</label>
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão Crédito">Cartão Crédito</option>
                    <option value="Cartão Débito">Cartão Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold uppercase text-zinc-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-[#D81B60] px-5 py-2 text-xs font-bold uppercase text-white hover:bg-[#AD1457]"
                >
                  {salvando ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
