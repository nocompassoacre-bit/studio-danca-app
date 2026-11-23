import { useState, useEffect, useRef } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where
} from 'firebase/firestore';
import {
  ArrowLeft, Users, FileText, BookOpen, Mail,
  CheckCircle2, Clock, Trash2, UserPlus, Save, Plus,
  Bold, Italic, Underline, Link2, Paperclip, Smile, Send, Eye, X
} from 'lucide-react';
import { db } from './firebase';

// ============================================================================
// CONFIGURAÇÃO DO EMAILJS (Opcional para disparo 100% automático em lote)
// Crie conta grátis em https://www.emailjs.com e preencha os 3 códigos abaixo:
// ============================================================================
const EMAILJS_SERVICE_ID = '';   // Ex: 'service_nocompasso'
const EMAILJS_TEMPLATE_ID = '';  // Ex: 'template_comunicado'
const EMAILJS_PUBLIC_KEY = '';   // Ex: 'user_xxxxxxxxxxxx'

const EMOJIS_RAPIDOS = [
  '💃', '🕺', '🎶', '✨', '🔥', '❤️', '👏', '📅',
  '⏰', '📍', '🩰', '🎉', '⚠️', '✅', '📌', '🌟'
];

export default function CursoDetalhesAdmin({ curso, usuarios, financeiro, onVoltar, recarregarGeral }) {
  const [subAba, setSubAba] = useState('inscritos'); // 'inscritos' | 'ementa' | 'planos' | 'email'
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

  // Estados do Editor de E-mail em Massa
  const [assuntoEmail, setAssuntoEmail] = useState(`Informações Importantes: ${curso.titulo} — No Compasso Studio`);
  const [htmlCorpoEmail, setHtmlCorpoEmail] = useState(
    `<p>Tudo bem? Passando para compartilhar informações importantes sobre a nossa turma de <strong>${curso.titulo}</strong>.</p><p><br></p><p>📅 <strong>Dias:</strong> ${curso.dataInfo}<br>⏰ <strong>Horário:</strong> ${curso.horaInicio || '19:00'} às ${curso.horarioFim || '21:00'}</p><p><br></p><p>Qualquer dúvida, estamos à disposição! Nos vemos na pista! 💃🕺</p>`
  );
  const [anexosEmail, setAnexosEmail] = useState([]); // { nome, tamanho, dataUrl }
  const [destinatariosSelecionados, setDestinatariosSelecionados] = useState([]);
  const [enviandoEmails, setEnviandoEmails] = useState(false);
  const [progressoEnvio, setProgressoEnvio] = useState('');
  const editorRef = useRef(null);

  const profs = usuarios.filter((u) =>
    Array.isArray(u.roles) ? u.roles.includes('prof') : u.role === 'prof'
  );
  const alunosEBolsistas = usuarios.filter((u) => {
    const papeis = Array.isArray(u.roles) ? u.roles : [u.role];
    return papeis.includes('aluno') || papeis.includes('bolsista');
  });

  const carregarDadosTurma = async () => {
    setCarregando(true);
    try {
      const [matSnap, planSnap] = await Promise.all([
        getDocs(query(collection(db, 'matriculas'), where('cursoId', '==', curso.id))),
        getDocs(query(collection(db, 'planos_aula'), where('cursoId', '==', curso.id))),
      ]);
      const listaMat = matSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMatriculas(listaMat);
      setDestinatariosSelecionados(listaMat.map((m) => m.alunoId));
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

  // Cruza cada inscrito com os lançamentos financeiros e dados cadastrais (e-mail e responsável)
  const inscritosCompletos = matriculas.map((mat) => {
    const dadosUser = usuarios.find((u) => u.id === mat.alunoId) || {};
    const lancamentosAluno = financeiro.filter(
      (f) => f.cursoId === curso.id && f.alunoId === mat.alunoId && f.tipo === 'receita' && f.status !== 'estornado'
    );
    const totalPago = lancamentosAluno
      .filter((l) => l.status === 'pago')
      .reduce((acc, l) => acc + Number(l.valor || 0), 0);
    const pendentes = lancamentosAluno.filter((l) => l.status === 'pendente');
    const totalAPagar = pendentes.reduce((acc, l) => acc + Number(l.valor || 0), 0);

    // Define saudação inteligente: se menor de 15 anos, saúda o responsável + nome do aluno
    const saudacaoPersonalizada = dadosUser.isMenorDe15 && dadosUser.nomeResponsavel
      ? `${dadosUser.nomeResponsavel} (${dadosUser.tipoResponsavel || 'Responsável'} de ${mat.alunoNome})`
      : mat.alunoNome;

    return {
      ...mat,
      emailDestino: dadosUser.email || '',
      emailSecundario: dadosUser.emailSecundarioAluno || '',
      saudacaoPersonalizada,
      totalPago,
      totalAPagar,
      lancamentoPendente: pendentes[0] || null,
    };
  });

  const resumoTurma = inscritosCompletos.reduce(
    (acc, item) => ({
      pago: acc.pago + item.totalPago,
      aPagar: acc.aPagar + item.totalAPagar,
    }),
    { pago: 0, aPagar: 0 }
  );

  // =========================================================================
  // FUNÇÕES DO EDITOR DE E-MAIL RICO
  // =========================================================================
  const aplicarComandoEditor = (comando, valor = null) => {
    document.execCommand(comando, false, valor);
    if (editorRef.current) {
      setHtmlCorpoEmail(editorRef.current.innerHTML);
    }
  };

  const inserirLinkNoEditor = () => {
    const url = window.prompt('Cole o link (URL) que deseja inserir:', 'https://');
    if (url && url !== 'https://') {
      aplicarComandoEditor('createLink', url);
    }
  };

  const inserirEmojiNoEditor = (emoji) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, emoji);
      setHtmlCorpoEmail(editorRef.current.innerHTML);
    }
  };

  const handleAnexarArquivo = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.size > 3 * 1024 * 1024) {
        alert(`O arquivo "${file.name}" excede 3MB. Prefira arquivos menores ou links do Google Drive.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAnexosEmail((prev) => [
          ...prev,
          {
            nome: file.name,
            tamanho: (file.size / 1024).toFixed(0) + ' KB',
            dataUrl: ev.target.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const gerarTemplateHtmlCompleto = (saudacao) => {
    const listaAnexosHtml = anexosEmail.length > 0
      ? `<div style="margin-top:20px;padding:12px;background:#f8f8fa;border-radius:10px;border:1px solid #e4e4e7;">
           <strong style="font-size:12px;color:#4A041C;">📎 Anexos incluídos (${anexosEmail.length}):</strong>
           <ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:#52525b;">
             ${anexosEmail.map((a) => `<li>${a.nome} (${a.tamanho})</li>`).join('')}
           </ul>
         </div>`
      : '';

    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;background:#ffffff;">
        <div style="background:linear-gradient(90deg,#4A041C,#D81B60);padding:22px 28px;color:#ffffff;">
          <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#E5C17B;font-weight:bold;">
            No Compasso Studio de Dança
          </p>
          <h2 style="margin:6px 0 0;font-size:20px;text-transform:uppercase;">${curso.titulo}</h2>
        </div>
        <div style="padding:28px;color:#27272a;font-size:15px;line-height:1.6;">
          <p style="font-size:16px;margin-top:0;">Olá, <strong>${saudacao}</strong>!</p>
          <div>${htmlCorpoEmail}</div>
          ${listaAnexosHtml}
        </div>
        <div style="background:#f4f4f6;padding:16px 28px;text-align:center;font-size:12px;color:#71717a;border-top:1px solid #e4e4e7;">
          No Compasso Studio de Dança • Rio Branco - Acre<br/>
          <em>Dança é encontro, movimento e conexão.</em>
        </div>
      </div>
    `;
  };

  const handleDispararEmailsEmMassa = async () => {
    const alvos = inscritosCompletos.filter(
      (i) => destinatariosSelecionados.includes(i.alunoId) && i.emailDestino
    );

    if (alvos.length === 0) {
      alert('Selecione ao menos um participante com e-mail cadastrado.');
      return;
    }

    // Se EmailJS estiver configurado, dispara automaticamente para todos via API
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
      setEnviandoEmails(true);
      let enviados = 0;
      try {
        for (const aluno of alvos) {
          setProgressoEnvio(`Enviando ${enviados + 1} de ${alvos.length} (${aluno.saudacaoPersonalizada})...`);
          const htmlFinal = gerarTemplateHtmlCompleto(aluno.saudacaoPersonalizada);

          await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: EMAILJS_SERVICE_ID,
              template_id: EMAILJS_TEMPLATE_ID,
              user_id: EMAILJS_PUBLIC_KEY,
              template_params: {
                to_email: aluno.emailDestino,
                to_name: aluno.saudacaoPersonalizada,
                subject: assuntoEmail,
                message_html: htmlFinal,
              },
            }),
          });
          enviados++;
        }

        // Registra histórico do comunicado no Firebase
        await addDoc(collection(db, 'comunicados_email'), {
          cursoId: curso.id,
          cursoTitulo: curso.titulo,
          assunto: assuntoEmail,
          corpoHtml: htmlCorpoEmail,
          totalDestinatarios: enviados,
          dataEnvio: new Date().toISOString(),
        });

        alert(`Sucesso! ${enviados} e-mail(s) personalizados foram enviados.`);
      } catch (err) {
        alert('Erro durante o disparo: ' + err.message);
      } finally {
        setEnviandoEmails(false);
        setProgressoEnvio('');
      }
    } else {
      // Modo Fallback (Abre o cliente de e-mail padrão com Cópia Oculta BCC para todos os selecionados)
      const listaEmails = alvos.map((a) => a.emailDestino).join(',');
      const textoLimpo = editorRef.current ? editorRef.current.innerText : '';
      const corpoMailto = `Olá, aluno(a) / responsável!\n\n${textoLimpo}\n\n—\nNo Compasso Studio de Dança`;
      window.open(
        `mailto:?bcc=${encodeURIComponent(listaEmails)}&subject=${encodeURIComponent(assuntoEmail)}&body=${encodeURIComponent(corpoMailto)}`,
        '_blank'
      );
    }
  };

  // =========================================================================
  // FUNÇÕES DE PARTICIPANTES, EMENTA E PLANOS
  // =========================================================================
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
    const papeis = Array.isArray(pessoa.roles) ? pessoa.roles : [pessoa.role];
    const papelNaTurma = papeis.includes('bolsista') ? 'bolsista' : 'aluno';

    try {
      await addDoc(collection(db, 'matriculas'), {
        alunoId: pessoa.id,
        alunoNome: pessoa.nome,
        roleParticipante: papelNaTurma,
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

  const primeiroInscritoPreview = inscritosCompletos[0]?.saudacaoPersonalizada || 'Nome do Aluno ou Responsável';

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
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
              subAba === 'inscritos' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Users size={15} /> Inscritos & Pagamentos ({matriculas.length})
          </button>
          <button
            onClick={() => setSubAba('email')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
              subAba === 'email' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Mail size={15} /> Enviar E-mail Geral
          </button>
          <button
            onClick={() => setSubAba('ementa')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
              subAba === 'ementa' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <BookOpen size={15} /> Ementa & Professores
          </button>
          <button
            onClick={() => setSubAba('planos')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap ${
              subAba === 'planos' ? 'bg-[#D81B60] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <FileText size={15} /> Planos de Aula ({planos.length})
          </button>
        </div>
      </div>

      {/* =====================================================================
          SUB-ABA: ENVIAR E-MAIL GERAL PERSONALIZADO (EDITOR RICO + PREVIEW)
         ===================================================================== */}
      {subAba === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Editor Rico */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <Mail size={20} className="text-[#D81B60]" /> Redigir Comunicado para a Turma
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                Saudação automática ativa
              </span>
            </div>

            {/* Seleção de Destinatários */}
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-zinc-600">
                  Destinatários ({destinatariosSelecionados.length} de {inscritosCompletos.length} selecionados)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDestinatariosSelecionados(
                      destinatariosSelecionados.length === inscritosCompletos.length
                        ? []
                        : inscritosCompletos.map((i) => i.alunoId)
                    )
                  }
                  className="text-[11px] font-bold text-[#D81B60] hover:underline"
                >
                  {destinatariosSelecionados.length === inscritosCompletos.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              {inscritosCompletos.length === 0 ? (
                <p className="text-xs text-zinc-400">Nenhum aluno inscrito nesta turma ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {inscritosCompletos.map((insc) => {
                    const marcado = destinatariosSelecionados.includes(insc.alunoId);
                    return (
                      <button
                        type="button"
                        key={insc.id}
                        onClick={() =>
                          setDestinatariosSelecionados((prev) =>
                            prev.includes(insc.alunoId)
                              ? prev.filter((id) => id !== insc.alunoId)
                              : [...prev, insc.alunoId]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          marcado
                            ? 'bg-[#4A041C] text-white border-[#4A041C]'
                            : 'bg-white text-zinc-600 border-zinc-300'
                        }`}
                      >
                        {insc.saudacaoPersonalizada}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assunto */}
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Assunto do E-mail</label>
              <input
                type="text"
                value={assuntoEmail}
                onChange={(e) => setAssuntoEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900"
              />
            </div>

            {/* Barra de Ferramentas do Editor */}
            <div className="border border-zinc-300 rounded-2xl overflow-hidden">
              <div className="bg-zinc-100 px-3 py-2 border-b border-zinc-300 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => aplicarComandoEditor('bold')}
                  className="p-1.5 rounded hover:bg-zinc-200 text-zinc-700"
                  title="Negrito"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => aplicarComandoEditor('italic')}
                  className="p-1.5 rounded hover:bg-zinc-200 text-zinc-700"
                  title="Itálico"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => aplicarComandoEditor('underline')}
                  className="p-1.5 rounded hover:bg-zinc-200 text-zinc-700"
                  title="Sublinhado"
                >
                  <Underline size={15} />
                </button>

                <span className="h-4 w-[1px] bg-zinc-300 mx-1" />

                <button
                  type="button"
                  onClick={inserirLinkNoEditor}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-200 text-xs font-bold text-zinc-700"
                  title="Inserir Link"
                >
                  <Link2 size={14} className="text-[#D81B60]" /> Link
                </button>

                <label className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-200 text-xs font-bold text-zinc-700 cursor-pointer">
                  <Paperclip size={14} className="text-[#4A041C]" /> Anexo
                  <input type="file" multiple className="hidden" onChange={handleAnexarArquivo} />
                </label>

                <span className="h-4 w-[1px] bg-zinc-300 mx-1" />

                {/* Paleta rápida de Emojis */}
                <div className="flex items-center gap-1 flex-wrap">
                  <Smile size={14} className="text-amber-600 mr-0.5" />
                  {EMOJIS_RAPIDOS.map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => inserirEmojiNoEditor(em)}
                      className="hover:scale-125 transition text-sm px-0.5"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cabeçalho fixo automático dentro do editor */}
              <div className="px-4 pt-3 pb-1 bg-pink-50/40 text-sm text-zinc-700 border-b border-dashed border-zinc-200">
                Olá, <strong className="text-[#4A041C]">(Nome do Aluno ou Responsável)</strong>!
              </div>

              {/* Área Editável Rica */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setHtmlCorpoEmail(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: htmlCorpoEmail }}
                className="min-h-[190px] p-4 text-sm text-zinc-900 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Lista de Anexos adicionados */}
            {anexosEmail.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {anexosEmail.map((anexo, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-2 bg-zinc-100 border border-zinc-300 px-3 py-1 rounded-full text-xs font-semibold text-zinc-700"
                  >
                    <Paperclip size={12} className="text-[#D81B60]" />
                    {anexo.nome} ({anexo.tamanho})
                    <button
                      type="button"
                      onClick={() => setAnexosEmail((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-zinc-400 hover:text-red-600"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={enviandoEmails}
              onClick={handleDispararEmailsEmMassa}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4A041C] to-[#D81B60] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:brightness-110 transition"
            >
              <Send size={16} />
              {enviandoEmails
                ? progressoEnvio
                : `Enviar Comunicado Personalizado (${destinatariosSelecionados.length} destinatários)`}
            </button>
          </div>

          {/* Coluna Direita: Pré-Visualização exata de como chegará no e-mail do aluno */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500">
              <Eye size={15} className="text-[#D81B60]" /> Pré-Visualização do E-mail (Exemplo real)
            </div>

            <div
              className="rounded-2xl shadow-md overflow-hidden"
              dangerouslySetInnerHTML={{ __html: gerarTemplateHtmlCompleto(primeiroInscritoPreview) }}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-ABA: INSCRITOS E SITUAÇÃO FINANCEIRA
         ===================================================================== */}
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
                      {u.nome}
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
            ) : inscritosCompletos.length === 0 ? (
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
                    {inscritosCompletos.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50">
                        <td className="py-3 px-2 font-semibold text-zinc-900">
                          {item.alunoNome}
                          <span className="block text-[11px] font-normal text-zinc-500">{item.emailDestino}</span>
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

      {/* =====================================================================
          SUB-ABA: EMENTA E PROFESSORES
         ===================================================================== */}
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

      {/* =====================================================================
          SUB-ABA: PLANOS DE AULA
         ===================================================================== */}
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
