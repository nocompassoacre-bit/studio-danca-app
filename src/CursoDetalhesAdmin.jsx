import { useState, useEffect } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where
} from 'firebase/firestore';
import {
  ArrowLeft, Users, DollarSign, FileText, BookOpen,
  CheckCircle2, Clock, Trash2, UserPlus, Save, Plus
} from 'lucide-react';
import { db } from './firebase';

export default function CursoDetalhesAdmin({ curso, usuarios, financeiro, onVoltar, recarregarGeral }) {
  const [subAba, setSubAba] = useState('inscritos'); // 'inscritos' | 'ementa' | 'planos'
  const [matriculas, setMatriculas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Adicionar participante
  const [usuarioAddId, setUsuarioAddId] = useState('');
  const [statusFinAdd, setStatusFinAdd] = useState('bolsista_isento');

  // Edição de Ementa e Professor
  const [ementa, setEmenta] = useState(curso.ementa || '');
  const [profId, setProfId] = useState(curso.profId || '');
  const [salvandoEmenta, setSalvandoEmenta] = useState(false);

  // Novo Plano de Aula
  const [tipoPlano, setTipoPlano] = useState('turma');
  const [tituloPlano, setTituloPlano] = useState('');
  const [conteudoPlano, setConteudoPlano] = useState('');

  const profs = usuarios.filter((u) => u.role === 'prof');
  const alunosEBolsistas = usuarios.filter((u) => u.role === 'aluno' || u.role === 'bolsista');

  const carregarDadosTurma = async () => {
    setCarregando(true);
    try {
      const [matSnap, planSnap] = await Promise.all([
        getDocs(query(collection(db, 'matriculas'), where('cursoId', '==', curso.id))),
        getDocs(query(collection(db, 'planos_aula'), where('cursoId', '==', curso.id))),
      ]);
      setMatriculas(matSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPlanos(planSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Erro ao carregar detalhes do curso:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosTurma();
  }, [curso.id]);

  // Cruza cada inscrito com os lançamentos financeiros deste curso
  const inscritosComFinanceiro = matriculas.map((mat) => {
    const lancamentosAluno = financeiro.filter(
      (f) => f.cursoId === curso.id && f.alunoId === mat.alunoId && f.tipo === 'receita' && f.status !== 'estornado'
    );
    const totalPago = lancamentosAluno
      .filter((l) => l.status === 'pago')
      .reduce((acc, l) => acc + Number(l.valor || 0), 0);
    const pendentes = lancamentosAluno.filter((l) => l.status === 'pendente');
    const totalAPagar = pendentes.reduce((acc, l) => acc + Number(l.valor || 0), 0);

    return {
      ...mat,
      totalPago,
      totalAPagar,
      lancamentoPendente: pendentes[0] || null,
    };
  });

  const resumoTurma = inscritosComFinanceiro.reduce(
    (acc, item) => ({
      pago: acc.pago + item.totalPago,
      aPagar: acc.aPagar + item.totalAPagar,
    }),
    { pago: 0, aPagar: 0 }
  );

  const handleAdicionarParticipante = async (e) => {
    e.preventDefault();
    if (!usuarioAddId) return;
    const pessoa = usuarios.find((u) => u.id === usuarioAddId);
    if (!pessoa) return;

    if (matriculas.some((m) => m.alunoId === pessoa.id)) {
      alert('Esta pessoa já está inscrita nesta turma.');
      return;
    }

    const hoje = new Date().toISOString().split('T')[0];
    try {
      await addDoc(collection(db, 'matriculas'), {
        alunoId: pessoa.id,
        alunoNome: pessoa.nome,
        roleParticipante: pessoa.role,
        cursoId: curso.id,
        cursoTitulo: curso.titulo,
        tipoInscricao: 'manual_admin',
        dataMatricula: hoje,
        diasRestantes: 30,
        status: 'ativa',
      });

      if (statusFinAdd !== 'bolsista_isento' && Number(curso.valor) > 0) {
        await addDoc(collection(db, 'financeiro'), {
          tipo: 'receita',
          alunoId: pessoa.id,
          cursoId: curso.id,
          valor: Number(curso.valor),
          dataVencimento: hoje,
          dataPagamento: statusFinAdd === 'pago_balcao' ? hoje : '',
          status: statusFinAdd === 'pago_balcao' ? 'pago' : 'pendente',
          metodo: statusFinAdd === 'pago_balcao' ? 'Recepção / Balcão' : 'A Receber',
          observacao: `Inclusão na Turma (${curso.titulo}) - ${pessoa.nome}`,
          criadoEm: new Date().toISOString(),
        });
      }

      setUsuarioAddId('');
      await carregarDadosTurma();
      recarregarGeral();
    } catch (err) {
      alert('Erro ao adicionar: ' + err.message);
    }
  };

  const handleConfirmarPagamentoInscrito = async (lancamento) => {
    if (!lancamento) return;
    try {
      await updateDoc(doc(db, 'financeiro', lancamento.id), {
        status: 'pago',
        dataPagamento: new Date().toISOString().split('T')[0],
        metodo: 'Confirmado pela Coordenação',
      });
      await carregarDadosTurma();
      recarregarGeral();
    } catch (err) {
      alert('Erro ao baixar pagamento: ' + err.message);
    }
  };

  const handleSalvarEmentaEProf = async (e) => {
    e.preventDefault();
    setSalvandoEmenta(true);
    const profObj = profs.find((p) => p.id === profId);
    try {
      await updateDoc(doc(db, 'cursos', curso.id), {
        ementa,
        profId,
        professoresNomes: profObj ? profObj.nome : 'Equipe No Compasso',
      });
      alert('Ementa e professor atualizados com sucesso!');
      recarregarGeral();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSalvandoEmenta(false);
    }
  };

  const handleCriarPlano = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'planos_aula'), {
        cursoId: curso.id,
        profId: curso.profId || '',
        tipo: tipoPlano,
        titulo: tituloPlano,
        conteudo: conteudoPlano,
        dataCriacao: new Date().toISOString().split('T')[0],
      });
      setTituloPlano('');
      setConteudoPlano('');
      carregarDadosTurma();
    } catch (err) {
      alert('Erro ao salvar plano: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Curso Aberto */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500 hover:text-[#4A041C] mb-4"
        >
          <ArrowLeft size={15} /> Voltar para lista de cursos
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded bg-[#4A041C] text-white text-[10px] font-bold uppercase tracking-wider">
                {curso.frente || 'Dança de Salão'}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-[#D81B60] text-white text-[10px] font-bold uppercase tracking-wider">
                {curso.tipoLabel || curso.tipo}
              </span>
              <span className="text-xs font-semibold text-zinc-500">• {curso.estilo}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold uppercase font-condensed text-zinc-900">
              {curso.titulo}
            </h2>
            <p className="text-xs text-zinc-600 mt-1">
              Prof(s): <strong>{curso.professoresNomes}</strong> • {curso.dataInfo} ({curso.horaInicio || '19:00'} às {curso.horarioFim || '21:00'}) • Valor: <strong>R$ {Number(curso.valor).toFixed(2).replace('.', ',')}</strong>
            </p>
          </div>

          {/* Mini Resumo Financeiro da Turma */}
          <div className="flex gap-3">
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
              <span className="block text-[10px] font-bold uppercase text-emerald-700">Total Pago na Turma</span>
              <span className="text-xl font-bold font-condensed text-emerald-800">
                R$ {resumoTurma.pago.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl">
              <span className="block text-[10px] font-bold uppercase text-amber-700">Total a Pagar</span>
              <span className="text-xl font-bold font-condensed text-amber-800">
                R$ {resumoTurma.aPagar.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-abas internas do Curso */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-zinc-100 overflow-x-auto">
          <button
            onClick={() => setSubAba('inscritos')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase ${
              subAba === 'inscritos' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Users size={15} /> Inscritos & Pagamentos ({matriculas.length})
          </button>
          <button
            onClick={() => setSubAba('ementa')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase ${
              subAba === 'ementa' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <BookOpen size={15} /> Ementa & Professores
          </button>
          <button
            onClick={() => setSubAba('planos')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase ${
              subAba === 'planos' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <FileText size={15} /> Planos de Aula ({planos.length})
          </button>
        </div>
      </div>

      {/* CONTEÚDO SUB-ABA 1: INSCRITOS E SITUAÇÃO FINANCEIRA */}
      {subAba === 'inscritos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
            <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] mb-3 flex items-center gap-2">
              <UserPlus size={18} /> Incluir Participante
            </h3>

            <form onSubmit={handleAdicionarParticipante} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Aluno ou Bolsista</label>
                <select
                  required
                  value={usuarioAddId}
                  onChange={(e) => setUsuarioAddId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                >
                  <option value="">Selecione na base...</option>
                  {alunosEBolsistas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Situação Financeira</label>
                <select
                  value={statusFinAdd}
                  onChange={(e) => setStatusFinAdd(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
                >
                  <option value="bolsista_isento">Bolsista / Isento (R$ 0,00)</option>
                  <option value="pago_balcao">Pago Integralmente (R$ {curso.valor})</option>
                  <option value="pendente">A Pagar / Pendente (R$ {curso.valor})</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#4A041C] py-2.5 text-xs font-bold uppercase text-white hover:bg-[#2D0210]"
              >
                Adicionar à Turma
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="text-base font-bold uppercase font-condensed text-zinc-900 mb-4">
              Lista de Inscritos na Turma
            </h3>

            {carregando ? (
              <p className="text-sm text-zinc-500">Carregando lista...</p>
            ) : inscritosComFinanceiro.length === 0 ? (
              <p className="text-sm text-zinc-400 py-8 text-center">Nenhum aluno ou bolsista inscrito ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                      <th className="py-2.5 px-2">Participante</th>
                      <th className="py-2.5 px-2">Categoria</th>
                      <th className="py-2.5 px-2">Situação Financeira</th>
                      <th className="py-2.5 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {inscritosComFinanceiro.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50">
                        <td className="py-3 px-2 font-semibold text-zinc-900">
                          {item.alunoNome}
                          {item.codigoComprovante && (
                            <span className="block text-[10px] font-mono text-zinc-400">
                              QR: {item.codigoComprovante}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.roleParticipante === 'bolsista' ? 'bg-cyan-100 text-cyan-800' : 'bg-zinc-100 text-zinc-700'
                          }`}>
                            {item.roleParticipante || 'aluno'}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {item.roleParticipante === 'bolsista' && item.totalPago === 0 && item.totalAPagar === 0 ? (
                            <span className="text-xs font-semibold text-cyan-700">Bolsa Integral</span>
                          ) : item.totalAPagar > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                              <Clock size={13} /> A Pagar: R$ {item.totalAPagar.toFixed(2).replace('.', ',')}
                            </span>
                          ) : item.totalPago > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                              <CheckCircle2 size={13} /> Pago: R$ {item.totalPago.toFixed(2).replace('.', ',')}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">Sem cobrança</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right space-x-2">
                          {item.lancamentoPendente && (
                            <button
                              onClick={() => handleConfirmarPagamentoInscrito(item.lancamentoPendente)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                              Baixar Pagto
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (window.confirm('Remover participante da turma?')) {
                                await deleteDoc(doc(db, 'matriculas', item.id));
                                carregarDadosTurma();
                              }
                            }}
                            className="text-zinc-400 hover:text-red-600 p-1"
                            title="Remover da turma"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO SUB-ABA 2: EMENTA E PROFESSORES */}
      {subAba === 'ementa' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm max-w-3xl">
          <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C] mb-4">
            Ementa Programática & Professores Responsáveis
          </h3>

          <form onSubmit={handleSalvarEmentaEProf} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Professor Responsável pela Turma</label>
              <select
                value={profId}
                onChange={(e) => setProfId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm text-zinc-900"
              >
                <option value="">Equipe No Compasso</option>
                {profs.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                Ementa do Curso (Objetivos, Conteúdo Técnico, Pré-requisitos)
              </label>
              <textarea
                rows="6"
                value={ementa}
                onChange={(e) => setEmenta(e.target.value)}
                placeholder="Descreva os fundamentos, passos, musicalidade e objetivos deste curso..."
                className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-900"
              />
            </div>

            <button
              type="submit"
              disabled={salvandoEmenta}
              className="flex items-center gap-2 rounded-xl bg-[#4A041C] px-5 py-2.5 text-xs font-bold uppercase text-white hover:bg-[#2D0210]"
            >
              <Save size={15} /> {salvandoEmenta ? 'Salvando...' : 'Salvar Ementa & Professor'}
            </button>
          </form>
        </div>
      )}

      {/* CONTEÚDO SUB-ABA 3: PLANOS DE AULA */}
      {subAba === 'planos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm h-fit">
            <h3 className="text-base font-bold uppercase font-condensed text-[#4A041C] mb-3 flex items-center gap-1.5">
              <Plus size={18} /> Registrar Plano
            </h3>
            <form onSubmit={handleCriarPlano} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Tipo</label>
                <select
                  value={tipoPlano}
                  onChange={(e) => setTipoPlano(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                >
                  <option value="curso">Plano Geral do Curso</option>
                  <option value="turma">Plano de Aula / Cronograma</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Título / Aula</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aula 01 - Base e Condução"
                  value={tituloPlano}
                  onChange={(e) => setTituloPlano(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Conteúdo Detalhado</label>
                <textarea
                  rows="5"
                  required
                  value={conteudoPlano}
                  onChange={(e) => setConteudoPlano(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#D81B60] py-2.5 text-xs font-bold uppercase text-white hover:bg-[#AD1457]"
              >
                Salvar Plano
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-3">
            {planos.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center text-sm text-zinc-400">
                Nenhum plano de curso ou aula cadastrado para esta turma ainda.
              </div>
            ) : (
              planos.map((pl) => (
                <div key={pl.id} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded bg-pink-50 text-[#D81B60] text-[10px] font-bold uppercase">
                      {pl.tipo === 'curso' ? 'Plano de Curso' : 'Plano de Turma'}
                    </span>
                    <span className="text-xs text-zinc-400">{pl.dataCriacao}</span>
                  </div>
                  <h4 className="font-bold text-zinc-900">{pl.titulo}</h4>
                  <p className="text-sm text-zinc-600 mt-2 whitespace-pre-line">{pl.conteudo}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
