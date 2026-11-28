import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  addDoc,
  collection,
} from 'firebase/firestore';
import {
  FileText,
  User,
  Music,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Calendar,
  Clock,
  Instagram,
  Phone,
  ArrowRight,
  ArrowLeft,
  Printer,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { db } from './firebase';

const TEXTO_EDITAL_PADRAO = `O Studio de Dança No Compasso torna público o Edital nº 02/2026, que abre o processo seletivo para a concessão de bolsas de estudo integrais (100%) na modalidade de Dança de Salão. A bolsa terá duração de 6 meses, compreendendo o período de 11 de janeiro de 2027 a 11 de julho de 2027.

Objetivo da Bolsa e Atividades Obrigatórias
O programa de bolsistas tem como propósito integrar os selecionados em duas atividades fundamentais e indissociáveis do nosso Studio:
1. Auxílio nas turmas regulares de Dança de Salão.
2. Composição do elenco da Mostra de Dança do Studio.

Atenção: A participação em ambas as frentes é estritamente obrigatória. Não é possível optar por atuar apenas no auxílio às turmas ou apenas na apresentação. Além disso, os ensaios para a Mostra já terão início na semana imediatamente seguinte ao encontro presencial com os aprovados. A inscrição e a futura assinatura do termo implicam a concordância e o aceite total destas condições.

Pré-requisitos para Participação
Para validar sua inscrição e concorrer à bolsa, o candidato deve obrigatoriamente:
- Ter disponibilidade de horário: É indispensável ter o sábado livre (das 15h às 20h) e, no mínimo, um dia disponível de segunda a sexta-feira (das 18h às 21h);
- Atender à classificação etária: Ter a partir de 15 anos. Menores de 18 anos deverão apresentar a autorização dos pais ou responsáveis devidamente preenchida no ato da matrícula;
- Custear sua locomoção: Arcar com as próprias despesas de deslocamento para participar das aulas, ensaios e demais atividades extracurriculares viabilizadas pela bolsa;
- Inscrever-se no prazo: Preencher este formulário de inscrição corretamente dentro das datas previstas no edital.

Etapa de Avaliação Presencial
A concessão da bolsa estará condicionada à participação do candidato em uma avaliação interativa, que ocorrerá presencialmente no dia 09 de janeiro de 2027 (sábado), das 14h às 16h.

Declaração de Ciência
Ciente de todos os critérios estabelecidos no Edital nº 02/2026, solicitamos que preencha o formulário a seguir com a máxima atenção e veracidade. A constatação de incoerência entre os dados informados no formulário e a real disponibilidade ou padrão de participação acarretará a exclusão do candidato no processo seletivo e/ou a perda imediata da bolsa após a concessão.`;

const ESTILOS_DANCA = [
  'Forró',
  'Bolero',
  'Samba de Gafieira',
  'Zouk',
  'Bachata',
  'Salsa',
  'Rock Soltinho',
  'Tango',
  'Valsa',
  'Lambada',
];

const DIAS_UTEIS_OPCOES = [
  'Segunda-feira (18h às 21h)',
  'Terça-feira (18h às 21h)',
  'Quarta-feira (18h às 21h)',
  'Quinta-feira (18h às 21h)',
  'Sexta-feira (18h às 21h)',
];

function aplicarMascaraCpf(valor) {
  const nums = (valor || '').replace(/\D/g, '').slice(0, 11);
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function aplicarMascaraTelefone(valor) {
  const nums = (valor || '').replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 10) {
    return nums
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return nums
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function calcularIdade(dataNasc) {
  if (!dataNasc) return null;
  const hoje = new Date();
  const nasc = new Date(dataNasc + 'T00:00:00');
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade;
}

function processarFotoPerfil(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 480;
      const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

export default function InscricaoBolsaPublica() {
  const { editalId } = useParams();
  const navigate = useNavigate();

  const [statusEdital, setStatusEdital] = useState('carregando'); // carregando | aberto | encerrado | invalido
  const [edital, setEdital] = useState(null);
  const [etapa, setEtapa] = useState(1); // 1, 2, 3, 4, 5 (comprovante)

  // SEÇÃO 1: Termos de ciência do Edital
  const [aceiteLeituraEdital, setAceiteLeituraEdital] = useState(false);
  const [aceiteHorariosObrigatorios, setAceiteHorariosObrigatorios] = useState(false);
  const [aceiteFrentesDuplas, setAceiteFrentesDuplas] = useState(false);

  // SEÇÃO 2: Dados Pessoais & Foto
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [endereco, setEndereco] = useState('');
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState('');
  const [nomeResponsavelLegal, setNomeResponsavelLegal] = useState('');
  const [telefoneResponsavelLegal, setTelefoneResponsavelLegal] = useState('');

  // SEÇÃO 3: Dados de Dança & Disponibilidade
  const [conhecimentoPrevio, setConhecimentoPrevio] = useState('Iniciante (nunca fiz aulas)');
  const [experienciaSalao, setExperienciaSalao] = useState('');
  const [conheceStudio, setConheceStudio] = useState('Não, será meu primeiro contato');
  const [comoSoube, setComoSoube] = useState('Instagram (@nocompasso.acre)');
  const [disponibilidadeSabado, setDisponibilidadeSabado] = useState(true);
  const [diasUteisDisponiveis, setDiasUteisDisponiveis] = useState([]);
  const [estilosInteresse, setEstilosInteresse] = useState(['Forró']);
  const [motivacaoStudio, setMotivacaoStudio] = useState('');
  const [comoPodeColaborar, setComoPodeColaborar] = useState('');
  const [observacoesExtras, setObservacoesExtras] = useState('');

  // SEÇÃO 4: Confirmações & Senha para acesso caso aprovado
  const [autorizacaoUsoImagem, setAutorizacaoUsoImagem] = useState(false);
  const [cienciaDivergenciaEliminacao, setCienciaDivergenciaEliminacao] = useState(false);
  const [cienciaFaltaEliminacao, setCienciaFaltaEliminacao] = useState(false);
  const [senhaAcesso, setSenhaAcesso] = useState('');
  const [confirmarSenhaAcesso, setConfirmarSenhaAcesso] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erroEtapa, setErroEtapa] = useState('');
  const [protocoloGerado, setProtocoloGerado] = useState('');

  useEffect(() => {
    const carregarEdital = async () => {
      if (!editalId) {
        setStatusEdital('invalido');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'editais_bolsa', editalId));
        if (!snap.exists()) {
          setStatusEdital('invalido');
          return;
        }
        const dados = { id: snap.id, ...snap.data() };
        setEdital(dados);
        setStatusEdital(dados.status === 'encerrado' ? 'encerrado' : 'aberto');
      } catch (err) {
        console.error('Erro ao carregar edital:', err);
        setStatusEdital('invalido');
      }
    };
    carregarEdital();
  }, [editalId]);

  const idadeCalculada = calcularIdade(dataNascimento);
  const isMenorDe15 = idadeCalculada !== null && idadeCalculada < 15;
  const isMenorDe18 = idadeCalculada !== null && idadeCalculada >= 15 && idadeCalculada < 18;

  const toggleDiaUtil = (dia) => {
    setDiasUteisDisponiveis((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };

  const toggleEstilo = (estilo) => {
    setEstilosInteresse((prev) =>
      prev.includes(estilo) ? prev.filter((e) => e !== estilo) : [...prev, estilo]
    );
  };

  const avancarParaEtapa2 = () => {
    setErroEtapa('');
    if (!aceiteLeituraEdital || !aceiteHorariosObrigatorios || !aceiteFrentesDuplas) {
      setErroEtapa('Marque todas as declarações de ciência acima para prosseguir com a inscrição.');
      return;
    }
    setEtapa(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const avancarParaEtapa3 = (e) => {
    e.preventDefault();
    setErroEtapa('');

    if (isMenorDe15) {
      setErroEtapa('Conforme o edital, a idade mínima para participar da seleção é de 15 anos.');
      return;
    }
    if (!fotoPerfilUrl) {
      setErroEtapa('Por favor, anexe uma foto de perfil nítida para identificação na banca.');
      return;
    }
    if (isMenorDe18 && (!nomeResponsavelLegal.trim() || !telefoneResponsavelLegal.trim())) {
      setErroEtapa('Candidatos menores de 18 anos devem informar o nome e contato do responsável legal.');
      return;
    }

    setEtapa(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const avancarParaEtapa4 = (e) => {
    e.preventDefault();
    setErroEtapa('');

    if (!disponibilidadeSabado) {
      setErroEtapa('A disponibilidade aos sábados (15h às 20h) é pré-requisito obrigatório do edital.');
      return;
    }
    if (diasUteisDisponiveis.length === 0) {
      setErroEtapa('Selecione pelo menos 1 dia útil disponível (segunda a sexta, das 18h às 21h).');
      return;
    }
    if (estilosInteresse.length === 0) {
      setErroEtapa('Selecione pelo menos um estilo de dança que deseja aprender.');
      return;
    }

    setEtapa(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalizarInscricao = async (e) => {
    e.preventDefault();
    setErroEtapa('');

    if (!autorizacaoUsoImagem || !cienciaDivergenciaEliminacao || !cienciaFaltaEliminacao) {
      setErroEtapa('Confirme todos os termos obrigatórios antes de enviar sua inscrição.');
      return;
    }
    if (senhaAcesso.length < 6) {
      setErroEtapa('Crie uma senha com pelo menos 6 caracteres (ela será usada no portal caso você seja aprovado).');
      return;
    }
    if (senhaAcesso !== confirmarSenhaAcesso) {
      setErroEtapa('As senhas digitadas não coincidem.');
      return;
    }

    setEnviando(true);
    try {
      const protocolo = `BOLSA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      await addDoc(collection(db, 'solicitacoes_bolsa'), {
        protocolo,
        editalId: edital.id,
        editalTitulo: edital.titulo || 'Edital nº 02/2026 - Bolsas Dança de Salão',
        dataInicioBolsaPrevista: edital.dataInicioBolsa || '2027-01-11',
        dataFimBolsaPrevista: edital.dataFimBolsa || '2027-07-11',
        vigenciaMeses: Number(edital.vigenciaMeses || 6),
        dataAvaliacaoPresencial: edital.dataAvaliacao || '09 de janeiro de 2027 (sábado), das 14h às 16h',

        // Seção 2
        nome: nome.trim(),
        cpf: cpf.trim(),
        dataNascimento,
        idadeInscricao: idadeCalculada,
        isMenorDe18,
        nomeResponsavelLegal: isMenorDe18 ? nomeResponsavelLegal.trim() : '',
        telefoneResponsavelLegal: isMenorDe18 ? telefoneResponsavelLegal.trim() : '',
        telefone: telefone.trim(),
        email: email.trim().toLowerCase(),
        instagram: instagram.trim(),
        endereco: endereco.trim(),
        fotoPerfilUrl,

        // Seção 3
        conhecimentoPrevio,
        experienciaSalao: experienciaSalao.trim(),
        conheceStudio,
        comoSoube,
        disponibilidadeSabado,
        diasUteisDisponiveis,
        estilosInteresse,
        motivacaoStudio: motivacaoStudio.trim(),
        comoPodeColaborar: comoPodeColaborar.trim(),
        observacoesExtras: observacoesExtras.trim(),

        // Seção 4 & Credencial
        autorizacaoUsoImagem: true,
        cienciaDivergenciaEliminacao: true,
        cienciaFaltaEliminacao: true,
        senhaInicialEscolhida: senhaAcesso,

        status: 'pendente', // pendente | aprovado | reprovado
        dataInscricao: new Date().toISOString(),
      });

      setProtocoloGerado(protocolo);
      setEtapa(5);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErroEtapa('Erro ao registrar sua inscrição: ' + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const dataAvaliacaoTexto =
    edital?.dataAvaliacao || '09 de janeiro de 2027 (sábado), das 14h às 16h';

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-zinc-900 flex flex-col">
      <div className="h-1.5 bg-gradient-to-r from-[#4A041C] via-[#D81B60] to-[#4A041C]" />

      <header className="bg-white border-b border-zinc-200 py-4 px-4 print:border-none">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-studio.png" alt="No Compasso" className="h-12 object-contain" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D81B60] block">
                Processo Seletivo de Bolsistas
              </span>
              <h1 className="text-base sm:text-xl font-bold uppercase font-condensed text-[#4A041C] leading-none">
                No Compasso Studio de Dança
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        {statusEdital === 'carregando' && (
          <div className="bg-white p-10 rounded-3xl border border-zinc-200 text-center text-sm text-zinc-500">
            Carregando informações do Edital...
          </div>
        )}

        {(statusEdital === 'invalido' || statusEdital === 'encerrado') && (
          <div className="bg-white p-8 rounded-3xl border border-red-200 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Lock size={28} />
            </div>
            <h2 className="text-2xl font-bold uppercase font-condensed text-zinc-900">
              {statusEdital === 'encerrado'
                ? 'Período de Inscrições Encerrado'
                : 'Edital não encontrado'}
            </h2>
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              {statusEdital === 'encerrado'
                ? 'As inscrições para este processo seletivo já foram encerradas. Acompanhe nossas novidades no Instagram @nocompasso.acre.'
                : 'Verifique o link recebido ou entre em contato com a direção do Studio.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A041C] px-6 py-3 text-xs font-bold uppercase text-white"
            >
              Voltar ao Início
            </button>
          </div>
        )}

        {statusEdital === 'aberto' && (
          <div className="space-y-6">
            {/* BARRA DE PROGRESSO DAS 4 SEÇÕES */}
            {etapa <= 4 && (
              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { num: 1, label: '1. Edital & Regras' },
                    { num: 2, label: '2. Dados Pessoais' },
                    { num: 3, label: '3. Dança & Horários' },
                    { num: 4, label: '4. Confirmação' },
                  ].map((step) => {
                    const ativo = etapa === step.num;
                    const concluido = etapa > step.num;
                    return (
                      <div
                        key={step.num}
                        className={`py-2 px-1 rounded-xl text-[11px] font-bold uppercase transition ${
                          ativo
                            ? 'bg-[#4A041C] text-white shadow-xs'
                            : concluido
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-zinc-100 text-zinc-400'
                        }`}
                      >
                        {step.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {erroEtapa && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-xs font-bold text-red-800 flex items-center gap-2.5">
                <AlertTriangle size={18} className="shrink-0 text-red-600" />
                <span>{erroEtapa}</span>
              </div>
            )}

            {/* =============================================================== */}
            {/* SEÇÃO 1: TEXTO EXPLICATIVO DO EDITAL & ACEITE                   */}
            {/* =============================================================== */}
            {etapa === 1 && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
                <div className="border-b border-zinc-200 pb-4">
                  <span className="px-3 py-1 rounded-full bg-[#D81B60] text-white text-[10px] font-bold uppercase tracking-wider">
                    Seção 1 de 4 • Leitura Obrigatória
                  </span>
                  <h2 className="text-2xl font-bold uppercase font-condensed text-[#4A041C] mt-2 flex items-center gap-2">
                    <FileText size={22} className="text-[#D81B60]" />{' '}
                    {edital?.titulo || 'Edital nº 02/2026 — Seleção de Bolsistas'}
                  </h2>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-800 leading-relaxed whitespace-pre-line space-y-3">
                  {edital?.textoEdital || TEXTO_EDITAL_PADRAO}

                  <div className="pt-4 mt-4 border-t border-zinc-200 flex flex-col sm:flex-row gap-3">
                    <a
                      href="https://wa.me/5568999816141"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition"
                    >
                      <Phone size={15} /> Dúvidas WhatsApp: (68) 99981-6141
                    </a>
                    <a
                      href="https://instagram.com/nocompasso.acre"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 px-4 py-2.5 text-xs font-bold text-white transition"
                    >
                      <Instagram size={15} /> Instagram: @nocompasso.acre
                    </a>
                  </div>

                  <p className="text-xs font-bold text-[#4A041C] pt-2">
                    Atenciosamente, Direção - Studio de Dança No Compasso
                  </p>
                </div>

                {/* TERMOS DE CIÊNCIA OBRIGATÓRIOS */}
                <div className="p-5 rounded-2xl bg-pink-50/70 border border-[#D81B60]/30 space-y-3">
                  <p className="text-xs font-bold uppercase text-[#4A041C]">
                    Confirmação de Leitura e Ciência:
                  </p>

                  <label className="flex items-start gap-2.5 text-xs text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aceiteLeituraEdital}
                      onChange={(e) => setAceiteLeituraEdital(e.target.checked)}
                      className="mt-0.5 accent-[#D81B60]"
                    />
                    <span>
                      Declaro que li integralmente o <strong>Edital nº 02/2026</strong> e estou ciente da duração da bolsa (6 meses) e da avaliação presencial obrigatória em <strong>{dataAvaliacaoTexto}</strong>.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aceiteFrentesDuplas}
                      onChange={(e) => setAceiteFrentesDuplas(e.target.checked)}
                      className="mt-0.5 accent-[#D81B60]"
                    />
                    <span>
                      Estou ciente de que a atuação é <strong>obrigatoriamente dupla</strong>: auxílio nas turmas regulares de Dança de Salão E composição do elenco da Mostra de Dança do Studio, com ensaios iniciando na semana seguinte ao encontro presencial.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aceiteHorariosObrigatorios}
                      onChange={(e) => setAceiteHorariosObrigatorios(e.target.checked)}
                      className="mt-0.5 accent-[#D81B60]"
                    />
                    <span>
                      Confirmo que possuo disponibilidade aos <strong>sábados (15h às 20h)</strong>, em pelo menos <strong>um dia útil (18h às 21h)</strong>, tenho <strong>15 anos ou mais</strong> e arcarei com minha própria locomoção.
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={avancarParaEtapa2}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#4A041C] hover:bg-[#D81B60] py-3.5 text-xs font-bold uppercase tracking-wider text-white transition shadow-md"
                >
                  Li e Concordo — Avançar para Dados Pessoais <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* =============================================================== */}
            {/* SEÇÃO 2: DADOS PESSOAIS & FOTO DE PERFIL                        */}
            {/* =============================================================== */}
            {etapa === 2 && (
              <form
                onSubmit={avancarParaEtapa3}
                className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-5"
              >
                <div className="border-b border-zinc-200 pb-4">
                  <span className="px-3 py-1 rounded-full bg-[#D81B60] text-white text-[10px] font-bold uppercase tracking-wider">
                    Seção 2 de 4 • Identificação
                  </span>
                  <h2 className="text-2xl font-bold uppercase font-condensed text-[#4A041C] mt-2 flex items-center gap-2">
                    <User size={22} className="text-[#D81B60]" /> Dados Pessoais & Foto de Perfil
                  </h2>
                </div>

                {/* UPLOAD DE FOTO DE PERFIL */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <div className="w-24 h-24 rounded-2xl bg-zinc-200 border-2 border-dashed border-zinc-400 flex items-center justify-center overflow-hidden shrink-0">
                    {fotoPerfilUrl ? (
                      <img src={fotoPerfilUrl} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={28} className="text-zinc-400" />
                    )}
                  </div>
                  <div className="space-y-1.5 text-center sm:text-left">
                    <p className="text-xs font-bold uppercase text-zinc-800">
                      Foto de Perfil do Candidato *
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Envie uma foto nítida do seu rosto para identificação durante a avaliação presencial.
                    </p>
                    <label className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A041C] hover:bg-[#D81B60] px-4 py-2 text-xs font-bold uppercase text-white cursor-pointer transition">
                      <Camera size={14} />
                      {fotoPerfilUrl ? 'Trocar Foto' : 'Selecionar Foto'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => processarFotoPerfil(e.target.files[0], setFotoPerfilUrl)}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Seu nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      CPF *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={14}
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(aplicarMascaraCpf(e.target.value))}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Data de Nascimento *
                    </label>
                    <input
                      type="date"
                      required
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                    {idadeCalculada !== null && (
                      <span
                        className={`block mt-1 text-[11px] font-bold ${
                          isMenorDe15
                            ? 'text-red-600'
                            : isMenorDe18
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        Idade: {idadeCalculada} anos{' '}
                        {isMenorDe15
                          ? '(Idade mínima exigida: 15 anos)'
                          : isMenorDe18
                          ? '(Menor de 18: informe o responsável abaixo)'
                          : ''}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      WhatsApp para Contato *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      placeholder="(00) 00000-0000"
                      value={telefone}
                      onChange={(e) => setTelefone(aplicarMascaraTelefone(e.target.value))}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>
                </div>

                {isMenorDe18 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3">
                    <p className="text-xs font-bold uppercase text-amber-950">
                      Dados do Responsável Legal (Obrigatório para menores de 18 anos)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Nome completo do Pai / Mãe / Responsável"
                        value={nomeResponsavelLegal}
                        onChange={(e) => setNomeResponsavelLegal(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs"
                      />
                      <input
                        type="text"
                        required
                        maxLength={15}
                        placeholder="WhatsApp do Responsável"
                        value={telefoneResponsavelLegal}
                        onChange={(e) =>
                          setTelefoneResponsavelLegal(aplicarMascaraTelefone(e.target.value))
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="seuemail@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Instagram (@perfil) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="@seuinstagram"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Endereço Completo (Rua, Número, Bairro) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rua das Acácias, 120 - Bairro Bosque, Rio Branco/AC"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEtapa(1)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-5 py-3 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
                  >
                    <ArrowLeft size={15} /> Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#4A041C] hover:bg-[#D81B60] py-3 text-xs font-bold uppercase text-white transition"
                  >
                    Próxima Seção: Dados de Dança <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* =============================================================== */}
            {/* SEÇÃO 3: DADOS DE DANÇA & DISPONIBILIDADE                       */}
            {/* =============================================================== */}
            {etapa === 3 && (
              <form
                onSubmit={avancarParaEtapa4}
                className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-5"
              >
                <div className="border-b border-zinc-200 pb-4">
                  <span className="px-3 py-1 rounded-full bg-[#D81B60] text-white text-[10px] font-bold uppercase tracking-wider">
                    Seção 3 de 4 • Perfil Artístico & Horários
                  </span>
                  <h2 className="text-2xl font-bold uppercase font-condensed text-[#4A041C] mt-2 flex items-center gap-2">
                    <Music size={22} className="text-[#D81B60]" /> Experiência em Dança & Disponibilidade
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Nível de Conhecimento Prévio *
                    </label>
                    <select
                      value={conhecimentoPrevio}
                      onChange={(e) => setConhecimentoPrevio(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold"
                    >
                      <option value="Iniciante (nunca fiz aulas)">Iniciante (nunca fiz aulas)</option>
                      <option value="Básico (já fiz algumas aulas ou bailes)">Básico (já fiz algumas aulas/bailes)</option>
                      <option value="Intermediário (danço vários ritmos)">Intermediário (danço vários ritmos)</option>
                      <option value="Avançado / Já atuei como monitor ou bailarino">Avançado / Já atuei como monitor(a)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                      Já conhece o Studio No Compasso? *
                    </label>
                    <select
                      value={conheceStudio}
                      onChange={(e) => setConheceStudio(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold"
                    >
                      <option value="Não, será meu primeiro contato">Não, será meu primeiro contato</option>
                      <option value="Conheço pelas redes sociais / eventos">Conheço pelas redes sociais / bailes</option>
                      <option value="Sim, já fui aluno(a) do Studio">Sim, já fui aluno(a) do Studio</option>
                      <option value="Sim, sou aluno(a) atual do Studio">Sim, sou aluno(a) atual do Studio</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Conte sobre sua experiência com Dança de Salão (ou outras danças) *
                  </label>
                  <textarea
                    rows="2"
                    required
                    placeholder="Quais ritmos já dançou, há quanto tempo, se já participou de apresentações..."
                    value={experienciaSalao}
                    onChange={(e) => setExperienciaSalao(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Como ficou sabendo do Edital de Bolsas? *
                  </label>
                  <select
                    value={comoSoube}
                    onChange={(e) => setComoSoube(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  >
                    <option value="Instagram (@nocompasso.acre)">Instagram (@nocompasso.acre)</option>
                    <option value="Indicação de amigo(a) / aluno(a) / bolsista">Indicação de amigo(a) / aluno(a) / bolsista</option>
                    <option value="Grupos de WhatsApp">Grupos de WhatsApp</option>
                    <option value="Eventos / Mostras do Studio">Eventos / Mostras do Studio</option>
                    <option value="Outro meio">Outro meio</option>
                  </select>
                </div>

                {/* DISPONIBILIDADE DE HORÁRIOS */}
                <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-300 space-y-3">
                  <p className="text-xs font-bold uppercase text-cyan-950">
                    Disponibilidade Semanal Confirmada *
                  </p>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-cyan-200 text-xs font-bold text-zinc-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={disponibilidadeSabado}
                      onChange={(e) => setDisponibilidadeSabado(e.target.checked)}
                      className="accent-[#4A041C]"
                    />
                    <span>Sábado (15h às 20h) — Obrigatório</span>
                  </label>

                  <div>
                    <span className="block text-[11px] font-bold uppercase text-cyan-900 mb-1.5">
                      Marque os dias úteis que você tem livre das 18h às 21h (mínimo 1 dia):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {DIAS_UTEIS_OPCOES.map((dia) => {
                        const marcado = diasUteisDisponiveis.includes(dia);
                        return (
                          <button
                            type="button"
                            key={dia}
                            onClick={() => toggleDiaUtil(dia)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border text-left transition ${
                              marcado
                                ? 'bg-[#4A041C] text-white border-[#4A041C]'
                                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                            }`}
                          >
                            {marcado ? '✓ ' : '+ '} {dia}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ESTILOS QUE MAIS QUER APRENDER */}
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1.5">
                    Estilos de Dança de Salão que mais quer aprender *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ESTILOS_DANCA.map((est) => {
                      const sel = estilosInteresse.includes(est);
                      return (
                        <button
                          type="button"
                          key={est}
                          onClick={() => toggleEstilo(est)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                            sel
                              ? 'bg-[#D81B60] text-white border-[#D81B60]'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                          }`}
                        >
                          {est}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Por que você deseja ser bolsista do Studio No Compasso? *
                  </label>
                  <textarea
                    rows="2"
                    required
                    placeholder="Conte seu interesse em participar do estúdio e da Mostra de Dança..."
                    value={motivacaoStudio}
                    onChange={(e) => setMotivacaoStudio(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Em que você acredita que pode colaborar com o Studio e com os colegas? *
                  </label>
                  <textarea
                    rows="2"
                    required
                    placeholder="Ex: organização, pontualidade, acolhimento aos alunos iniciantes, redes sociais, dedicação aos ensaios..."
                    value={comoPodeColaborar}
                    onChange={(e) => setComoPodeColaborar(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-600 mb-1">
                    Alguma restrição física, lesão ou observação importante? (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Se não houver, deixe em branco"
                    value={observacoesExtras}
                    onChange={(e) => setObservacoesExtras(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEtapa(2)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-5 py-3 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
                  >
                    <ArrowLeft size={15} /> Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#4A041C] hover:bg-[#D81B60] py-3 text-xs font-bold uppercase text-white transition"
                  >
                    Próxima Seção: Confirmações Finais <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* =============================================================== */}
            {/* SEÇÃO 4: CONFIRMAÇÕES NECESSÁRIAS & SENHA                       */}
            {/* =============================================================== */}
            {etapa === 4 && (
              <form
                onSubmit={handleFinalizarInscricao}
                autoComplete="off"
                className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-5"
              >
                <div className="border-b border-zinc-200 pb-4">
                  <span className="px-3 py-1 rounded-full bg-[#D81B60] text-white text-[10px] font-bold uppercase tracking-wider">
                    Seção 4 de 4 • Termos Finais
                  </span>
                  <h2 className="text-2xl font-bold uppercase font-condensed text-[#4A041C] mt-2 flex items-center gap-2">
                    <ShieldCheck size={22} className="text-[#D81B60]" /> Autorizações & Conclusão
                  </h2>
                </div>

                <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <label className="flex items-start gap-2.5 text-xs text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={autorizacaoUsoImagem}
                      onChange={(e) => setAutorizacaoUsoImagem(e.target.checked)}
                      className="mt-0.5 accent-[#D81B60]"
                    />
                    <span>
                      <strong>Autorização de Uso de Imagem e Voz:</strong> Autorizo o Studio de Dança No Compasso a utilizar minha imagem e voz em fotos e vídeos captados durante o processo seletivo, aulas, ensaios e apresentações da Mostra de Dança para fins institucionais e de divulgação.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={cienciaDivergenciaEliminacao}
                      onChange={(e) => setCienciaDivergenciaEliminacao(e.target.checked)}
                      className="mt-0.5 accent-[#D81B60]"
                    />
                    <span>
                      <strong>Ciência de Veracidade e Desclassificação:</strong> Declaro que todas as informações prestadas são verdadeiras e estou ciente de que qualquer divergência constatada acarretará minha eliminação imediata do certame ou cancelamento da bolsa.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 text-xs text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={cienciaFaltaEliminacao}
                      onChange={(e) => setCienciaFaltaEliminacao(e.target.checked)}
                      className="mt-0.5 accent-[#D81B60]"
                    />
                    <span>
                      <strong>Compromisso com a Avaliação Presencial:</strong> Estou ciente de que devo comparecer presencialmente no dia <strong>{dataAvaliacaoTexto}</strong>, sob pena de eliminação automática em caso de falta.
                    </span>
                  </label>
                </div>

                {/* SENHA PARA O PORTAL CASO SEJA APROVADO */}
                <div className="p-4 rounded-2xl bg-pink-50/60 border border-[#D81B60]/30 space-y-3">
                  <p className="text-xs font-bold uppercase text-[#4A041C]">
                    Crie sua Senha de Acesso ao Portal do Bolsista
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Caso você seja aprovado(a) pela coordenação, este e-mail (<strong>{email}</strong>) e a senha abaixo já liberarão seu acesso ao portal.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        placeholder="Crie uma senha (mín. 6 dígitos)"
                        value={senhaAcesso}
                        onChange={(e) => setSenhaAcesso(e.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 pr-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((prev) => !prev)}
                        className="absolute right-3 top-2.5 text-zinc-500"
                      >
                        {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>

                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Confirme sua senha"
                      value={confirmarSenhaAcesso}
                      onChange={(e) => setConfirmarSenhaAcesso(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEtapa(3)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 px-5 py-3 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
                  >
                    <ArrowLeft size={15} /> Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#4A041C] to-[#D81B60] py-3.5 text-xs font-bold uppercase tracking-wider text-white hover:brightness-110 transition shadow-md"
                  >
                    {enviando ? 'Enviando Inscrição...' : 'Confirmar Inscrição & Gerar Comprovante'}
                  </button>
                </div>
              </form>
            )}

            {/* =============================================================== */}
            {/* SEÇÃO 5: COMPROVANTE DE INSCRIÇÃO COM AVISO PISCANDO            */}
            {/* =============================================================== */}
            {etapa === 5 && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-emerald-300 shadow-md space-y-6">
                <div className="text-center space-y-2 border-b border-zinc-200 pb-5">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={36} />
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold uppercase">
                    Inscrição Registrada com Sucesso
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold uppercase font-condensed text-[#4A041C]">
                    Comprovante de Inscrição — Seleção de Bolsistas
                  </h2>
                  <p className="text-xs font-mono font-bold text-zinc-600">
                    Protocolo: <span className="text-[#D81B60] text-sm">{protocoloGerado}</span>
                  </p>
                </div>

                {/* AVISO PISCANDO LEMBRANDO DA DATA DO ENCONTRO DE SELEÇÃO */}
                <div className="p-5 rounded-2xl bg-amber-100 border-2 border-amber-500 text-amber-950 shadow-sm animate-pulse space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-red-700">
                    <AlertTriangle size={18} className="shrink-0" />
                    <span>ATENÇÃO OBRIGATÓRIA — NÃO FALTE!</span>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                    <Calendar size={18} className="text-[#D81B60] shrink-0" />
                    Avaliação Presencial: {dataAvaliacaoTexto}
                  </p>
                  <p className="text-xs font-semibold text-amber-950 flex items-center gap-2">
                    <Clock size={16} className="text-amber-800 shrink-0" />
                    Local: Studio de Dança No Compasso (Estrada das Placas, 1909 — Rio Branco/AC). O não comparecimento elimina automaticamente o candidato do certame.
                  </p>
                </div>

                {/* RESUMO DOS DADOS DO CANDIDATO */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs">
                  {fotoPerfilUrl && (
                    <img
                      src={fotoPerfilUrl}
                      alt={nome}
                      className="w-24 h-24 rounded-2xl object-cover border border-zinc-300 shrink-0"
                    />
                  )}
                  <div className="space-y-1.5 flex-1">
                    <p>
                      <strong className="text-zinc-500 uppercase">Candidato(a):</strong>{' '}
                      <span className="font-bold text-zinc-900 text-sm">{nome}</span>
                    </p>
                    <p>
                      <strong className="text-zinc-500 uppercase">CPF:</strong> {cpf} •{' '}
                      <strong className="text-zinc-500 uppercase">Idade:</strong> {idadeCalculada} anos
                    </p>
                    <p>
                      <strong className="text-zinc-500 uppercase">Contato:</strong> {telefone} • {email}
                    </p>
                    <p>
                      <strong className="text-zinc-500 uppercase">Instagram:</strong> {instagram}
                    </p>
                    <p>
                      <strong className="text-zinc-500 uppercase">Dias Disponíveis:</strong> Sábado (15h–20h) +{' '}
                      {diasUteisDisponiveis.join(', ')}
                    </p>
                    <p>
                      <strong className="text-zinc-500 uppercase">Edital:</strong>{' '}
                      {edital?.titulo || 'Edital nº 02/2026'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#4A041C] hover:bg-[#2D0210] py-3 text-xs font-bold uppercase text-white transition"
                  >
                    <Printer size={16} /> Imprimir / Salvar Comprovante (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="rounded-xl border border-zinc-300 px-5 py-3 text-xs font-bold uppercase text-zinc-700 hover:bg-zinc-100"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
