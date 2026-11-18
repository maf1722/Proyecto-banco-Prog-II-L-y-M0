import { Check, Delete, RotateCcw } from 'lucide-react';

interface TecladoNumericoProps {
  etiquetaCampoActivo: string;
  deshabilitado?: boolean;
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  onLimpiar: () => void;
  onConfirmar: () => void;
  textoConfirmar?: string;
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function TecladoNumerico({
  etiquetaCampoActivo,
  deshabilitado = false,
  onDigito,
  onBorrar,
  onLimpiar,
  onConfirmar,
  textoConfirmar = 'Confirmar',
}: TecladoNumericoProps) {
  return (
    <section
      aria-label="Teclado numérico del cajero"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Teclado del cajero
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[260px]">
            Campo activo: <span className="font-medium text-slate-700">{etiquetaCampoActivo}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        <div className="col-span-3 grid grid-cols-3 gap-2.5">
          {TECLAS.map((digito) => (
            <button
              key={digito}
              type="button"
              disabled={deshabilitado}
              onClick={() => onDigito(digito)}
              className="h-12 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-mono text-lg font-semibold tabular-nums transition-transform duration-100 hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D6B] disabled:opacity-45 disabled:pointer-events-none"
            >
              {digito}
            </button>
          ))}
          <button
            type="button"
            disabled={deshabilitado}
            onClick={onLimpiar}
            className="h-12 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 text-xs font-semibold whitespace-nowrap transition-transform duration-100 hover:bg-slate-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D6B] disabled:opacity-45 disabled:pointer-events-none"
          >
            Limpiar
          </button>
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onDigito('0')}
            className="h-12 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 font-mono text-lg font-semibold tabular-nums transition-transform duration-100 hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D6B] disabled:opacity-45 disabled:pointer-events-none"
          >
            0
          </button>
          <button
            type="button"
            disabled={deshabilitado}
            onClick={onBorrar}
            aria-label="Borrar último dígito"
            className="h-12 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 flex items-center justify-center transition-transform duration-100 hover:bg-slate-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D6B] disabled:opacity-45 disabled:pointer-events-none"
          >
            <Delete className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="col-span-1 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={deshabilitado}
            onClick={onBorrar}
            className="h-12 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold px-2 flex items-center justify-center gap-1 whitespace-nowrap transition-transform duration-100 hover:bg-amber-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-45 disabled:pointer-events-none"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Corregir</span>
          </button>

          <button
            type="button"
            disabled={deshabilitado}
            onClick={onConfirmar}
            className="flex-1 min-h-[104px] rounded-lg bg-[#16A34A] text-white text-xs font-semibold px-2 flex flex-col items-center justify-center gap-1.5 text-center transition-transform duration-100 hover:bg-[#15803D] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 disabled:opacity-45 disabled:pointer-events-none"
          >
            <Check className="w-5 h-5" aria-hidden="true" />
            <span className="leading-tight">{textoConfirmar}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
