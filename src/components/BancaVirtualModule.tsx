import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import {
  actualizarPerfilBanca,
  cambiarClaveBanca,
  cerrarSesionBanca,
  consultarMovimientosBanca,
  iniciarSesionBanca,
  obtenerSesionBanca,
  realizarTransferenciaBanca,
} from '../services/bancaApi';
import { ComprobanteOperacion } from './ComprobanteOperacion';
import type { ComprobanteOperacionData, MovimientoCajero } from '../types/cajero';
import type { CuentaBancaria, UsuarioPublico } from '../types/banco';
import {
  formatearFecha,
  nombreTipoMovimiento,
  pesosCOP,
} from '../utils/formato';

type VistaBanca = 'CUENTAS' | 'TRANSFERIR' | 'PERFIL' | 'CLAVE';

interface MensajeSistema {
  tipo: 'error' | 'exito' | 'advertencia';
  texto: string;
}

interface BancaVirtualModuleProps {
  onEstadoSesionChange?: (activa: boolean, cerrarFn?: () => void) => void;
  resetSignal?: number;
}

export function BancaVirtualModule({
  onEstadoSesionChange,
  resetSignal = 0,
}: BancaVirtualModuleProps) {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [usuario, setUsuario] = useState<UsuarioPublico | null>(null);
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState<number | null>(
    null,
  );
  const [movimientos, setMovimientos] = useState<MovimientoCajero[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);

  const [vista, setVista] = useState<VistaBanca>('CUENTAS');
  const [mensaje, setMensaje] = useState<MensajeSistema | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Login
  const [usuarioLogin, setUsuarioLogin] = useState('');
  const [claveLogin, setClaveLogin] = useState('');
  const [mostrarClaveLogin, setMostrarClaveLogin] = useState(false);
  const [bloqueoSegundos, setBloqueoSegundos] = useState(0);

  // Transferencia
  const [cuentaOrigenTx, setCuentaOrigenTx] = useState<number | ''>('');
  const [cuentaDestinoTx, setCuentaDestinoTx] = useState('');
  const [valorTx, setValorTx] = useState('');
  const [descripcionTx, setDescripcionTx] = useState('');
  const [ultimoComprobante, setUltimoComprobante] =
    useState<ComprobanteOperacionData | null>(null);

  // Perfil
  const [nombrePerfil, setNombrePerfil] = useState('');
  const [apellidosPerfil, setApellidosPerfil] = useState('');
  const [correoPerfil, setCorreoPerfil] = useState('');
  const [telefonoPerfil, setTelefonoPerfil] = useState('');

  // Cambio de contraseña
  const [claveActualInput, setClaveActualInput] = useState('');
  const [nuevaClaveInput, setNuevaClaveInput] = useState('');
  const [confirmarClaveInput, setConfirmarClaveInput] = useState('');

  const cuentaSeleccionada =
    cuentas.find((c) => c.id_cuenta === cuentaSeleccionadaId) ?? cuentas[0] ?? null;

  useEffect(() => {
    let activo = true;
    (async () => {
      const res = await obtenerSesionBanca();
      if (!activo) return;
      if (res.ok && res.data.usuario && res.data.cuentas) {
        hidratarSesion(res.data.usuario, res.data.cuentas);
      } else {
        setUsuario(null);
        setCuentas([]);
        if (res.data.sesionCerrada && res.status === 403 && res.data.mensaje) {
          setMensaje({ tipo: 'error', texto: res.data.mensaje });
        }
      }
      setCargandoInicial(false);
    })();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (resetSignal > 0 && !usuario) {
      setUsuarioLogin('');
      setClaveLogin('');
      setMensaje(null);
    }
  }, [resetSignal]);

  useEffect(() => {
    if (bloqueoSegundos <= 0) return;
    const timer = window.setInterval(() => {
      setBloqueoSegundos((prev) => {
        if (prev <= 1) {
          setMensaje({
            tipo: 'advertencia',
            texto:
              'Tiempo de espera finalizado. Ya puedes intentar ingresar de nuevo.',
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bloqueoSegundos]);

  useEffect(() => {
    onEstadoSesionChange?.(Boolean(usuario), manejarCerrarSesion);
  }, [usuario]);

  function hidratarSesion(u: UsuarioPublico, listaCuentas: CuentaBancaria[]) {
    setUsuario(u);
    setCuentas(listaCuentas);
    setNombrePerfil(u.nombre);
    setApellidosPerfil(u.apellidos);
    setCorreoPerfil(u.correo);
    setTelefonoPerfil(u.telefono || '');

    const primeraActiva =
      listaCuentas.find((c) => c.estado === 'ACTIVO') ?? listaCuentas[0];
    if (primeraActiva) {
      setCuentaSeleccionadaId(primeraActiva.id_cuenta);
      setCuentaOrigenTx(primeraActiva.id_cuenta);
      void cargarMovimientosCuenta(primeraActiva.id_cuenta);
    }
    if (u.cambio_clave) {
      setVista('CLAVE');
      setMensaje({
        tipo: 'advertencia',
        texto:
          'Por seguridad, debes cambiar tu contraseña temporal de 7 dígitos en tu primer ingreso.',
      });
    }
  }

  function manejarSesionCaida(res: {
    status: number;
    data: { sesionCerrada?: boolean; mensaje?: string };
  }): boolean {
    if (res.data.sesionCerrada || res.status === 401 || res.status === 403) {
      setUsuario(null);
      setCuentas([]);
      setMovimientos([]);
      setUltimoComprobante(null);
      setMensaje({
        tipo: 'error',
        texto:
          res.data.mensaje ||
          'Tu sesión en la banca virtual fue cerrada. Inicia sesión nuevamente.',
      });
      return true;
    }
    return false;
  }

  async function cargarMovimientosCuenta(idCuenta: number) {
    setCargandoMovimientos(true);
    const res = await consultarMovimientosBanca(idCuenta, 50);
    setCargandoMovimientos(false);
    if (!res.ok) {
      manejarSesionCaida(res);
      return;
    }
    setMovimientos(res.data.movimientos || []);
    if (res.data.cuenta) {
      setCuentas((prev) =>
        prev.map((c) =>
          c.id_cuenta === res.data.cuenta.id_cuenta ? res.data.cuenta : c,
        ),
      );
    }
  }

  async function refrescarDatosBanca() {
    setProcesando(true);
    setMensaje(null);
    const res = await obtenerSesionBanca();
    setProcesando(false);
    if (!res.ok) {
      manejarSesionCaida(res);
      return;
    }
    if (res.data.usuario && res.data.cuentas) {
      setUsuario(res.data.usuario);
      setCuentas(res.data.cuentas);
      const idActual =
        cuentaSeleccionadaId ?? res.data.cuentas[0]?.id_cuenta ?? null;
      if (idActual) {
        await cargarMovimientosCuenta(idActual);
      }
    }
  }

  async function ejecutarLogin(e: FormEvent) {
    e.preventDefault();
    if (procesando || bloqueoSegundos > 0) return;

    const user = usuarioLogin.trim();
    const pass = claveLogin.trim();
    if (!user) {
      setMensaje({ tipo: 'error', texto: 'Ingresa tu nombre de usuario.' });
      return;
    }
    if (!/^\d{7}$/.test(pass)) {
      setMensaje({
        tipo: 'error',
        texto: 'La contraseña debe tener exactamente 7 dígitos numéricos.',
      });
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await iniciarSesionBanca(user, pass);
    setProcesando(false);
    setClaveLogin('');

    if (!res.ok) {
      if (res.data.bloqueoRestanteSegundos) {
        setBloqueoSegundos(res.data.bloqueoRestanteSegundos);
      }
      setMensaje({
        tipo: res.status === 429 ? 'advertencia' : 'error',
        texto: res.data.mensaje || 'No fue posible iniciar sesión.',
      });
      return;
    }

    if (res.data.usuario && res.data.cuentas) {
      setUltimoComprobante(null);
      setVista('CUENTAS');
      setMensaje(null);
      hidratarSesion(res.data.usuario, res.data.cuentas);
    }
  }

  async function ejecutarTransferencia(e: FormEvent) {
    e.preventDefault();
    if (procesando || !cuentaOrigenTx) return;

    const destino = cuentaDestinoTx.trim();
    const valor = valorTx.trim();

    if (!/^\d{6,20}$/.test(destino)) {
      setMensaje({
        tipo: 'error',
        texto: 'Ingresa un número de cuenta destino válido (6 a 20 dígitos).',
      });
      return;
    }
    if (!/^\d+$/.test(valor) || Number(valor) <= 0) {
      setMensaje({
        tipo: 'error',
        texto: 'Ingresa un valor entero en pesos colombianos mayor que cero.',
      });
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await realizarTransferenciaBanca(
      Number(cuentaOrigenTx),
      destino,
      valor,
      descripcionTx.trim(),
    );
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo completar la transferencia.',
      });
      return;
    }

    if (res.data.cuentas) {
      setCuentas(res.data.cuentas);
    }
    if (res.data.transferencia) {
      setUltimoComprobante({
        tipoOperacion: 'TRANSFERENCIA',
        ...res.data.transferencia,
      });
    }
    setCuentaDestinoTx('');
    setValorTx('');
    setDescripcionTx('');
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Transferencia realizada con éxito.',
    });
    if (cuentaSeleccionadaId) {
      void cargarMovimientosCuenta(cuentaSeleccionadaId);
    }
  }

  async function ejecutarActualizarPerfil(e: FormEvent) {
    e.preventDefault();
    if (procesando) return;
    setProcesando(true);
    setMensaje(null);
    const res = await actualizarPerfilBanca({
      nombre: nombrePerfil,
      apellidos: apellidosPerfil,
      correo: correoPerfil,
      telefono: telefonoPerfil,
    });
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo actualizar el perfil.',
      });
      return;
    }
    if (res.data.usuario) {
      setUsuario(res.data.usuario);
    }
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Perfil actualizado correctamente.',
    });
  }

  async function ejecutarCambioClave(e: FormEvent) {
    e.preventDefault();
    if (procesando) return;

    if (!/^\d{7}$/.test(claveActualInput) || !/^\d{7}$/.test(nuevaClaveInput)) {
      setMensaje({
        tipo: 'error',
        texto: 'Las contraseñas deben tener exactamente 7 dígitos numéricos.',
      });
      return;
    }
    if (nuevaClaveInput !== confirmarClaveInput) {
      setMensaje({
        tipo: 'error',
        texto: 'La confirmación no coincide con la nueva contraseña.',
      });
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await cambiarClaveBanca(claveActualInput, nuevaClaveInput);
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo cambiar la contraseña.',
      });
      return;
    }

    setClaveActualInput('');
    setNuevaClaveInput('');
    setConfirmarClaveInput('');
    if (res.data.usuario) {
      setUsuario(res.data.usuario);
    }
    setVista('CUENTAS');
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Contraseña actualizada correctamente.',
    });
  }

  async function manejarCerrarSesion() {
    setProcesando(true);
    await cerrarSesionBanca();
    setProcesando(false);
    setUsuario(null);
    setCuentas([]);
    setMovimientos([]);
    setUltimoComprobante(null);
    setClaveLogin('');
    setVista('CUENTAS');
    setMensaje({
      tipo: 'exito',
      texto: 'Sesión de banca virtual cerrada correctamente.',
    });
  }

  if (cargandoInicial) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
        <div className="h-6 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="h-24 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Banca virtual del cliente
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Consulta tus cuentas, saldo disponible, historial completo de movimientos y realiza transferencias sincronizadas en tiempo real con el cajero y el banco.
          </p>
        </section>

        <section className="max-w-lg bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">
            Iniciar sesión en banca virtual
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Ingresa con tu usuario y contraseña numérica de 7 dígitos.
          </p>

          {mensaje && (
            <div
              role="alert"
              className={`mt-5 rounded-lg border px-4 py-3 text-sm flex items-start gap-2.5 ${
                mensaje.tipo === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : mensaje.tipo === 'advertencia'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {mensaje.tipo === 'exito' ? (
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    mensaje.tipo === 'advertencia'
                      ? 'text-[#D97706]'
                      : 'text-[#DC2626]'
                  }`}
                />
              )}
              <div className="flex-1">
                <span>{mensaje.texto}</span>
                {bloqueoSegundos > 0 && (
                  <span className="block mt-1 font-mono tabular-nums text-xs font-semibold">
                    Desbloqueo en {bloqueoSegundos}s
                  </span>
                )}
              </div>
            </div>
          )}

          <form onSubmit={ejecutarLogin} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="banca-usuario"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Usuario
              </label>
              <input
                id="banca-usuario"
                type="text"
                autoComplete="username"
                placeholder="Ej. nombre.apellido"
                value={usuarioLogin}
                onChange={(e) => setUsuarioLogin(e.target.value)}
                disabled={procesando || bloqueoSegundos > 0}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>

            <div>
              <label
                htmlFor="banca-clave"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Contraseña (7 dígitos numéricos)
              </label>
              <div className="relative">
                <input
                  id="banca-clave"
                  type={mostrarClaveLogin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={7}
                  placeholder="•••••••"
                  value={claveLogin}
                  onChange={(e) =>
                    setClaveLogin(e.target.value.replace(/\D/g, '').slice(0, 7))
                  }
                  disabled={procesando || bloqueoSegundos > 0}
                  className="w-full h-11 pl-3.5 pr-11 rounded-lg border border-slate-300 bg-white font-mono tabular-nums tracking-widest text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                />
                <button
                  type="button"
                  onClick={() => setMostrarClaveLogin((v) => !v)}
                  aria-label={
                    mostrarClaveLogin
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700"
                >
                  {mostrarClaveLogin ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={procesando || bloqueoSegundos > 0}
              className="w-full h-11 rounded-lg bg-[#0B3D6B] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#093259] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D6B] disabled:opacity-50"
            >
              {bloqueoSegundos > 0
                ? `Bloqueado (${bloqueoSegundos}s)`
                : procesando
                  ? 'Ingresando...'
                  : 'Entrar a banca virtual'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  const saldoTotal = cuentas.reduce((sum, c) => sum + c.saldo, 0);
  const cuentasActivas = cuentas.filter((c) => c.estado === 'ACTIVO');

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Hola, {usuario.nombre} {usuario.apellidos}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
            <span>Usuario: {usuario.usuario}</span>
            <span aria-hidden="true">·</span>
            <span>{usuario.correo}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              Saldo consolidado: {pesosCOP(saldoTotal)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={procesando}
          onClick={refrescarDatosBanca}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${procesando ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>Actualizar información</span>
        </button>
      </section>

      {/* Toolbar de navegación interna */}
      <div
        role="toolbar"
        aria-label="Secciones de banca virtual"
        className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-xl print:hidden"
      >
        <button
          type="button"
          disabled={usuario.cambio_clave}
          onClick={() => {
            setMensaje(null);
            setVista('CUENTAS');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-40 ${
            vista === 'CUENTAS'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Cuentas y movimientos</span>
        </button>
        <button
          type="button"
          disabled={usuario.cambio_clave}
          onClick={() => {
            setMensaje(null);
            setVista('TRANSFERIR');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-40 ${
            vista === 'TRANSFERIR'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Transferir</span>
        </button>
        <button
          type="button"
          disabled={usuario.cambio_clave}
          onClick={() => {
            setMensaje(null);
            setVista('PERFIL');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-40 ${
            vista === 'PERFIL'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Datos personales</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setVista('CLAVE');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            vista === 'CLAVE'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Cambiar clave</span>
        </button>
      </div>

      {mensaje && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5 print:hidden ${
            mensaje.tipo === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : mensaje.tipo === 'advertencia'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {mensaje.tipo === 'exito' ? (
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                mensaje.tipo === 'advertencia'
                  ? 'text-[#D97706]'
                  : 'text-[#DC2626]'
              }`}
            />
          )}
          <span className="flex-1">{mensaje.texto}</span>
        </div>
      )}

      {vista === 'CUENTAS' && (
        <div className="space-y-6">
          {/* Tarjetas de cuentas del cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuentas.map((c) => {
              const seleccionada = cuentaSeleccionada?.id_cuenta === c.id_cuenta;
              return (
                <button
                  key={c.id_cuenta}
                  type="button"
                  onClick={() => {
                    setCuentaSeleccionadaId(c.id_cuenta);
                    void cargarMovimientosCuenta(c.id_cuenta);
                  }}
                  className={`text-left rounded-xl border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D6B] ${
                    seleccionada
                      ? 'bg-white border-[#0B3D6B] ring-1 ring-[#0B3D6B]'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-500">
                      Cuenta {c.tipo_cuenta}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        c.estado === 'ACTIVO'
                          ? 'text-[#16A34A]'
                          : c.estado === 'BLOQUEADO'
                            ? 'text-[#D97706]'
                            : 'text-[#DC2626]'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      {c.estado}
                    </span>
                  </div>
                  <p className="font-mono tabular-nums text-sm font-semibold text-slate-900 mt-1">
                    {c.numero_cuenta}
                  </p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-3">
                    {pesosCOP(c.saldo)}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    {seleccionada
                      ? 'Mostrando movimientos de esta cuenta'
                      : 'Haz clic para ver movimientos'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Historial de movimientos de la cuenta seleccionada */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#0B3D6B]" aria-hidden="true" />
                  <span>Historial de movimientos</span>
                </h2>
                {cuentaSeleccionada && (
                  <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                    Cuenta {cuentaSeleccionada.numero_cuenta} · Saldo actual:{' '}
                    <span className="font-semibold text-slate-900">
                      {pesosCOP(cuentaSeleccionada.saldo)}
                    </span>
                  </p>
                )}
              </div>
              {cuentaSeleccionada && (
                <button
                  type="button"
                  disabled={cargandoMovimientos}
                  onClick={() =>
                    cargarMovimientosCuenta(cuentaSeleccionada.id_cuenta)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap hover:bg-slate-100"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      cargandoMovimientos ? 'animate-spin' : ''
                    }`}
                    aria-hidden="true"
                  />
                  <span>Actualizar</span>
                </button>
              )}
            </div>

            {cargandoMovimientos ? (
              <div className="space-y-2 py-2" aria-busy="true">
                {[1, 2, 3, 4].map((r) => (
                  <div
                    key={r}
                    className="h-10 w-full bg-slate-100 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : movimientos.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No hay movimientos registrados para esta cuenta.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Fecha</th>
                      <th className="py-2.5 pr-4 font-medium">Tipo</th>
                      <th className="py-2.5 pr-4 font-medium">Descripción</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Valor</th>
                      <th className="py-2.5 font-medium text-right">
                        Saldo resultante
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movimientos.map((m) => (
                      <tr key={m.id_movimiento} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                          {formatearFecha(m.fecha)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                          {nombreTipoMovimiento(m.tipo)}
                        </td>
                        <td className="py-3 pr-4 text-slate-600 max-w-xs truncate">
                          {m.descripcion || '—'}
                        </td>
                        <td
                          className={`py-3 pr-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            m.valor < 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                          }`}
                        >
                          {m.valor > 0 ? '+' : ''}
                          {pesosCOP(m.valor)}
                        </td>
                        <td className="py-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                          {pesosCOP(m.saldo_resultante)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {vista === 'TRANSFERIR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 print:hidden">
            <h2 className="text-lg font-semibold text-slate-900">
              Transferir dinero a otra cuenta
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              El movimiento quedará registrado de inmediato tanto en tu cuenta como en la del destinatario.
            </p>

            <form onSubmit={ejecutarTransferencia} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="banca-tx-origen"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Cuenta de origen
                </label>
                <select
                  id="banca-tx-origen"
                  value={cuentaOrigenTx}
                  onChange={(e) => setCuentaOrigenTx(Number(e.target.value))}
                  disabled={procesando}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                >
                  {cuentasActivas.map((c) => (
                    <option key={c.id_cuenta} value={c.id_cuenta}>
                      {c.numero_cuenta} ({c.tipo_cuenta}) — Disponible:{' '}
                      {pesosCOP(c.saldo)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="banca-tx-destino"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Número de cuenta destino
                </label>
                <input
                  id="banca-tx-destino"
                  type="text"
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="Ej. 1001000003"
                  value={cuentaDestinoTx}
                  onChange={(e) =>
                    setCuentaDestinoTx(e.target.value.replace(/\D/g, ''))
                  }
                  disabled={procesando}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                />
              </div>

              <div>
                <label
                  htmlFor="banca-tx-valor"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Valor a transferir (pesos colombianos, sin decimales)
                </label>
                <input
                  id="banca-tx-valor"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 150000"
                  value={valorTx}
                  onChange={(e) =>
                    setValorTx(e.target.value.replace(/\D/g, ''))
                  }
                  disabled={procesando}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                />
                <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  Equivalente: {valorTx ? pesosCOP(Number(valorTx)) : '$ 0'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="banca-tx-desc"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Descripción (opcional)
                </label>
                <input
                  id="banca-tx-desc"
                  type="text"
                  maxLength={100}
                  placeholder="Ej. Pago de servicios"
                  value={descripcionTx}
                  onChange={(e) => setDescripcionTx(e.target.value)}
                  disabled={procesando}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                />
              </div>

              <button
                type="submit"
                disabled={procesando || !cuentaDestinoTx || !valorTx}
                className="w-full h-11 rounded-lg bg-[#16A34A] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#15803D] disabled:opacity-50"
              >
                {procesando
                  ? 'Procesando transferencia...'
                  : 'Confirmar transferencia'}
              </button>
            </form>
          </section>

          <div className="lg:col-span-5">
            <ComprobanteOperacion comprobante={ultimoComprobante} />
          </div>
        </div>
      )}

      {vista === 'PERFIL' && (
        <section className="max-w-xl bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Información personal
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Puedes actualizar tus datos de contacto. Tu usuario, rol, número de cuenta y saldo no se modifican desde este formulario.
          </p>

          <form onSubmit={ejecutarActualizarPerfil} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="perfil-nombre"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Nombre
                </label>
                <input
                  id="perfil-nombre"
                  type="text"
                  value={nombrePerfil}
                  onChange={(e) => setNombrePerfil(e.target.value)}
                  disabled={procesando}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                />
              </div>
              <div>
                <label
                  htmlFor="perfil-apellidos"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Apellidos
                </label>
                <input
                  id="perfil-apellidos"
                  type="text"
                  value={apellidosPerfil}
                  onChange={(e) => setApellidosPerfil(e.target.value)}
                  disabled={procesando}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="perfil-correo"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Correo electrónico
              </label>
              <input
                id="perfil-correo"
                type="email"
                value={correoPerfil}
                onChange={(e) => setCorreoPerfil(e.target.value)}
                disabled={procesando}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>

            <div>
              <label
                htmlFor="perfil-telefono"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Teléfono
              </label>
              <input
                id="perfil-telefono"
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={telefonoPerfil}
                onChange={(e) =>
                  setTelefonoPerfil(e.target.value.replace(/\D/g, ''))
                }
                disabled={procesando}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>

            <button
              type="submit"
              disabled={procesando}
              className="h-11 px-5 rounded-lg bg-[#0B3D6B] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#093259] disabled:opacity-50"
            >
              {procesando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </section>
      )}

      {vista === 'CLAVE' && (
        <section className="max-w-lg bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Cambiar contraseña / PIN
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            La contraseña debe ser de exactamente 7 dígitos numéricos y también actualiza tu PIN del cajero automático.
          </p>

          <form onSubmit={ejecutarCambioClave} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="clave-actual"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Contraseña actual (7 dígitos)
              </label>
              <input
                id="clave-actual"
                type="password"
                inputMode="numeric"
                maxLength={7}
                value={claveActualInput}
                onChange={(e) =>
                  setClaveActualInput(
                    e.target.value.replace(/\D/g, '').slice(0, 7),
                  )
                }
                disabled={procesando}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums tracking-widest text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>

            <div>
              <label
                htmlFor="clave-nueva"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Nueva contraseña (7 dígitos)
              </label>
              <input
                id="clave-nueva"
                type="password"
                inputMode="numeric"
                maxLength={7}
                value={nuevaClaveInput}
                onChange={(e) =>
                  setNuevaClaveInput(
                    e.target.value.replace(/\D/g, '').slice(0, 7),
                  )
                }
                disabled={procesando}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums tracking-widest text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>

            <div>
              <label
                htmlFor="clave-confirmar"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Confirmar nueva contraseña
              </label>
              <input
                id="clave-confirmar"
                type="password"
                inputMode="numeric"
                maxLength={7}
                value={confirmarClaveInput}
                onChange={(e) =>
                  setConfirmarClaveInput(
                    e.target.value.replace(/\D/g, '').slice(0, 7),
                  )
                }
                disabled={procesando}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums tracking-widest text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>

            <button
              type="submit"
              disabled={procesando}
              className="h-11 px-5 rounded-lg bg-[#0B3D6B] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#093259] disabled:opacity-50"
            >
              {procesando ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
