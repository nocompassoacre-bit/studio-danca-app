import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { User, GraduationCap, Presentation, Users, ArrowRight, MessageCircle, Sparkles } from 'lucide-react';
import { db } from './firebase';
import LoginModal from './LoginModal';
import CourseCard from './CourseCard';

export default function HomePublica() {
  const [perfilSelecionado, setPerfilSelecionado] = useState(null);
  const [cursos, setCursos] = useState([]);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    const carregarCursos = async () => {
      try {
        const q = query(collection(db, 'cursos'), where('ativo', '==', true));
        const snap = await getDocs(q);
        const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCursos(lista);
      } catch (error) {
        console.error('Erro ao buscar cursos:', error);
      }
    };
    carregarCursos();
  }, []);

  const cursosFiltrados = cursos.filter((c) => (filtro === 'todos' ? true : c.tipo === filtro));

  const cardsAcesso = [
    {
      id: 'aluno',
      titulo: 'ALUNOS',
      icone: User,
      bg: 'bg-gradient-to-b from-[#3A0618] to-[#1F030D]',
      border: 'border-[#C5A059]/60 hover:border-[#E91E63]',
    },
    {
      id: 'bolsista',
      titulo: 'BOLSISTA',
      icone: GraduationCap,
      bg: 'bg-gradient-to-b from-[#1F1F24] to-[#121216]',
      border: 'border-[#C5A059]/60 hover:border-[#22D3EE]',
    },
    {
      id: 'prof',
      titulo: 'PROFESSOR',
      icone: Presentation,
      bg: 'bg-gradient-to-b from-[#6B0A2B] to-[#360415]',
      border: 'border-[#C5A059]/60 hover:border-[#D81B60]',
    },
    {
      id: 'admin',
      titulo: 'COORDENAÇÃO',
      icone: Users,
      bg: 'bg-gradient-to-b from-[#18181C] to-[#0D0D10]',
      border: 'border-[#C5A059]/60 hover:border-[#C5A059]',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F12] text-white">
      <section className="relative min-h-[88vh] flex flex-col justify-between px-6 py-10 overflow-hidden border-b border-[#C5A059]/20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F0F12]/85 via-[#1C040D]/75 to-[#0F0F12]" />

        <header className="relative z-10 flex flex-col items-center text-center mt-2">
          <img
            src="/logo-studio.png"
            alt="No Compasso Studio de Dança"
            className="h-28 md:h-32 object-contain drop-shadow-2xl"
          />

          <div className="mt-6 flex items-center gap-4">
            <span className="hidden sm:block h-[1px] w-16 bg-gradient-to-r from-transparent to-[#C5A059]" />
            <p className="text-2xl md:text-3xl italic font-serif text-[#E5C17B]">
              Seja bem-vindo(a)!
            </p>
            <span className="hidden sm:block h-[1px] w-16 bg-gradient-to-l from-transparent to-[#C5A059]" />
          </div>

          <p className="mt-2 text-xs md:text-sm tracking-[0.28em] uppercase text-zinc-300 font-semibold">
            ESCOLHA O SEU ACESSO
          </p>
        </header>

        <main className="relative z-10 max-w-5xl w-full mx-auto my-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cardsAcesso.map((card) => {
            const Icone = card.icone;
            return (
              <button
                key={card.id}
                onClick={() => setPerfilSelecionado(card.id)}
                className={`group relative flex flex-col items-center justify-center py-10 px-6 rounded-2xl border ${card.border} ${card.bg} shadow-2xl transition-all duration-300 hover:-translate-y-1.5`}
              >
                <div className="w-16 h-16 rounded-full border border-[#C5A059] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Icone size={28} className="text-[#E5C17B]" strokeWidth={1.6} />
                </div>

                <span className="text-base font-bold tracking-[0.22em] text-white font-condensed">
                  {card.titulo}
                </span>

                <span className="w-8 h-[1px] bg-[#C5A059]/60 my-3" />

                <ArrowRight
                  size={18}
                  className="text-[#E5C17B] group-hover:translate-x-1.5 transition-transform"
                />
              </button>
            );
          })}
        </main>

        <footer className="relative z-10 max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs tracking-[0.2em] text-zinc-400 uppercase">
          <div>
            <p>DANÇA É ENCONTRO,</p>
            <p>MOVIMENTO E CONEXÃO.</p>
            <span className="block w-8 h-[1px] bg-[#C5A059] mt-2" />
          </div>

          <a
            href="https://wa.me/5568999533619"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 text-[#E5C17B] hover:text-white transition"
          >
            <span className="p-2 rounded-full border border-[#C5A059]/60">
              <MessageCircle size={18} />
            </span>
            <span className="border-b border-[#C5A059]/50 pb-1">FALE CONOSCO</span>
            <ArrowRight size={14} />
          </a>
        </footer>
      </section>

      <section id="cursos" className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#D81B60]">
              Programação Oficial
            </span>
            <h2 className="text-3xl md:text-4xl font-bold uppercase font-condensed mt-1">
              Turmas Fixas & Cursos de Férias
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'todos', label: 'Todos os Cursos' },
              { id: 'ferias', label: 'Cursos de Férias', icon: Sparkles },
              { id: 'fixo', label: 'Turmas Fixas' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFiltro(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                  filtro === tab.id
                    ? 'bg-[#D81B60] text-white'
                    : 'bg-[#18181F] text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {cursosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-[#16161B] p-12 text-center text-zinc-400">
            <p className="text-lg font-semibold text-zinc-200">
              Novas turmas e cursos de férias sendo preparados!
            </p>
            <p className="text-sm mt-1">
              Acesse o portal acima ou fale conosco pelo WhatsApp para reservar sua vaga.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cursosFiltrados.map((curso) => (
              <CourseCard
                key={curso.id}
                curso={curso}
                onMatricular={() => setPerfilSelecionado('aluno')}
              />
            ))}
          </div>
        )}
      </section>

      <LoginModal
        perfil={perfilSelecionado}
        onClose={() => setPerfilSelecionado(null)}
      />
    </div>
  );
}
