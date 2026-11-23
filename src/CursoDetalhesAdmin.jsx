import { useState, useEffect, useRef } from 'react';
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where
} from 'firebase/firestore';
import {
  ArrowLeft, Users, FileText, BookOpen, Mail,
  CheckCircle2, Clock, Trash2, UserPlus, Save, Plus,
  Bold, Italic, Underline, Link2, Paperclip, Smile, Send, Eye, X, Image as ImageIcon
} from 'lucide-react';
import { db } from './firebase';

const EMOJIS_RAPIDOS = [
  '💃', '🕺', '🎶', '✨', '🔥', '❤️', '👏', '📅',
  '⏰', '📍', '🩰', '🎉', '⚠️', '✅', '📌', '🌟'
];

export default function CursoDetalhesAdmin({ curso, usuarios, financeiro, onVoltar, recarregarGeral }) {
  const [subAba, setSubAba] = useState('inscritos');
  const [matriculas, setMatriculas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [usuarioAddId, setUsuarioAddId] = useState('');
  const [statusFinAdd, setStatusFinAdd] = useState('bolsista_isento');

  const [ementa, setEmenta] = useState(curso.ementa || '');
  const [profId, setProfId] = useState(curso.profId || '');
  const [salvandoEmenta, setSalvandoEmenta] = useState(false);

  const [tipoPlano, setTipoPlano] = useState('turma');
  const [tituloPlano, setTituloPlano] = useState('');
  const [conteudoPlano, setConteudoPlano] = useState('');

  const [assuntoEmail, setAssuntoEmail] = useState(`✨ Comunicado Oficial: ${curso.titulo} — No Compasso Studio`);
  const [htmlCorpoEmail, setHtmlCorpoEmail] = useState(
    `<p>Tudo bem? Passando para compartilhar informações importantes sobre a nossa turma de <strong>${curso.titulo}</strong>.</p><p><br></p><p>📅 <strong>Dias:</strong> ${curso.dataInfo}<br>⏰ <strong>Horário:</strong> ${curso.horaInicio || '19:00'} às ${curso.horarioFim || '21:00'}</p><p><br></p><p>Qualquer dúvida, estamos à disposição! Nos vemos na pista! 💃🕺</p>`
  );
  const [anexosEmail, setAnexosEmail] = useState([]);
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
      setDestinatariosSelecionados(listaMat.map((m) => m.id));
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

  const inscritosCompletos = matriculas.map((mat) => {
    const dadosUser =
      usuarios.find((u) => u.id === mat.alunoId) ||
      usuarios.find((u) => (u.nome || '').toLowerCase() === (mat.alunoNome || '').toLowerCase()) ||
      {};

    const emailFinal = (dadosUser.email || mat.email || '').trim();

    const lancamentosAluno = financeiro.filter(
      (f) => f.cursoId === curso.id && f.alunoId === mat.alunoId && f.tipo === 'receita' && f.status !== 'estornado'
    );
    const totalPago = lancamentosAluno
      .filter((l) => l.status === 'pago')
      .reduce((acc, l) => acc + Number(l.valor || 0), 0);
    const pendentes = lancamentosAluno.filter((l) => l.status === 'pendente');
    const totalAPagar = pendentes.reduce((acc, l) => acc + Number(l.valor || 0), 0);

    const saudacaoPersonalizada = dadosUser.isMenorDe15 && dadosUser.nomeResponsavel
      ? `${dadosUser.nomeResponsavel} (${dadosUser.tipoResponsavel || 'Responsável'} de ${mat.alunoNome})`
      : mat.alunoNome;

    return {
      ...mat,
      emailDestino: emailFinal,
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

  const handleInserirImagemNoCorpo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_W = 540;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

        if (editorRef.current) {
          editorRef.current.focus();
          const imgTag = `<div style="margin:14px 0;text-align:center;"><img src="${dataUrl}" alt="Imagem" style="max-width:100%;border-radius:12px;border:1px solid #e4e4e7;" /></div><p><br></p>`;
          document.execCommand('insertHTML', false, imgTag);
          setHtmlCorpoEmail(editorRef.current.innerHTML);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAnexarArquivo = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.size > 4 * 1024 * 1024) {
        alert(`O arquivo "${file.name}" excede 4MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64Puro = ev.target.result.split(',')[1];
        setAnexosEmail((prev) => [
          ...prev,
          {
            nome: file.name,
            tamanho: (file.size / 1024).toFixed(0) + ' KB',
            base64: base64Puro,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const gerarTemplateHtmlCompleto = (saudacao) => {
    const logoUrlPublica = `${window.location.origin}/logo-studio.png`;

    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e4e4e7;border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 8px 24px rgba(74,4,28,0.08);">
        <div style="height:5px;background:linear-gradient(90deg,#C5A059,#E5C17B,#C5A059);"></div>

        <div style="background:linear-gradient(135deg,#2D0210 0%,#4A041C 60%,#880E4F 100%);padding:26px 30px;color:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="64" valign="middle">
                <div style="width:54px;height:54px;border-radius:50%;background:#ffffff;padding:5px;text-align:center;box-shadow:0 4px 10px rgba(0,0,0,0.25);">
                  <img src="${logoUrlPublica}" alt="No Compasso" style="width:44px;height:44px;object-fit:contain;display:block;margin:0 auto;" />
                </div>
              </td>
              <td style="padding-left:14px;" valign="middle">
                <p style="margin:0;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#E5C17B;font-weight:bold;">
                  NO COMPASSO STUDIO DE DANÇA
                </p>
                <h2 style="margin:4px 0 0;font-size:21px;letter-spacing:0.5px;text-transform:uppercase;color:#ffffff;">
                  ${curso.titulo}
                </h2>
                <span style="display:inline-block;margin-top:6px;background:rgba(255,255,255,0.14);color:#FCE4EC;font-size:11px;padding:3px 10px;border-radius:99px;">
                  🎶 ${curso.frente || 'Dança de Salão'} • ${curso.estilo}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding:30px 30px 24px;color:#27272a;font-size:15px;line-height:1.65;">
          <div style="background:#FDF2F6;border-left:4px solid #D81B60;padding:12px 16px;border-radius:0 12px 12px 0;margin-bottom:20px;">
            <p style="margin:0;font-size:16px;color:#4A041C;">
              Olá, <strong>${saudacao}</strong>! ✨
            </p>
          </div>

          <div style="color:#27272a;">
            ${htmlCorpoEmail}
          </div>

          <div style="margin-top:24px;padding:14px 18px;background:#FAFAFA;border:1px solid #E4E4E7;border-radius:14px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.2px;color:#880E4F;">
              💃 Detalhes da Turma
            </p>
            <p style="margin:0;font-size:13px;color:#52525B;">
              <strong>Prof(s):</strong> ${curso.professoresNomes} &nbsp;|&nbsp;
              <strong>Dias:</strong> ${curso.dataInfo} (${curso.horaInicio || '19:00'} às ${curso.horarioFim || '21:00'})
            </p>
          </div>
        </div>

        <div style="background:#18181F;padding:20px 28px;text-align:center;color:#A1A1AA;font-size:12px;">
          <p style="margin:0;color:#E5C17B;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;font-size:11px;">
            No Compasso Studio de Dança
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:#D4D4D8;">
            Estrada das Placas, 1909 • Rio Branco - Acre
          </p>
          <p style="margin:8px 0 0;font-style:italic;color:#F48FB1;font-size:11px;">
            "Dança é encontro, movimento e conexão." 🕺💃
          </p>
        </div>
      </div>
    `;
  };

  const handleDispararEmailsBrevo = async () => {
    const selecionados = inscritosCompletos.filter((i) =>
      destinatariosSelecionados.includes(i.id)
    );

    if (selecionados.length === 0) {
      alert('Marque pelo menos um aluno na caixa de destinatários acima.');
      return;
    }

    const alvosComEmail = selecionados.filter((i) => i.emailDestino);

    if (alvosComEmail.length === 0) {
      alert(
        `Os participantes marcados (${selecionados.map((s) => s.alunoNome).join(', ')}) não possuem e-mail preenchido no cadastro.`
      );
      return;
    }

    const brevoApiKey = import.meta.env.VITE_BREVO_API_KEY;
    const brevoSenderEmail = import.meta.env.VITE_BREVO_SENDER_EMAIL;

    if (!brevoApiKey || !brevoSenderEmail) {
      alert('As variáveis VITE_BREVO_API_KEY e VITE_BREVO_SENDER_EMAIL não foram carregadas. Faça um Redeploy na Vercel.');
      return;
    }

    setEnviandoEmails(true);
    let enviados = 0;

    try {
      for (const aluno of alvosComEmail) {
        setProgressoEnvio(`Enviando ${enviados + 1} de ${alvosComEmail.length} (${aluno.saudacaoPersonalizada})...`);
        const htmlFinal = gerarTemplateHtmlCompleto(aluno.saudacaoPersonalizada);

        const payloadBrevo = {
          sender: {
            name: 'No Compasso Studio de Dança',
            email: brevoSenderEmail,
          },
          to: [
            {
              email: aluno.emailDestino,
              name: aluno.saudacaoPersonalizada,
            },
          ],
          subject: assuntoEmail,
          htmlContent: htmlFinal,
        };

        if (anexosEmail.length > 0) {
          payloadBrevo.attachment = anexosEmail.map((a) => ({
            name: a.nome,
            content: a.base64,
          }));
        }

        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payloadBrevo),
        });

        if (!resp.ok) {
          const erroDetalhe = await resp.json();
          throw new Error(erroDetalhe.message || 'Falha ao enviar pelo Brevo');
        }

        enviados++;
      }

      // Grava histórico no Firestore sem interromper o fluxo se a regra ainda não estiver ativa
      try {
        await addDoc(collection(db, 'comunicados_email'), {
          cursoId: curso.id,
          cursoTitulo: curso.titulo,
          assunto: assuntoEmail,
          totalDestinatarios: enviados,
          dataEnvio: new Date().toISOString(),
        });
      } catch (logErr) {
        console.warn('E-mails enviados, mas histórico não gravado no Firestore:', logErr);
      }

      alert(`Sucesso! ${enviados} e-mail(s) personalizados foram enviados com sucesso!`);
    } catch (err) {
      alert('Erro no envio via Brevo: ' + err.message);
    } finally {
      setEnviandoEmails(false);
      setProgressoEnvio('');
    }
  };

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
        email: pessoa.email || '',
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

      {subAba === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold uppercase font-condensed text-[#4A041C] flex items-center gap-2">
                <Mail size={20} className="text-[#D81B60]" /> Redigir Comunicado para a Turma
              </h3>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                Envio Direto via Brevo
              </span>
            </div>

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
                        : inscritosCompletos.map((i) => i.id)
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
                    const marcado = destinatariosSelecionados.includes(insc.id);
                    return (
                      <button
                        type="button"
                        key={insc.id}
                        onClick={() =>
                          setDestinatariosSelecionados((prev) =>
                            prev.includes(insc.id)
                              ? prev.filter((id) => id !== insc.id)
                              : [...prev, insc.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          marcado
                            ? 'bg-[#4A041C] text-white border-[#4A041C]'
                            : 'bg-white text-zinc-600 border-zinc-300'
                        }`}
                      >
                        {insc.saudacaoPersonalizada} {insc.emailDestino ? '' : '(sem e-mail)'}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">Assunto do E-mail</label>
              <input
                type="text"
                value={assuntoEmail}
                onChange={(e) => setAssuntoEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-900"
              />
            </div>

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
                >
                  <Link2 size={14} className="text-[#D81B60]" /> Link
                </button>

                <label className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-200 text-xs font-bold text-zinc-700 cursor-pointer">
                  <ImageIcon size={14} className="text-emerald-700" /> Imagem no Corpo
                  <input type="file" accept="image/*" className="hidden" onChange={handleInserirImagemNoCorpo} />
                </label>

                <label className="flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-200 text-xs font-bold text-zinc-700 cursor-pointer">
                  <Paperclip size={14} className="text-[#4A041C]" /> Anexo
                  <input type="file" multiple className="hidden" onChange={handleAnexarArquivo} />
                </label>

                <span className="h-4 w-[1px] bg-zinc-300 mx-1" />

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

              <div className="px-4 pt-3 pb-1 bg-pink-50/40 text-sm text-zinc-700 border-b border-dashed border-zinc-200">
                Olá, <strong className="text-[#4A041C]">(Nome do Aluno ou Responsável)</strong>! ✨
              </div>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setHtmlCorpoEmail(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: htmlCorpoEmail }}
                className="min-h-[200px] p-4 text-sm text-zinc-900 focus:outline-none leading-relaxed"
              />
            </div>

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
              onClick={handleDispararEmailsBrevo}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4A041C] to-[#D81B60] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:brightness-110 transition"
            >
              <Send size={16} />
              {enviandoEmails
                ? progressoEnvio
                : `Disparar E-mails Personalizados (${destinatariosSelecionados.length} destinatários)`}
            </button>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-zinc-500">
              <Eye size={15} className="text-[#D81B60]" /> Pré-Visualização com Logo Oficial
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              dangerouslySetInnerHTML={{ __html: gerarTemplateHtmlCompleto(primeiroInscritoPreview) }}
            />
          </div>
        </div>
      )}

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
                          <span className="block text-[11px] font-normal text-zinc-500">
                            {item.emailDestino || 'Sem e-mail cadastrado'}
                          </span>
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
