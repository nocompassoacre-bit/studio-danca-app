import { Calendar, Clock, Hourglass, UserCheck, Sparkles, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CourseCard({ curso }) {
  const isEspecial = curso.tipo !== 'fixo';

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl bg-[#18181F] border border-zinc-800/80 hover:border-[#D81B60] transition-all duration-300 overflow-hidden shadow-lg">
      <div className={`px-5 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-widest ${
        isEspecial 
          ? 'bg-gradient-to-r from-[#D81B60] to-[#880E4F] text-white' 
          : 'bg-[#2D0210] text-zinc-200 border-b border-zinc-800'
      }`}>
        <span className="flex items-center gap-1.5">
          {isEspecial && <Sparkles size={14} />}
          {curso.tipoLabel || (isEspecial ? 'Curso Especial' : 'Turma Regular')}
        </span>
        <span className="bg-black/30 px-2.5 py-0.5 rounded-full text-[11px]">
          {curso.estilo}
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-2xl font-bold uppercase tracking-tight font-condensed text-white group-hover:text-[#E91E63] transition">
            {curso.titulo}
          </h3>

          <div className="mt-4 space-y-2.5 text-sm text-zinc-300">
            <div className="flex items-center gap-2.5">
              <UserCheck size={16} className="text-[#D81B60] shrink-0" />
              <span>
                <strong className="text-zinc-400 font-semibold">Prof(s):</strong> {curso.professoresNomes}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Calendar size={16} className="text-[#D81B60] shrink-0" />
              <span>
                <strong className="text-zinc-400 font-semibold">Data:</strong> {curso.dataInfo} ({curso.horaInicio || '19:00'} às {curso.horarioFim || '21:00'})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-2 bg-[#0F0F12] p-2 rounded-lg border border-zinc-800/80">
                <Clock size={15} className="text-[#C5A059] shrink-0" />
                <div className="leading-tight">
                  <span className="block text-[10px] uppercase text-zinc-500">Aula</span>
                  <span className="text-xs font-semibold text-zinc-200">{curso.duracaoAula}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[#0F0F12] p-2 rounded-lg border border-zinc-800/80">
                <Hourglass size={15} className="text-[#C5A059] shrink-0" />
                <div className="leading-tight">
                  <span className="block text-[10px] uppercase text-zinc-500">Duração Total</span>
                  <span className="text-xs font-semibold text-zinc-200">{curso.duracaoTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-zinc-400">Investimento</span>
            <span className="text-2xl font-bold text-white font-condensed">
              R$ {Number(curso.valor).toFixed(2).replace('.', ',')}
            </span>
          </div>

          <Link
            to={`/inscricao/curso/${curso.id}`}
            className="flex items-center gap-1.5 rounded-xl bg-[#D81B60] hover:bg-[#AD1457] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition"
          >
            Inscrever-se
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
