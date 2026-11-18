import { useCallback, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { AdminModule } from './components/AdminModule';
import { BancaVirtualModule } from './components/BancaVirtualModule';
import { CajeroModule } from './components/CajeroModule';
import type { ModuloSistema } from './types/banco';

export default function App() {
  const [moduloActivo, setModuloActivo] = useState<ModuloSistema>('CAJERO');
  const [sesionActivaModulo, setSesionActivaModulo] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const cerrarSesionRef = useRef<(() => void) | undefined>(undefined);

  const handleEstadoSesionChange = useCallback(
    (activa: boolean, cerrarFn?: () => void) => {
      setSesionActivaModulo(activa);
      cerrarSesionRef.current = cerrarFn;
    },
    [],
  );

  function cambiarModulo(modulo: ModuloSistema) {
    if (modulo === moduloActivo) return;
    setSesionActivaModulo(false);
    cerrarSesionRef.current = undefined;
    setModuloActivo(modulo);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-900">
      {/* Barra superior (contrato de 3 zonas) */}
      <header className="bg-[#0B3D6B] text-white border-b border-[#082E52] print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#contenido-modulo"
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Simulador Bancario
          </a>

          <nav
            aria-label="Módulos del sistema"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-200"
          >
            <button
              type="button"
              onClick={() => cambiarModulo('BANCA_VIRTUAL')}
              className={`hover:text-white underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                moduloActivo === 'BANCA_VIRTUAL'
                  ? 'text-white underline font-semibold'
                  : 'hover:underline'
              }`}
            >
              Banca virtual
            </button>
            <button
              type="button"
              onClick={() => cambiarModulo('CAJERO')}
              className={`hover:text-white underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                moduloActivo === 'CAJERO'
                  ? 'text-white underline font-semibold'
                  : 'hover:underline'
              }`}
            >
              Cajero automático
            </button>
            <button
              type="button"
              onClick={() => cambiarModulo('ADMINISTRACION')}
              className={`hover:text-white underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                moduloActivo === 'ADMINISTRACION'
                  ? 'text-white underline font-semibold'
                  : 'hover:underline'
              }`}
            >
              Administración
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            {sesionActivaModulo ? (
              <button
                type="button"
                onClick={() => cerrarSesionRef.current?.()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-[#0B3D6B] text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {moduloActivo === 'CAJERO'
                    ? 'Cerrar operación'
                    : 'Cerrar sesión'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setResetSignal((prev) => prev + 1)}
                className="px-4 py-2 rounded-lg border border-white/25 bg-white/10 text-white text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Selector móvil compacto */}
        <div className="md:hidden border-t border-white/15 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => cambiarModulo('BANCA_VIRTUAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
              moduloActivo === 'BANCA_VIRTUAL'
                ? 'bg-white text-[#0B3D6B]'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            Banca virtual
          </button>
          <button
            type="button"
            onClick={() => cambiarModulo('CAJERO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
              moduloActivo === 'CAJERO'
                ? 'bg-white text-[#0B3D6B]'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            Cajero automático
          </button>
          <button
            type="button"
            onClick={() => cambiarModulo('ADMINISTRACION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
              moduloActivo === 'ADMINISTRACION'
                ? 'bg-white text-[#0B3D6B]'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            Administración
          </button>
        </div>
      </header>

      <main
        id="contenido-modulo"
        className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8"
      >
        {moduloActivo === 'BANCA_VIRTUAL' ? (
          <BancaVirtualModule
            onEstadoSesionChange={handleEstadoSesionChange}
            resetSignal={resetSignal}
          />
        ) : moduloActivo === 'ADMINISTRACION' ? (
          <AdminModule
            onEstadoSesionChange={handleEstadoSesionChange}
            resetSignal={resetSignal}
          />
        ) : (
          <CajeroModule
            onEstadoSesionChange={handleEstadoSesionChange}
            resetSignal={resetSignal}
          />
        )}
      </main>
    </div>
  );
}
