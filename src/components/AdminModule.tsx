import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  actualizarClienteAdmin,
  cambiarEstadoCuentaAdmin,
  cerrarSesionAdmin,
  crearClienteAdmin,
  crearCuentaAdicionalAdmin,
  iniciarSesionAdmin,
  obtenerResumenAdmin,
  obtenerSesionAdmin,
  realizarConsignacionAdmin,
} from '../services/adminApi';
import type { EstadoCuenta } from '../types/cajero';
import type {
  AdminDashboardStats,
  ClienteConCuentas,
  CuentaConTitular,
  EstadoCuentaFiltro,
  MovimientoGeneral,
  UsuarioPublico,
} from '../types/banco';
import {
  formatearFecha,
  nombreTipoMovimiento,
  pesosCOP,
} from '../utils/formato';

type VistaAdmin = 'CLIENTES' | 'NUEVO_CLIENTE' | 'CUENTAS' | 'MOVIMIENTOS';

interface MensajeSistema {
  tipo: 'error' | 'exito' | 'advertencia';
  texto: string;
}

interface AdminModuleProps {
  onEstadoSesionChange?: (activa: boolean, cerrarFn?: () => void) => void;
  resetSignal?: number;
}

export function AdminModule({
  onEstadoSesionChange,
  resetSignal = 0,
}: AdminModuleProps) {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [admin, setAdmin] = useState<UsuarioPublico | null>(null);
  const [vista, setVista] = useState<VistaAdmin>('CLIENTES');
  const [mensaje, setMensaje] = useState<MensajeSistema | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Login
  const [usuarioLogin, setUsuarioLogin] = useState('');
  const [claveLogin, setClaveLogin] = useState('');
  const [mostrarClaveLogin, setMostrarClaveLogin] = useState(false);
  const [bloqueoSegundos, setBloqueoSegundos] = useState(0);

  // Datos compartidos del banco
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [clientes, setClientes] = useState<ClienteConCuentas[]>([]);
  const [cuentas, setCuentas] = useState<CuentaConTitular[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoGeneral[]>([]);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  // Búsquedas y filtros
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [filtroEstadoCuenta, setFiltroEstadoCuenta] =
    useState<EstadoCuentaFiltro>('TODAS');
  const [filtroMovimientos, setFiltroMovimientos] = useState('');

  // Detalle y edición de cliente seleccionado
  const [clienteDetalleId, setClienteDetalleId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editApellidos, setEditApellidos] = useState('');
  const [editUsuario, setEditUsuario] = useState('');
  const [editCorreo, setEditCorreo] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editClaveTemporal, setEditClaveTemporal] = useState('');
  const [mostrarEditClave, setMostrarEditClave] = useState(false);
  const [editExigirCambioClave, setEditExigirCambioClave] = useState(true);
  const [saldoExtraCuenta, setSaldoExtraCuenta] = useState('');

  const detalleClienteRef = useRef<HTMLElement | null>(null);
  const editNombreInputRef = useRef<HTMLInputElement | null>(null);

  // Crear cliente
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoApellidos, setNuevoApellidos] = useState('');
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [nuevoCorreo, setNuevoCorreo] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevaClaveTemp, setNuevaClaveTemp] = useState('');
  const [nuevoSaldoInicial, setNuevoSaldoInicial] = useState('');

  // Consignaciones
  const [cuentaConsignar, setCuentaConsignar] = useState('');
  const [valorConsignar, setValorConsignar] = useState('');
  const [descConsignar, setDescConsignar] = useState('');

  const clienteDetalle = useMemo(
    () => clientes.find((c) => c.id_usuario === clienteDetalleId) ?? null,
    [clientes, clienteDetalleId],
  );

  useEffect(() => {
    let activo = true;
    (async () => {
      const res = await obtenerSesionAdmin();
      if (!activo) return;
      if (res.ok && res.data.admin) {
        setAdmin(res.data.admin);
        await cargarResumen();
      } else {
        setAdmin(null);
      }
      setCargandoInicial(false);
    })();
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (resetSignal > 0 && !admin) {
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
              'Tiempo de espera finalizado. Ya puedes volver a intentar ingresar.',
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bloqueoSegundos]);

  useEffect(() => {
    onEstadoSesionChange?.(Boolean(admin), manejarCerrarSesion);
  }, [admin]);

  useEffect(() => {
    if (clienteDetalle) {
      setEditNombre(clienteDetalle.nombre);
      setEditApellidos(clienteDetalle.apellidos);
      setEditUsuario(clienteDetalle.usuario);
      setEditCorreo(clienteDetalle.correo);
      setEditTelefono(clienteDetalle.telefono || '');
      setEditClaveTemporal('');
      setMostrarEditClave(false);
      setEditExigirCambioClave(true);
    }
  }, [clienteDetalle]);

  function manejarSesionCaida(res: {
    status: number;
    data: { sesionCerrada?: boolean; mensaje?: string };
  }): boolean {
    if (res.data.sesionCerrada || res.status === 401 || res.status === 403) {
      setAdmin(null);
      setStats(null);
      setClientes([]);
      setCuentas([]);
      setMovimientos([]);
      setMensaje({
        tipo: 'error',
        texto:
          res.data.mensaje ||
          'Tu sesión administrativa expiró o fue cerrada.',
      });
      return true;
    }
    return false;
  }

  async function cargarResumen() {
    setCargandoResumen(true);
    const res = await obtenerResumenAdmin();
    setCargandoResumen(false);
    if (!res.ok) {
      manejarSesionCaida(res);
      return;
    }
    setStats(res.data.stats);
    setClientes(res.data.clientes || []);
    setCuentas(res.data.cuentas || []);
    setMovimientos(res.data.movimientos || []);
  }

  async function ejecutarLogin(e: FormEvent) {
    e.preventDefault();
    if (procesando || bloqueoSegundos > 0) return;

    const user = usuarioLogin.trim();
    const pass = claveLogin.trim();
    if (!user) {
      setMensaje({ tipo: 'error', texto: 'Ingresa el usuario administrativo.' });
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
    const res = await iniciarSesionAdmin(user, pass);
    setProcesando(false);
    setClaveLogin('');

    if (!res.ok) {
      if (res.data.bloqueoRestanteSegundos) {
        setBloqueoSegundos(res.data.bloqueoRestanteSegundos);
      }
      setMensaje({
        tipo: res.status === 429 ? 'advertencia' : 'error',
        texto: res.data.mensaje || 'Credenciales inválidas.',
      });
      return;
    }

    if (res.data.admin) {
      setAdmin(res.data.admin);
      setMensaje(null);
      setVista('CLIENTES');
      await cargarResumen();
    }
  }

  async function ejecutarCrearCliente(e: FormEvent) {
    e.preventDefault();
    if (procesando) return;

    if (!/^\d{7}$/.test(nuevaClaveTemp)) {
      setMensaje({
        tipo: 'error',
        texto: 'La clave temporal debe tener exactamente 7 dígitos numéricos.',
      });
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await crearClienteAdmin({
      nombre: nuevoNombre,
      apellidos: nuevoApellidos,
      usuario: nuevoUsuario,
      correo: nuevoCorreo,
      telefono: nuevoTelefono,
      claveTemporal: nuevaClaveTemp,
      saldoInicial: nuevoSaldoInicial || '0',
    });
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo crear el cliente.',
      });
      return;
    }

    setNuevoNombre('');
    setNuevoApellidos('');
    setNuevoUsuario('');
    setNuevoCorreo('');
    setNuevoTelefono('');
    setNuevaClaveTemp('');
    setNuevoSaldoInicial('');
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Cliente creado correctamente.',
    });
    await cargarResumen();
    if (res.data.cliente) {
      setClienteDetalleId(res.data.cliente.id_usuario);
      setVista('CLIENTES');
    }
  }

  function abrirEdicionCliente(idUsuario: number) {
    if (clienteDetalleId === idUsuario) {
      setClienteDetalleId(null);
      return;
    }
    setMensaje(null);
    setClienteDetalleId(idUsuario);
    window.setTimeout(() => {
      detalleClienteRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      editNombreInputRef.current?.focus();
    }, 50);
  }

  async function ejecutarEditarCliente(e: FormEvent) {
    e.preventDefault();
    if (procesando || !clienteDetalle) return;

    if (editClaveTemporal && !/^\d{7}$/.test(editClaveTemporal)) {
      setMensaje({
        tipo: 'error',
        texto:
          'Si deseas cambiar la contraseña / PIN del cliente, debe tener exactamente 7 dígitos numéricos.',
      });
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await actualizarClienteAdmin(clienteDetalle.id_usuario, {
      nombre: editNombre,
      apellidos: editApellidos,
      usuario: editUsuario,
      correo: editCorreo,
      telefono: editTelefono,
      ...(editClaveTemporal
        ? {
            claveTemporal: editClaveTemporal,
            exigirCambioClave: editExigirCambioClave,
          }
        : {}),
    });
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo actualizar el cliente.',
      });
      return;
    }

    setEditClaveTemporal('');
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Datos del cliente actualizados.',
    });
    await cargarResumen();
  }

  async function ejecutarCrearCuentaExtra(e: FormEvent) {
    e.preventDefault();
    if (procesando || !clienteDetalle) return;

    setProcesando(true);
    setMensaje(null);
    const res = await crearCuentaAdicionalAdmin(
      clienteDetalle.id_usuario,
      saldoExtraCuenta || '0',
    );
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo crear la cuenta adicional.',
      });
      return;
    }

    setSaldoExtraCuenta('');
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Cuenta adicional creada.',
    });
    await cargarResumen();
  }

  async function manejarCambioEstadoCuenta(
    idCuenta: number,
    estado: EstadoCuenta,
  ) {
    if (procesando) return;
    setProcesando(true);
    setMensaje(null);
    const res = await cambiarEstadoCuentaAdmin(idCuenta, estado);
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo cambiar el estado de la cuenta.',
      });
      return;
    }

    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Estado actualizado.',
    });
    await cargarResumen();
  }

  async function ejecutarConsignacion(e: FormEvent) {
    e.preventDefault();
    if (procesando) return;

    setProcesando(true);
    setMensaje(null);
    const res = await realizarConsignacionAdmin(
      cuentaConsignar,
      valorConsignar,
      descConsignar,
    );
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo completar la consignación.',
      });
      return;
    }

    setValorConsignar('');
    setDescConsignar('');
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Consignación realizada con éxito.',
    });
    await cargarResumen();
  }

  async function manejarCerrarSesion() {
    setProcesando(true);
    await cerrarSesionAdmin();
    setProcesando(false);
    setAdmin(null);
    setStats(null);
    setClientes([]);
    setCuentas([]);
    setMovimientos([]);
    setClaveLogin('');
    setClienteDetalleId(null);
    setMensaje({
      tipo: 'exito',
      texto: 'Sesión administrativa cerrada.',
    });
  }

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        `${c.nombre} ${c.apellidos}`.toLowerCase().includes(q) ||
        c.usuario.toLowerCase().includes(q) ||
        c.correo.toLowerCase().includes(q) ||
        c.cuentas.some((cta) => cta.numero_cuenta.includes(q)),
    );
  }, [clientes, busquedaCliente]);

  const cuentasFiltradas = useMemo(() => {
    if (filtroEstadoCuenta === 'TODAS') return cuentas;
    return cuentas.filter((c) => c.estado === filtroEstadoCuenta);
  }, [cuentas, filtroEstadoCuenta]);

  const movimientosFiltrados = useMemo(() => {
    const q = filtroMovimientos.trim().toLowerCase();
    if (!q) return movimientos;
    return movimientos.filter(
      (m) =>
        m.numero_cuenta.toLowerCase().includes(q) ||
        m.titular.toLowerCase().includes(q) ||
        nombreTipoMovimiento(m.tipo).toLowerCase().includes(q) ||
        (m.descripcion ?? '').toLowerCase().includes(q),
    );
  }, [movimientos, filtroMovimientos]);

  if (cargandoInicial) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
        <div className="h-6 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="h-24 w-full bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Módulo administrativo del banco
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Panel de gestión para crear clientes, administrar cuentas y estados, realizar consignaciones y consultar el historial general del banco.
          </p>
        </section>

        <section className="max-w-lg bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">
            Acceso del administrador
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Ingresa con tu usuario administrativo y clave de 7 dígitos numéricos.
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
                htmlFor="admin-usuario"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Usuario
              </label>
              <input
                id="admin-usuario"
                type="text"
                autoComplete="username"
                placeholder="Usuario administrativo"
                value={usuarioLogin}
                onChange={(e) => setUsuarioLogin(e.target.value)}
                disabled={procesando || bloqueoSegundos > 0}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-clave"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Clave (7 dígitos numéricos)
              </label>
              <div className="relative">
                <input
                  id="admin-clave"
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
                    mostrarClaveLogin ? 'Ocultar clave' : 'Mostrar clave'
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
                  ? 'Verificando...'
                  : 'Ingresar al panel administrativo'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado administrativo */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Panel administrativo del banco
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
            <span className="font-medium text-slate-900">
              {admin.nombre} {admin.apellidos}
            </span>
            <span aria-hidden="true">·</span>
            <span>{admin.usuario}</span>
            <span aria-hidden="true">·</span>
            <span>Base de datos unificada</span>
          </div>
        </div>

        <button
          type="button"
          disabled={cargandoResumen || procesando}
          onClick={cargarResumen}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${cargandoResumen ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>Actualizar datos</span>
        </button>
      </section>

      {/* 4 Indicadores principales del dashboard */}
      {stats && (
        <section
          aria-label="Resumen general del banco"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">
              Total de clientes
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
              {stats.totalClientes}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {stats.totalCuentas} cuentas registradas
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Cuentas activas</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#16A34A] mt-1.5">
              {stats.cuentasActivas}
            </p>
            <p className="text-xs text-slate-500 mt-1">Habilitadas para operar</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">
              Cuentas bloqueadas
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#D97706] mt-1.5">
              {stats.cuentasBloqueadas}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {stats.cuentasInactivas} inactivas
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">
              Suma total de saldos
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
              {pesosCOP(stats.sumaTotalSaldos)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Pesos colombianos</p>
          </div>
        </section>
      )}

      {/* Barra de secciones */}
      <div
        role="toolbar"
        aria-label="Herramientas administrativas"
        className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-xl"
      >
        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setVista('CLIENTES');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            vista === 'CLIENTES'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Clientes</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setVista('NUEVO_CLIENTE');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            vista === 'NUEVO_CLIENTE'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Crear cliente</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setVista('CUENTAS');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            vista === 'CUENTAS'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Cuentas y consignaciones</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMensaje(null);
            setVista('MOVIMIENTOS');
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            vista === 'MOVIMIENTOS'
              ? 'bg-[#0B3D6B] text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Movimientos generales</span>
        </button>
      </div>

      {mensaje && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5 ${
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

      {/* Vista 1: Listado, búsqueda y detalle de clientes */}
      {vista === 'CLIENTES' && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Clientes registrados ({clientesFiltrados.length})
              </h2>
              <div className="relative w-full sm:w-72">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder="Buscar nombre, usuario o cuenta..."
                  value={busquedaCliente}
                  onChange={(e) => setBusquedaCliente(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                />
              </div>
            </div>

            {clientesFiltrados.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No se encontraron clientes que coincidan con la búsqueda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Cliente</th>
                      <th className="py-2.5 pr-4 font-medium">Usuario</th>
                      <th className="py-2.5 pr-4 font-medium">Correo</th>
                      <th className="py-2.5 pr-4 font-medium text-right">
                        Cuentas
                      </th>
                      <th className="py-2.5 pr-4 font-medium text-right">
                        Saldo total
                      </th>
                      <th className="py-2.5 pr-4 font-medium">Estado</th>
                      <th className="py-2.5 font-medium text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesFiltrados.map((c) => {
                      const seleccionado = clienteDetalleId === c.id_usuario;
                      const tieneActiva = c.cuentas.some(
                        (cta) => cta.estado === 'ACTIVO',
                      );
                      const tieneBloqueada = c.cuentas.some(
                        (cta) => cta.estado === 'BLOQUEADO',
                      );
                      const estadoResumen = tieneActiva
                        ? 'ACTIVO'
                        : tieneBloqueada
                          ? 'BLOQUEADO'
                          : 'INACTIVO';
                      return (
                        <tr
                          key={c.id_usuario}
                          className={
                            seleccionado ? 'bg-slate-50' : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                            {c.nombre} {c.apellidos}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {c.usuario}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">
                            {c.correo}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-700">
                            {c.cuentas.length}
                          </td>
                          <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            {pesosCOP(c.saldo_total)}
                          </td>
                          <td
                            className={`py-3 pr-4 text-xs font-semibold whitespace-nowrap ${
                              estadoResumen === 'ACTIVO'
                                ? 'text-[#16A34A]'
                                : estadoResumen === 'BLOQUEADO'
                                  ? 'text-[#D97706]'
                                  : 'text-[#DC2626]'
                            }`}
                          >
                            {estadoResumen}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => abrirEdicionCliente(c.id_usuario)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                                seleccionado
                                  ? 'border-[#0B3D6B] bg-[#0B3D6B] text-white'
                                  : 'border-slate-300 bg-white text-[#0B3D6B] hover:bg-slate-100'
                              }`}
                            >
                              {seleccionado ? (
                                <>
                                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Cerrar</span>
                                </>
                              ) : (
                                <>
                                  <Pencil
                                    className="w-3.5 h-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Editar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Detalle completo y edición del cliente seleccionado */}
          {clienteDetalle && (
            <section
              ref={detalleClienteRef}
              className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6 scroll-mt-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {clienteDetalle.nombre} {clienteDetalle.apellidos}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Usuario: {clienteDetalle.usuario} · Cliente desde{' '}
                    <span className="font-mono tabular-nums">
                      {formatearFecha(clienteDetalle.fecha_creacion)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                    Saldo total: {pesosCOP(clienteDetalle.saldo_total)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setClienteDetalleId(null)}
                    aria-label="Cerrar edición de cliente"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cerrar</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Editar información del cliente */}
                <form
                  onSubmit={ejecutarEditarCliente}
                  className="lg:col-span-5 space-y-3.5"
                >
                  <h4 className="text-sm font-semibold text-slate-900">
                    Editar información del cliente
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Nombre
                      </label>
                      <input
                        ref={editNombreInputRef}
                        type="text"
                        required
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Apellidos
                      </label>
                      <input
                        type="text"
                        required
                        value={editApellidos}
                        onChange={(e) => setEditApellidos(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Usuario
                      </label>
                      <input
                        type="text"
                        required
                        value={editUsuario}
                        onChange={(e) => setEditUsuario(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={15}
                        value={editTelefono}
                        onChange={(e) =>
                          setEditTelefono(e.target.value.replace(/\D/g, ''))
                        }
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      required
                      value={editCorreo}
                      onChange={(e) => setEditCorreo(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                    />
                  </div>
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Restablecer clave / PIN (7 dígitos, opcional)
                    </label>
                    <div className="relative">
                      <input
                        type={mostrarEditClave ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={7}
                        autoComplete="new-password"
                        placeholder="Dejar vacío para mantener la actual"
                        value={editClaveTemporal}
                        onChange={(e) =>
                          setEditClaveTemporal(
                            e.target.value.replace(/\D/g, '').slice(0, 7),
                          )
                        }
                        className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarEditClave((v) => !v)}
                        aria-label={
                          mostrarEditClave ? 'Ocultar clave' : 'Mostrar clave'
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                      >
                        {mostrarEditClave ? (
                          <EyeOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {editClaveTemporal.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={editExigirCambioClave}
                          onChange={(e) =>
                            setEditExigirCambioClave(e.target.checked)
                          }
                          className="rounded border-slate-300 text-[#0B3D6B] focus:ring-[#0B3D6B]"
                        />
                        <span>
                          Pedir al cliente que cambie esta clave en su próximo ingreso a banca virtual
                        </span>
                      </label>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={procesando}
                      className="h-10 px-4 rounded-lg bg-[#0B3D6B] text-white text-xs font-semibold whitespace-nowrap hover:bg-[#093259] disabled:opacity-50"
                    >
                      {procesando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClienteDetalleId(null)}
                      className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 whitespace-nowrap hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>

                {/* Cuentas del cliente */}
                <div className="lg:col-span-7 space-y-4">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Cuentas bancarias asociadas
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Número</th>
                          <th className="py-2 pr-3 font-medium text-right">
                            Saldo
                          </th>
                          <th className="py-2 pr-3 font-medium">Estado</th>
                          <th className="py-2 font-medium text-right">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clienteDetalle.cuentas.map((cta) => (
                          <tr key={cta.id_cuenta}>
                            <td className="py-2.5 pr-3 font-mono tabular-nums font-medium text-slate-900">
                              {cta.numero_cuenta}
                            </td>
                            <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {pesosCOP(cta.saldo)}
                            </td>
                            <td className="py-2.5 pr-3">
                              <select
                                aria-label={`Estado de cuenta ${cta.numero_cuenta}`}
                                value={cta.estado}
                                disabled={procesando}
                                onChange={(e) =>
                                  manejarCambioEstadoCuenta(
                                    cta.id_cuenta,
                                    e.target.value as EstadoCuenta,
                                  )
                                }
                                className={`h-8 px-2 rounded border text-xs font-semibold bg-white ${
                                  cta.estado === 'ACTIVO'
                                    ? 'border-emerald-300 text-[#16A34A]'
                                    : cta.estado === 'BLOQUEADO'
                                      ? 'border-amber-300 text-[#D97706]'
                                      : 'border-red-300 text-[#DC2626]'
                                }`}
                              >
                                <option value="ACTIVO">ACTIVO</option>
                                <option value="BLOQUEADO">BLOQUEADO</option>
                                <option value="INACTIVO">INACTIVO</option>
                              </select>
                            </td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setCuentaConsignar(cta.numero_cuenta);
                                  setVista('CUENTAS');
                                }}
                                className="px-2.5 py-1 rounded border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Consignar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Abrir cuenta de ahorros adicional */}
                  <form
                    onSubmit={ejecutarCrearCuentaExtra}
                    className="pt-3 border-t border-slate-200 flex flex-wrap items-end gap-3"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Abrir nueva cuenta de ahorros (saldo inicial opcional)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={saldoExtraCuenta}
                        onChange={(e) =>
                          setSaldoExtraCuenta(e.target.value.replace(/\D/g, ''))
                        }
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={procesando}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#16A34A] text-white text-xs font-semibold whitespace-nowrap hover:bg-[#15803D]"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Agregar cuenta</span>
                    </button>
                  </form>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Vista 2: Crear nuevo cliente */}
      {vista === 'NUEVO_CLIENTE' && (
        <section className="max-w-2xl bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Registrar nuevo cliente
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Se creará automáticamente una cuenta de ahorros activa. El cliente deberá cambiar la clave temporal en su primer ingreso a la banca virtual.
          </p>

          <form onSubmit={ejecutarCrearCliente} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Apellidos
                </label>
                <input
                  type="text"
                  required
                  value={nuevoApellidos}
                  onChange={(e) => setNuevoApellidos(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Usuario
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. camilo.diaz"
                  value={nuevoUsuario}
                  onChange={(e) => setNuevoUsuario(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={nuevoCorreo}
                  onChange={(e) => setNuevoCorreo(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Teléfono (opcional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={15}
                  value={nuevoTelefono}
                  onChange={(e) =>
                    setNuevoTelefono(e.target.value.replace(/\D/g, ''))
                  }
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Clave temporal (7 dígitos)
                </label>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="•••••••"
                  value={nuevaClaveTemp}
                  onChange={(e) =>
                    setNuevaClaveTemp(
                      e.target.value.replace(/\D/g, '').slice(0, 7),
                    )
                  }
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums tracking-widest text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Saldo inicial (COP)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={nuevoSaldoInicial}
                  onChange={(e) =>
                    setNuevoSaldoInicial(e.target.value.replace(/\D/g, ''))
                  }
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={procesando}
              className="h-11 px-5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#15803D] disabled:opacity-50"
            >
              {procesando ? 'Registrando...' : 'Crear cliente y cuenta'}
            </button>
          </form>
        </section>
      )}

      {/* Vista 3: Consignaciones y gestión de cuentas */}
      {vista === 'CUENTAS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Realizar consignación */}
          <section className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ArrowDownToLine
                className="w-4 h-4 text-[#16A34A]"
                aria-hidden="true"
              />
              <span>Realizar consignación</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              El depósito se refleja de inmediato en la banca virtual y el cajero del cliente.
            </p>

            <form onSubmit={ejecutarConsignacion} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Número de cuenta
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="Ej. 1001000001"
                  value={cuentaConsignar}
                  onChange={(e) =>
                    setCuentaConsignar(e.target.value.replace(/\D/g, ''))
                  }
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Valor (pesos colombianos, sin decimales)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 250000"
                  value={valorConsignar}
                  onChange={(e) =>
                    setValorConsignar(e.target.value.replace(/\D/g, ''))
                  }
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 font-mono tabular-nums text-sm text-slate-900"
                />
                <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  {valorConsignar ? pesosCOP(Number(valorConsignar)) : '$ 0'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ej. Consignación en oficina"
                  value={descConsignar}
                  onChange={(e) => setDescConsignar(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={procesando || !cuentaConsignar || !valorConsignar}
                className="w-full h-11 rounded-lg bg-[#16A34A] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#15803D] disabled:opacity-50"
              >
                {procesando ? 'Consignando...' : 'Confirmar consignación'}
              </button>
            </form>
          </section>

          {/* Listado general de cuentas */}
          <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Cuentas bancarias ({cuentasFiltradas.length})
              </h2>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  ['TODAS', 'ACTIVO', 'BLOQUEADO', 'INACTIVO'] as EstadoCuentaFiltro[]
                ).map((estado) => (
                  <button
                    key={estado}
                    type="button"
                    onClick={() => setFiltroEstadoCuenta(estado)}
                    className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      filtroEstadoCuenta === estado
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {estado}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-3 font-medium">Número</th>
                    <th className="py-2.5 pr-3 font-medium">Titular</th>
                    <th className="py-2.5 pr-3 font-medium">Tipo</th>
                    <th className="py-2.5 pr-3 font-medium text-right">Saldo</th>
                    <th className="py-2.5 pr-3 font-medium">Estado</th>
                    <th className="py-2.5 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cuentasFiltradas.map((cta) => (
                    <tr key={cta.id_cuenta} className="hover:bg-slate-50">
                      <td className="py-3 pr-3 font-mono tabular-nums font-medium text-slate-900">
                        {cta.numero_cuenta}
                      </td>
                      <td className="py-3 pr-3 text-slate-700 whitespace-nowrap">
                        {cta.titular}
                      </td>
                      <td className="py-3 pr-3 text-slate-500">
                        {cta.tipo_cuenta}
                      </td>
                      <td className="py-3 pr-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {pesosCOP(cta.saldo)}
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          aria-label={`Cambiar estado cuenta ${cta.numero_cuenta}`}
                          value={cta.estado}
                          disabled={procesando}
                          onChange={(e) =>
                            manejarCambioEstadoCuenta(
                              cta.id_cuenta,
                              e.target.value as EstadoCuenta,
                            )
                          }
                          className={`h-8 px-2 rounded border text-xs font-semibold bg-white ${
                            cta.estado === 'ACTIVO'
                              ? 'border-emerald-300 text-[#16A34A]'
                              : cta.estado === 'BLOQUEADO'
                                ? 'border-amber-300 text-[#D97706]'
                                : 'border-red-300 text-[#DC2626]'
                          }`}
                        >
                          <option value="ACTIVO">ACTIVO</option>
                          <option value="BLOQUEADO">BLOQUEADO</option>
                          <option value="INACTIVO">INACTIVO</option>
                        </select>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setCuentaConsignar(cta.numero_cuenta)}
                          className="px-2.5 py-1 rounded border border-slate-300 text-xs font-medium text-[#0B3D6B] hover:bg-slate-100"
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Vista 4: Historial general de movimientos */}
      {vista === 'MOVIMIENTOS' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Historial general de movimientos ({movimientosFiltrados.length})
            </h2>
            <div className="relative w-full sm:w-72">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Filtrar por cuenta, titular o tipo..."
                value={filtroMovimientos}
                onChange={(e) => setFiltroMovimientos(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D6B]"
              />
            </div>
          </div>

          {movimientosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No hay movimientos que coincidan con el filtro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4 font-medium">Fecha</th>
                    <th className="py-2.5 pr-4 font-medium">Cuenta</th>
                    <th className="py-2.5 pr-4 font-medium">Titular</th>
                    <th className="py-2.5 pr-4 font-medium">Tipo</th>
                    <th className="py-2.5 pr-4 font-medium">Descripción</th>
                    <th className="py-2.5 pr-4 font-medium text-right">Valor</th>
                    <th className="py-2.5 font-medium text-right">
                      Saldo resultante
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movimientosFiltrados.map((m) => (
                    <tr key={m.id_movimiento} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                        {formatearFecha(m.fecha)}
                      </td>
                      <td className="py-3 pr-4 font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {m.numero_cuenta}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">
                        {m.titular}
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
      )}
    </div>
  );
}
