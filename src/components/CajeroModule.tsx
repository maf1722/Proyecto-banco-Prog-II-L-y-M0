import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import {
  actualizarPerfilCajero,
  cambiarClaveCajero,
  cerrarOperacionCajero,
  consultarMovimientosCajero,
  consultarSaldoCajero,
  iniciarSesionCajero,
  obtenerSesionCajero,
  realizarRetiroCajero,
  realizarTransferenciaCajero,
} from '../services/cajeroApi';
import { ComprobanteOperacion } from './ComprobanteOperacion';
import { TecladoNumerico } from './TecladoNumerico';
import type {
  ComprobanteOperacionData,
  CuentaCajero,
  MovimientoCajero,
  PantallaCajero,
  TitularCajero,
} from '../types/cajero';
import {
  formatearFecha,
  nombreTipoMovimiento,
  pesosCOP,
} from '../utils/formato';

type CampoActivo =
  | 'cuenta'
  | 'pin'
  | 'monto'
  | 'cuentaDestino'
  | 'montoTransferencia'
  | 'textoPerfil'
  | 'telefonoPerfil'
  | 'claveActual'
  | 'nuevaClave'
  | 'confirmarClave';

interface MensajeSistema {
  tipo: 'error' | 'exito' | 'advertencia';
  texto: string;
}

const MONTOS_RAPIDOS = [20000, 50000, 100000, 200000, 500000, 1000000];

interface CajeroModuleProps {
  onEstadoSesionChange?: (activa: boolean, cerrarFn?: () => void) => void;
  resetSignal?: number;
}

export function CajeroModule({
  onEstadoSesionChange,
  resetSignal = 0,
}: CajeroModuleProps) {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [pantalla, setPantalla] = useState<PantallaCajero>('LOGIN');
  const [cuenta, setCuenta] = useState<CuentaCajero | null>(null);
  const [titular, setTitular] = useState<TitularCajero | null>(null);

  const [numeroCuentaInput, setNumeroCuentaInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [mostrarPin, setMostrarPin] = useState(false);
  const [montoInput, setMontoInput] = useState('');
  const [cuentaDestinoInput, setCuentaDestinoInput] = useState('');
  const [montoTransferenciaInput, setMontoTransferenciaInput] = useState('');
  const [descripcionTransferenciaInput, setDescripcionTransferenciaInput] =
    useState('');
  const [campoActivo, setCampoActivo] = useState<CampoActivo>('cuenta');

  // Datos de perfil modificables
  const [nombrePerfil, setNombrePerfil] = useState('');
  const [apellidosPerfil, setApellidosPerfil] = useState('');
  const [correoPerfil, setCorreoPerfil] = useState('');
  const [telefonoPerfil, setTelefonoPerfil] = useState('');

  // Cambio de contraseña / PIN
  const [claveActualInput, setClaveActualInput] = useState('');
  const [nuevaClaveInput, setNuevaClaveInput] = useState('');
  const [confirmarClaveInput, setConfirmarClaveInput] = useState('');
  const [mostrarClaves, setMostrarClaves] = useState(false);

  const [mensaje, setMensaje] = useState<MensajeSistema | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [bloqueoSegundos, setBloqueoSegundos] = useState(0);

  const [ultimaConsultaSaldo, setUltimaConsultaSaldo] = useState<string | null>(
    null,
  );
  const [movimientos, setMovimientos] = useState<MovimientoCajero[]>([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [ultimoComprobante, setUltimoComprobante] =
    useState<ComprobanteOperacionData | null>(null);

  function sincronizarDatosPerfil(t: TitularCajero) {
    setNombrePerfil(t.nombre);
    setApellidosPerfil(t.apellidos);
    setCorreoPerfil(t.correo || '');
    setTelefonoPerfil(t.telefono || '');
  }

  useEffect(() => {
    let activo = true;
    (async () => {
      const res = await obtenerSesionCajero();
      if (!activo) return;
      if (res.ok && res.data.cuenta && res.data.titular) {
        setCuenta(res.data.cuenta);
        setTitular(res.data.titular);
        sincronizarDatosPerfil(res.data.titular);
        setPantalla('MENU');
      } else {
        setCuenta(null);
        setTitular(null);
        setPantalla('LOGIN');
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
    if (resetSignal > 0 && pantalla === 'LOGIN') {
      limpiarTerminalLogin();
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
              'Tiempo de espera finalizado. Ya puedes volver a ingresar tu PIN.',
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bloqueoSegundos]);

  const sesionActiva = Boolean(cuenta && titular && pantalla !== 'LOGIN');

  useEffect(() => {
    onEstadoSesionChange?.(sesionActiva, manejarCerrarOperacion);
  }, [sesionActiva]);

  function manejarSesionCaida(res: {
    status: number;
    data: { sesionCerrada?: boolean; mensaje?: string };
  }): boolean {
    if (res.data.sesionCerrada || res.status === 401 || res.status === 403) {
      setCuenta(null);
      setTitular(null);
      setMovimientos([]);
      setMontoInput('');
      setCuentaDestinoInput('');
      setMontoTransferenciaInput('');
      setDescripcionTransferenciaInput('');
      setPinInput('');
      setPantalla('LOGIN');
      setCampoActivo('cuenta');
      setMensaje({
        tipo: 'error',
        texto:
          res.data.mensaje ||
          'Tu sesión en el cajero fue cerrada. Ingresa nuevamente.',
      });
      return true;
    }
    return false;
  }

  async function ejecutarLogin(e?: FormEvent) {
    if (e) e.preventDefault();
    if (procesando || bloqueoSegundos > 0) return;

    const num = numeroCuentaInput.trim();
    const pin = pinInput.trim();

    if (!/^\d{6,20}$/.test(num)) {
      setMensaje({
        tipo: 'error',
        texto: 'Ingresa un número de cuenta válido (entre 6 y 20 dígitos).',
      });
      setCampoActivo('cuenta');
      return;
    }
    if (!/^\d{7}$/.test(pin)) {
      setMensaje({
        tipo: 'error',
        texto: 'El PIN debe tener exactamente 7 dígitos numéricos.',
      });
      setCampoActivo('pin');
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await iniciarSesionCajero(num, pin);
    setProcesando(false);
    setPinInput('');

    if (!res.ok) {
      if (res.data.bloqueoRestanteSegundos) {
        setBloqueoSegundos(res.data.bloqueoRestanteSegundos);
      }
      setMensaje({
        tipo: res.status === 429 ? 'advertencia' : 'error',
        texto: res.data.mensaje || 'No fue posible validar las credenciales.',
      });
      return;
    }

    if (res.data.cuenta && res.data.titular) {
      setCuenta(res.data.cuenta);
      setTitular(res.data.titular);
      sincronizarDatosPerfil(res.data.titular);
      setUltimoComprobante(null);
      setMensaje(null);
      setPantalla('MENU');
    }
  }

  async function sincronizarSaldoSilencioso() {
    const res = await consultarSaldoCajero();
    if (!res.ok) {
      manejarSesionCaida(res);
      return;
    }
    setCuenta((prev) =>
      prev
        ? {
            ...prev,
            saldo: res.data.saldo,
            estado: res.data.estado,
          }
        : prev,
    );
  }

  function irAMenu(limpiarMensaje = true) {
    if (limpiarMensaje) setMensaje(null);
    setPantalla('MENU');
    void sincronizarSaldoSilencioso();
  }

  function abrirPantallaRetiro() {
    setMensaje(null);
    setMontoInput('');
    setCampoActivo('monto');
    setPantalla('RETIRO');
    void sincronizarSaldoSilencioso();
  }

  async function irAConsultaSaldo() {
    if (procesando) return;
    setProcesando(true);
    setMensaje(null);
    const res = await consultarSaldoCajero();
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo consultar el saldo.',
      });
      return;
    }

    setCuenta((prev) =>
      prev
        ? {
            ...prev,
            saldo: res.data.saldo,
            estado: res.data.estado,
          }
        : prev,
    );
    setUltimaConsultaSaldo(res.data.consultadoEn);
    setPantalla('SALDO');
  }

  async function irAMovimientos() {
    if (procesando) return;
    setPantalla('MOVIMIENTOS');
    setCargandoMovimientos(true);
    setMensaje(null);

    const res = await consultarMovimientosCajero(10);
    setCargandoMovimientos(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudieron cargar los movimientos.',
      });
      return;
    }

    setMovimientos(res.data.movimientos || []);
    setCuenta((prev) => (prev ? { ...prev, saldo: res.data.saldo } : prev));
  }

  async function ejecutarRetiro(e?: FormEvent) {
    if (e) e.preventDefault();
    if (procesando || !cuenta) return;

    const valorTexto = montoInput.trim();
    if (!/^\d+$/.test(valorTexto)) {
      setMensaje({
        tipo: 'error',
        texto:
          'Ingresa un monto entero en pesos colombianos, sin puntos, comas ni decimales.',
      });
      return;
    }

    const valorNumero = Number(valorTexto);
    if (!Number.isSafeInteger(valorNumero) || valorNumero <= 0) {
      setMensaje({
        tipo: 'error',
        texto: 'El valor a retirar debe ser mayor que cero.',
      });
      return;
    }

    if (valorNumero > cuenta.saldo) {
      setMensaje({
        tipo: 'error',
        texto: `Saldo insuficiente. El monto (${pesosCOP(
          valorNumero,
        )}) debe ser igual o menor a tu saldo disponible (${pesosCOP(
          cuenta.saldo,
        )}).`,
      });
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await realizarRetiroCajero(valorTexto);
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      if (typeof res.data.saldoDisponible === 'number') {
        const saldoActualizado = res.data.saldoDisponible;
        setCuenta((prev) =>
          prev ? { ...prev, saldo: saldoActualizado } : prev,
        );
      }
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo completar el retiro.',
      });
      return;
    }

    if (res.data.retiro) {
      const retiro = res.data.retiro;
      setCuenta((prev) =>
        prev ? { ...prev, saldo: retiro.saldo_resultante } : prev,
      );
      setUltimoComprobante({ tipoOperacion: 'RETIRO', ...retiro });
      setMontoInput('');
      setMensaje({
        tipo: 'exito',
        texto: res.data.mensaje || 'Retiro realizado con éxito.',
      });
      setPantalla('EXITO_RETIRO');
    }
  }

  function abrirPantallaTransferencia() {
    setMensaje(null);
    setCuentaDestinoInput('');
    setMontoTransferenciaInput('');
    setDescripcionTransferenciaInput('');
    setCampoActivo('cuentaDestino');
    setPantalla('TRANSFERIR');
    void sincronizarSaldoSilencioso();
  }

  async function ejecutarTransferencia(e?: FormEvent) {
    if (e) e.preventDefault();
    if (procesando || !cuenta) return;

    const destino = cuentaDestinoInput.trim();
    const valorTexto = montoTransferenciaInput.trim();
    const descripcion = descripcionTransferenciaInput.trim();

    if (!/^\d{6,20}$/.test(destino)) {
      setMensaje({
        tipo: 'error',
        texto:
          'Ingresa un número de cuenta destino válido (entre 6 y 20 dígitos numéricos).',
      });
      setCampoActivo('cuentaDestino');
      return;
    }

    if (destino === cuenta.numero_cuenta) {
      setMensaje({
        tipo: 'error',
        texto: 'No puedes transferir dinero a la misma cuenta de origen.',
      });
      setCampoActivo('cuentaDestino');
      return;
    }

    if (!/^\d+$/.test(valorTexto)) {
      setMensaje({
        tipo: 'error',
        texto:
          'Ingresa un valor entero en pesos colombianos, sin puntos, comas ni decimales.',
      });
      setCampoActivo('montoTransferencia');
      return;
    }

    const valorNumero = Number(valorTexto);
    if (!Number.isSafeInteger(valorNumero) || valorNumero <= 0) {
      setMensaje({
        tipo: 'error',
        texto: 'El valor a transferir debe ser mayor que cero.',
      });
      setCampoActivo('montoTransferencia');
      return;
    }

    if (valorNumero > cuenta.saldo) {
      setMensaje({
        tipo: 'error',
        texto: `Saldo insuficiente. El monto (${pesosCOP(
          valorNumero,
        )}) debe ser igual o menor a tu saldo disponible (${pesosCOP(
          cuenta.saldo,
        )}).`,
      });
      setCampoActivo('montoTransferencia');
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await realizarTransferenciaCajero(
      destino,
      valorTexto,
      descripcion,
    );
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      if (typeof res.data.saldoDisponible === 'number') {
        const saldoActualizado = res.data.saldoDisponible;
        setCuenta((prev) =>
          prev ? { ...prev, saldo: saldoActualizado } : prev,
        );
      }
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo completar la transferencia.',
      });
      return;
    }

    if (res.data.transferencia) {
      const transferencia = res.data.transferencia;
      setCuenta((prev) =>
        prev ? { ...prev, saldo: transferencia.saldo_resultante } : prev,
      );
      setUltimoComprobante({ tipoOperacion: 'TRANSFERENCIA', ...transferencia });
      setCuentaDestinoInput('');
      setMontoTransferenciaInput('');
      setDescripcionTransferenciaInput('');
      setMensaje({
        tipo: 'exito',
        texto: res.data.mensaje || 'Transferencia realizada con éxito.',
      });
      setPantalla('EXITO_TRANSFERENCIA');
    }
  }

  function abrirPantallaPerfil() {
    if (titular) {
      sincronizarDatosPerfil(titular);
    }
    setMensaje(null);
    setCampoActivo('textoPerfil');
    setPantalla('PERFIL');
  }

  function abrirPantallaCambioClave() {
    setMensaje(null);
    setClaveActualInput('');
    setNuevaClaveInput('');
    setConfirmarClaveInput('');
    setMostrarClaves(false);
    setCampoActivo('claveActual');
    setPantalla('CAMBIAR_CLAVE');
  }

  async function ejecutarActualizarPerfil(e?: FormEvent) {
    if (e) e.preventDefault();
    if (procesando || !titular) return;

    const nombre = nombrePerfil.trim();
    const apellidos = apellidosPerfil.trim();
    const correo = correoPerfil.trim();
    const telefono = telefonoPerfil.trim();

    if (nombre.length < 2 || apellidos.length < 2) {
      setMensaje({
        tipo: 'error',
        texto: 'Nombre y apellidos son obligatorios (mínimo 2 caracteres).',
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setMensaje({
        tipo: 'error',
        texto: 'Ingresa un correo electrónico válido.',
      });
      return;
    }
    if (telefono && !/^\d{7,15}$/.test(telefono)) {
      setMensaje({
        tipo: 'error',
        texto: 'El teléfono debe contener entre 7 y 15 dígitos numéricos.',
      });
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await actualizarPerfilCajero({
      nombre,
      apellidos,
      correo,
      telefono,
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

    if (res.data.titular) {
      setTitular(res.data.titular);
      sincronizarDatosPerfil(res.data.titular);
    }
    setMensaje({
      tipo: 'exito',
      texto: res.data.mensaje || 'Datos de perfil actualizados correctamente.',
    });
    setPantalla('MENU');
  }

  async function ejecutarCambioClave(e?: FormEvent) {
    if (e) e.preventDefault();
    if (procesando) return;

    if (
      !/^\d{7}$/.test(claveActualInput) ||
      !/^\d{7}$/.test(nuevaClaveInput)
    ) {
      setMensaje({
        tipo: 'error',
        texto:
          'Tanto la contraseña/PIN actual como la nueva deben tener exactamente 7 dígitos numéricos.',
      });
      return;
    }
    if (nuevaClaveInput !== confirmarClaveInput) {
      setMensaje({
        tipo: 'error',
        texto: 'La confirmación no coincide con la nueva contraseña / PIN.',
      });
      setCampoActivo('confirmarClave');
      return;
    }
    if (claveActualInput === nuevaClaveInput) {
      setMensaje({
        tipo: 'error',
        texto: 'La nueva contraseña / PIN debe ser diferente a la actual.',
      });
      setCampoActivo('nuevaClave');
      return;
    }

    setProcesando(true);
    setMensaje(null);
    const res = await cambiarClaveCajero(claveActualInput, nuevaClaveInput);
    setProcesando(false);

    if (!res.ok) {
      if (manejarSesionCaida(res)) return;
      setMensaje({
        tipo: 'error',
        texto: res.data.mensaje || 'No se pudo cambiar la contraseña / PIN.',
      });
      return;
    }

    setClaveActualInput('');
    setNuevaClaveInput('');
    setConfirmarClaveInput('');
    if (res.data.titular) {
      setTitular(res.data.titular);
    }
    setMensaje({
      tipo: 'exito',
      texto:
        res.data.mensaje || 'Contraseña / PIN actualizado correctamente.',
    });
    setPantalla('MENU');
  }

  async function manejarCerrarOperacion() {
    setProcesando(true);
    await cerrarOperacionCajero();
    setProcesando(false);
    setCuenta(null);
    setTitular(null);
    setMovimientos([]);
    setMontoInput('');
    setCuentaDestinoInput('');
    setMontoTransferenciaInput('');
    setDescripcionTransferenciaInput('');
    setClaveActualInput('');
    setNuevaClaveInput('');
    setConfirmarClaveInput('');
    setPinInput('');
    setNumeroCuentaInput('');
    setUltimaConsultaSaldo(null);
    setPantalla('LOGIN');
    setCampoActivo('cuenta');
    setMensaje({
      tipo: 'exito',
      texto: 'Operación cerrada. Para volver a operar, ingresa cuenta y PIN.',
    });
  }

  function limpiarTerminalLogin() {
    setNumeroCuentaInput('');
    setPinInput('');
    setMensaje(null);
    setCampoActivo('cuenta');
  }

  const tecladoHabilitado =
    !procesando &&
    ((pantalla === 'LOGIN' && bloqueoSegundos === 0) ||
      pantalla === 'RETIRO' ||
      pantalla === 'TRANSFERIR' ||
      (pantalla === 'PERFIL' && campoActivo === 'telefonoPerfil') ||
      pantalla === 'CAMBIAR_CLAVE');

  function obtenerEtiquetaCampoActivo(): string {
    if (pantalla === 'LOGIN') {
      return campoActivo === 'pin'
        ? 'PIN / Contraseña (7 dígitos)'
        : 'Número de cuenta';
    }
    if (pantalla === 'RETIRO') {
      return 'Valor a retirar (COP)';
    }
    if (pantalla === 'TRANSFERIR') {
      return campoActivo === 'montoTransferencia'
        ? 'Valor a transferir (COP)'
        : 'Cuenta destino';
    }
    if (pantalla === 'PERFIL') {
      return campoActivo === 'telefonoPerfil'
        ? 'Teléfono (7 a 15 dígitos)'
        : 'Usa el teclado físico o selecciona Teléfono';
    }
    if (pantalla === 'CAMBIAR_CLAVE') {
      if (campoActivo === 'nuevaClave') return 'Nueva contraseña / PIN (7 dígitos)';
      if (campoActivo === 'confirmarClave')
        return 'Confirmar contraseña / PIN (7 dígitos)';
      return 'Contraseña / PIN actual (7 dígitos)';
    }
    return 'Solo lectura en esta pantalla';
  }

  function onTecladoDigito(digito: string) {
    if (!tecladoHabilitado) return;
    if (pantalla === 'LOGIN') {
      if (campoActivo === 'cuenta') {
        setNumeroCuentaInput((prev) =>
          prev.length < 20 ? prev + digito : prev,
        );
      } else {
        setPinInput((prev) => (prev.length < 7 ? prev + digito : prev));
      }
    } else if (pantalla === 'RETIRO') {
      setMensaje(null);
      setMontoInput((prev) => {
        if (prev === '0') return digito;
        return prev.length < 10 ? prev + digito : prev;
      });
    } else if (pantalla === 'TRANSFERIR') {
      setMensaje(null);
      if (campoActivo === 'montoTransferencia') {
        setMontoTransferenciaInput((prev) => {
          if (prev === '0') return digito;
          return prev.length < 10 ? prev + digito : prev;
        });
      } else {
        setCuentaDestinoInput((prev) =>
          prev.length < 20 ? prev + digito : prev,
        );
      }
    } else if (pantalla === 'PERFIL' && campoActivo === 'telefonoPerfil') {
      setTelefonoPerfil((prev) => (prev.length < 15 ? prev + digito : prev));
    } else if (pantalla === 'CAMBIAR_CLAVE') {
      if (campoActivo === 'nuevaClave') {
        setNuevaClaveInput((prev) => (prev.length < 7 ? prev + digito : prev));
      } else if (campoActivo === 'confirmarClave') {
        setConfirmarClaveInput((prev) =>
          prev.length < 7 ? prev + digito : prev,
        );
      } else {
        setClaveActualInput((prev) => (prev.length < 7 ? prev + digito : prev));
      }
    }
  }

  function onTecladoBorrar() {
    if (!tecladoHabilitado) return;
    if (pantalla === 'LOGIN') {
      if (campoActivo === 'cuenta') {
        setNumeroCuentaInput((prev) => prev.slice(0, -1));
      } else {
        setPinInput((prev) => prev.slice(0, -1));
      }
    } else if (pantalla === 'RETIRO') {
      setMensaje(null);
      setMontoInput((prev) => prev.slice(0, -1));
    } else if (pantalla === 'TRANSFERIR') {
      setMensaje(null);
      if (campoActivo === 'montoTransferencia') {
        setMontoTransferenciaInput((prev) => prev.slice(0, -1));
      } else {
        setCuentaDestinoInput((prev) => prev.slice(0, -1));
      }
    } else if (pantalla === 'PERFIL' && campoActivo === 'telefonoPerfil') {
      setTelefonoPerfil((prev) => prev.slice(0, -1));
    } else if (pantalla === 'CAMBIAR_CLAVE') {
      if (campoActivo === 'nuevaClave') {
        setNuevaClaveInput((prev) => prev.slice(0, -1));
      } else if (campoActivo === 'confirmarClave') {
        setConfirmarClaveInput((prev) => prev.slice(0, -1));
      } else {
        setClaveActualInput((prev) => prev.slice(0, -1));
      }
    }
  }

  function onTecladoLimpiar() {
    if (!tecladoHabilitado) return;
    if (pantalla === 'LOGIN') {
      if (campoActivo === 'cuenta') {
        setNumeroCuentaInput('');
      } else {
        setPinInput('');
      }
    } else if (pantalla === 'RETIRO') {
      setMontoInput('');
    } else if (pantalla === 'TRANSFERIR') {
      if (campoActivo === 'montoTransferencia') {
        setMontoTransferenciaInput('');
      } else {
        setCuentaDestinoInput('');
      }
    } else if (pantalla === 'PERFIL' && campoActivo === 'telefonoPerfil') {
      setTelefonoPerfil('');
    } else if (pantalla === 'CAMBIAR_CLAVE') {
      if (campoActivo === 'nuevaClave') {
        setNuevaClaveInput('');
      } else if (campoActivo === 'confirmarClave') {
        setConfirmarClaveInput('');
      } else {
        setClaveActualInput('');
      }
    }
  }

  function onTecladoConfirmar() {
    if (!tecladoHabilitado) return;
    if (pantalla === 'LOGIN') {
      if (campoActivo === 'cuenta' && pinInput.length < 7) {
        setCampoActivo('pin');
        return;
      }
      void ejecutarLogin();
    } else if (pantalla === 'RETIRO') {
      void ejecutarRetiro();
    } else if (pantalla === 'TRANSFERIR') {
      if (campoActivo !== 'montoTransferencia' && !montoTransferenciaInput) {
        setCampoActivo('montoTransferencia');
        return;
      }
      void ejecutarTransferencia();
    } else if (pantalla === 'PERFIL') {
      void ejecutarActualizarPerfil();
    } else if (pantalla === 'CAMBIAR_CLAVE') {
      if (campoActivo === 'claveActual' && nuevaClaveInput.length < 7) {
        setCampoActivo('nuevaClave');
        return;
      }
      if (campoActivo === 'nuevaClave' && confirmarClaveInput.length < 7) {
        setCampoActivo('confirmarClave');
        return;
      }
      void ejecutarCambioClave();
    }
  }

  const montoRetiroNumero = /^\d+$/.test(montoInput) ? Number(montoInput) : 0;
  const retiroExcedeSaldo = Boolean(
    cuenta && montoInput && montoRetiroNumero > cuenta.saldo,
  );
  const montoTransferenciaNumero = /^\d+$/.test(montoTransferenciaInput)
    ? Number(montoTransferenciaInput)
    : 0;
  const transferenciaExcedeSaldo = Boolean(
    cuenta &&
      montoTransferenciaInput &&
      montoTransferenciaNumero > cuenta.saldo,
  );

  return (
    <div className="space-y-6">
      {/* Encabezado de contexto del cajero + barra de operaciones */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Cajero automático virtual
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Consulta de saldo, retiros, transferencias entre cuentas en pesos colombianos sin decimales y últimos movimientos en tiempo real.
          </p>
        </div>

        {sesionActiva && cuenta && titular && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="font-medium text-slate-900">
              {titular.nombre} {titular.apellidos}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Cuenta {cuenta.numero_cuenta}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A]">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              {cuenta.estado}
            </span>
          </div>
        )}
      </section>

      {sesionActiva && (
        <div
          role="toolbar"
          aria-label="Operaciones rápidas del cajero"
          className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-slate-200 rounded-xl print:hidden"
        >
          <button
            type="button"
            onClick={() => irAMenu(true)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              pantalla === 'MENU'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Menú
          </button>
          <button
            type="button"
            onClick={irAConsultaSaldo}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              pantalla === 'SALDO'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Saldo
          </button>
          <button
            type="button"
            onClick={abrirPantallaRetiro}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              pantalla === 'RETIRO' || pantalla === 'EXITO_RETIRO'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Retirar
          </button>
          <button
            type="button"
            onClick={abrirPantallaTransferencia}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              pantalla === 'TRANSFERIR' || pantalla === 'EXITO_TRANSFERENCIA'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Transferir
          </button>
          <button
            type="button"
            onClick={irAMovimientos}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              pantalla === 'MOVIMIENTOS'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Movimientos
          </button>
          <button
            type="button"
            onClick={abrirPantallaPerfil}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              pantalla === 'PERFIL'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Perfil
          </button>
          <button
            type="button"
            onClick={abrirPantallaCambioClave}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              pantalla === 'CAMBIAR_CLAVE'
                ? 'bg-[#0B3D6B] text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Cambiar clave
          </button>
        </div>
      )}

      {/* Consola principal del cajero (2 columnas balanceadas) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch print:hidden">
        {/* Columna izquierda: Pantalla del Cajero */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex-1 bg-[#0F172A] text-slate-100 rounded-xl border border-slate-800 p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-xs text-slate-400">
                <span className="font-semibold text-slate-200">
                  Terminal de Cajero
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {pantalla === 'LOGIN' && 'Identificación de cliente'}
                  {pantalla === 'MENU' && 'Menú principal'}
                  {pantalla === 'SALDO' && 'Consulta de saldo'}
                  {pantalla === 'RETIRO' && 'Retiro de efectivo'}
                  {pantalla === 'EXITO_RETIRO' && 'Operación completada'}
                  {pantalla === 'TRANSFERIR' && 'Transferencia entre cuentas'}
                  {pantalla === 'EXITO_TRANSFERENCIA' &&
                    'Transferencia completada'}
                  {pantalla === 'MOVIMIENTOS' && 'Últimos movimientos'}
                  {pantalla === 'PERFIL' && 'Datos del perfil'}
                  {pantalla === 'CAMBIAR_CLAVE' &&
                    'Cambio de contraseña / PIN'}
                </span>
              </div>
              {sesionActiva && pantalla !== 'MENU' && (
                <button
                  type="button"
                  onClick={() => irAMenu(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded px-1.5 py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Menú</span>
                </button>
              )}
            </div>

            {mensaje && (
              <div
                role="alert"
                className={`mb-6 rounded-lg border px-4 py-3 text-sm flex items-start gap-2.5 ${
                  mensaje.tipo === 'error'
                    ? 'bg-red-950/60 border-red-700/70 text-red-100'
                    : mensaje.tipo === 'advertencia'
                      ? 'bg-amber-950/60 border-amber-700/70 text-amber-100'
                      : 'bg-emerald-950/60 border-emerald-700/70 text-emerald-100'
                }`}
              >
                {mensaje.tipo === 'exito' ? (
                  <CheckCircle2
                    className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertCircle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      mensaje.tipo === 'advertencia'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <div className="flex-1 leading-relaxed">
                  <span>{mensaje.texto}</span>
                  {bloqueoSegundos > 0 && (
                    <span className="block mt-1 font-mono tabular-nums text-xs text-amber-300">
                      Desbloqueo automático en {bloqueoSegundos}s
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col justify-center">
              {cargandoInicial ? (
                <div className="space-y-4 py-8" aria-busy="true">
                  <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
                  <div className="h-11 w-full bg-slate-800 rounded animate-pulse" />
                  <div className="h-11 w-full bg-slate-800 rounded animate-pulse" />
                </div>
              ) : pantalla === 'LOGIN' ? (
                <form onSubmit={ejecutarLogin} className="space-y-5">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Ingresa a tu cuenta en el cajero
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Digita tu número de cuenta y tu PIN o contraseña numérica de 7 dígitos usando el teclado físico o el teclado en pantalla.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-cuenta"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Número de cuenta
                    </label>
                    <input
                      id="cajero-cuenta"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={20}
                      placeholder="Ej. 1001000001"
                      value={numeroCuentaInput}
                      onFocus={() => setCampoActivo('cuenta')}
                      onChange={(e) => {
                        const soloDigitos = e.target.value.replace(/\D/g, '');
                        setNumeroCuentaInput(soloDigitos);
                      }}
                      disabled={bloqueoSegundos > 0 || procesando}
                      className={`w-full h-12 px-4 rounded-lg bg-slate-950 border font-mono tabular-nums text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        campoActivo === 'cuenta'
                          ? 'border-sky-400'
                          : 'border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-pin"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      PIN / Contraseña (7 dígitos numéricos)
                    </label>
                    <div className="relative">
                      <input
                        id="cajero-pin"
                        type={mostrarPin ? 'text' : 'password'}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={7}
                        placeholder="•••••••"
                        value={pinInput}
                        onFocus={() => setCampoActivo('pin')}
                        onChange={(e) => {
                          const soloDigitos = e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 7);
                          setPinInput(soloDigitos);
                        }}
                        disabled={bloqueoSegundos > 0 || procesando}
                        className={`w-full h-12 pl-4 pr-12 rounded-lg bg-slate-950 border font-mono tabular-nums text-base tracking-widest text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                          campoActivo === 'pin'
                            ? 'border-sky-400'
                            : 'border-slate-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPin((v) => !v)}
                        aria-label={mostrarPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded"
                      >
                        {mostrarPin ? (
                          <EyeOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={procesando || bloqueoSegundos > 0}
                    className="w-full h-12 rounded-lg bg-[#0B3D6B] border border-sky-500/40 text-white text-sm font-semibold whitespace-nowrap hover:bg-[#0E4C85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    {bloqueoSegundos > 0
                      ? `Terminal bloqueado (${bloqueoSegundos}s)`
                      : procesando
                        ? 'Verificando...'
                        : 'Ingresar al cajero'}
                  </button>
                </form>
              ) : pantalla === 'MENU' && cuenta && titular ? (
                <div className="space-y-6">
                  <div className="pb-5 border-b border-slate-800">
                    <p className="text-xs text-slate-400">
                      Titular: {titular.nombre} {titular.apellidos} · Cuenta de
                      ahorros{' '}
                      <span className="font-mono tabular-nums text-slate-200">
                        {cuenta.numero_cuenta}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-3">
                      Saldo disponible
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-white mt-1">
                      {pesosCOP(cuenta.saldo)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-3">
                      Selecciona una operación
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={procesando}
                        onClick={irAConsultaSaldo}
                        className="h-14 px-4 rounded-lg bg-slate-800/90 border border-slate-700 text-left flex items-center gap-3 text-white hover:bg-slate-800 hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
                      >
                        <Wallet
                          className="w-5 h-5 text-sky-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Consultar saldo
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={procesando}
                        onClick={abrirPantallaRetiro}
                        className="h-14 px-4 rounded-lg bg-[#16A34A] border border-emerald-500 text-left flex items-center gap-3 text-white hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors"
                      >
                        <Banknote
                          className="w-5 h-5 text-white shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Realizar retiro
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={procesando}
                        onClick={abrirPantallaTransferencia}
                        className="h-14 px-4 rounded-lg bg-slate-800/90 border border-slate-700 text-left flex items-center gap-3 text-white hover:bg-slate-800 hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
                      >
                        <ArrowLeftRight
                          className="w-5 h-5 text-sky-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Transferir dinero
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={procesando}
                        onClick={irAMovimientos}
                        className="h-14 px-4 rounded-lg bg-slate-800/90 border border-slate-700 text-left flex items-center gap-3 text-white hover:bg-slate-800 hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
                      >
                        <History
                          className="w-5 h-5 text-sky-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Últimos movimientos
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={procesando}
                        onClick={abrirPantallaPerfil}
                        className="h-14 px-4 rounded-lg bg-slate-800/90 border border-slate-700 text-left flex items-center gap-3 text-white hover:bg-slate-800 hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
                      >
                        <User
                          className="w-5 h-5 text-sky-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Modificar perfil
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={procesando}
                        onClick={abrirPantallaCambioClave}
                        className="h-14 px-4 rounded-lg bg-slate-800/90 border border-slate-700 text-left flex items-center gap-3 text-white hover:bg-slate-800 hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
                      >
                        <KeyRound
                          className="w-5 h-5 text-sky-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Cambiar contraseña
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={procesando}
                        onClick={manejarCerrarOperacion}
                        className="sm:col-span-2 h-12 px-4 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center gap-2.5 text-slate-200 hover:bg-slate-900 hover:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                      >
                        <LogOut
                          className="w-4 h-4 text-red-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Cerrar operación
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : pantalla === 'SALDO' && cuenta ? (
                <div className="space-y-6">
                  <div>
                    <p className="text-xs text-slate-400">
                      Cuenta {cuenta.tipo_cuenta} ·{' '}
                      <span className="font-mono tabular-nums text-slate-200">
                        {cuenta.numero_cuenta}
                      </span>
                    </p>
                    <h2 className="text-lg font-semibold text-white mt-1">
                      Saldo disponible en cuenta
                    </h2>
                    <p className="text-4xl font-bold font-mono tabular-nums text-emerald-400 mt-3">
                      {pesosCOP(cuenta.saldo)}
                    </p>
                    {ultimaConsultaSaldo && (
                      <p className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
                        Consultado: {formatearFecha(ultimaConsultaSaldo)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={procesando}
                      onClick={irAConsultaSaldo}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <RefreshCw className="w-4 h-4" aria-hidden="true" />
                      <span>Actualizar saldo</span>
                    </button>

                    <button
                      type="button"
                      onClick={abrirPantallaRetiro}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#16A34A] text-sm font-semibold text-white whitespace-nowrap shrink-0 hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <Banknote className="w-4 h-4" aria-hidden="true" />
                      <span>Realizar retiro</span>
                    </button>

                    <button
                      type="button"
                      onClick={abrirPantallaTransferencia}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />
                      <span>Transferir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPantalla('MENU')}
                      className="px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 whitespace-nowrap shrink-0 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Volver al menú
                    </button>
                  </div>
                </div>
              ) : pantalla === 'RETIRO' && cuenta ? (
                <form onSubmit={ejecutarRetiro} className="space-y-5">
                  <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">
                      Realizar retiro
                    </h2>
                    <p className="text-xs text-slate-400">
                      Disponible:{' '}
                      <span className="font-mono tabular-nums text-slate-200 font-semibold">
                        {pesosCOP(cuenta.saldo)}
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-300 mb-2">
                      Montos rápidos
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {MONTOS_RAPIDOS.map((monto) => {
                        const seleccionado = montoInput === String(monto);
                        const excedeSaldo = monto > cuenta.saldo;
                        return (
                          <button
                            key={monto}
                            type="button"
                            disabled={procesando}
                            onClick={() => {
                              setMontoInput(String(monto));
                              setMensaje(null);
                            }}
                            className={`h-11 px-3 rounded-lg border font-mono tabular-nums text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                              seleccionado
                                ? excedeSaldo
                                  ? 'bg-red-500/20 border-red-400 text-red-100'
                                  : 'bg-sky-500/20 border-sky-400 text-white'
                                : excedeSaldo
                                  ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-red-500/70 hover:text-red-200'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-500'
                            }`}
                          >
                            {pesosCOP(monto)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-monto"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Otro valor (pesos colombianos, sin decimales)
                    </label>
                    <input
                      id="cajero-monto"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej. 200000"
                      value={montoInput}
                      onFocus={() => setCampoActivo('monto')}
                      onChange={(e) => {
                        const soloDigitos = e.target.value.replace(/\D/g, '');
                        setMontoInput(soloDigitos);
                        setMensaje(null);
                      }}
                      disabled={procesando}
                      className={`w-full h-12 px-4 rounded-lg bg-slate-950 border font-mono tabular-nums text-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                        retiroExcedeSaldo
                          ? 'border-red-500 focus:ring-red-400'
                          : 'border-sky-400 focus:ring-sky-400'
                      }`}
                    />
                    <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
                      Monto a retirar:{' '}
                      <span
                        className={`font-semibold ${
                          retiroExcedeSaldo ? 'text-red-400' : 'text-slate-200'
                        }`}
                      >
                        {montoInput ? pesosCOP(Number(montoInput)) : '$ 0'}
                      </span>
                    </p>
                    {retiroExcedeSaldo && (
                      <div
                        role="alert"
                        className="mt-2 rounded-lg border border-red-700/70 bg-red-950/60 px-3 py-2 text-xs text-red-100 flex items-center gap-2"
                      >
                        <AlertCircle
                          className="w-4 h-4 text-red-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Saldo insuficiente: el monto debe ser igual o menor a{' '}
                          <strong className="font-mono tabular-nums text-white">
                            {pesosCOP(cuenta.saldo)}
                          </strong>
                          .
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={procesando || !montoInput || retiroExcedeSaldo}
                      className="flex-1 min-w-[180px] h-12 px-5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {procesando
                        ? 'Procesando retiro...'
                        : retiroExcedeSaldo
                          ? 'Saldo insuficiente'
                          : 'Confirmar retiro'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMensaje(null);
                        setPantalla('MENU');
                      }}
                      className="h-12 px-4 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 whitespace-nowrap hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : pantalla === 'EXITO_RETIRO' &&
                ultimoComprobante?.tipoOperacion === 'RETIRO' ? (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-slate-800">
                    <p className="text-xs font-semibold text-emerald-400">
                      Movimiento #{ultimoComprobante.id_movimiento} ·{' '}
                      {ultimoComprobante.descripcion}
                    </p>
                    <h2 className="text-2xl font-bold text-white mt-1">
                      Retiro realizado con éxito
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs text-slate-400">Valor retirado</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                        {pesosCOP(ultimoComprobante.valor_retirado)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-950 border border-emerald-700/60">
                      <p className="text-xs text-slate-400">Nuevo saldo</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                        {pesosCOP(ultimoComprobante.saldo_resultante)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={abrirPantallaRetiro}
                      className="px-4 py-2.5 rounded-lg bg-[#16A34A] text-sm font-semibold text-white whitespace-nowrap shrink-0 hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Hacer otro retiro
                    </button>
                    <button
                      type="button"
                      onClick={irAMovimientos}
                      className="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Ver últimos movimientos
                    </button>
                    <button
                      type="button"
                      onClick={manejarCerrarOperacion}
                      className="px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 whitespace-nowrap shrink-0 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      Cerrar operación
                    </button>
                  </div>
                </div>
              ) : pantalla === 'TRANSFERIR' && cuenta ? (
                <form onSubmit={ejecutarTransferencia} className="space-y-4">
                  <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">
                      Transferir a otra cuenta
                    </h2>
                    <p className="text-xs text-slate-400">
                      Disponible:{' '}
                      <span className="font-mono tabular-nums text-slate-200 font-semibold">
                        {pesosCOP(cuenta.saldo)}
                      </span>
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="transferencia-destino"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Número de cuenta destino
                    </label>
                    <input
                      id="transferencia-destino"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={20}
                      placeholder="Ej. 1001000003"
                      value={cuentaDestinoInput}
                      onFocus={() => setCampoActivo('cuentaDestino')}
                      onChange={(e) => {
                        const soloDigitos = e.target.value.replace(/\D/g, '');
                        setCuentaDestinoInput(soloDigitos);
                      }}
                      disabled={procesando}
                      className={`w-full h-11 px-4 rounded-lg bg-slate-950 border font-mono tabular-nums text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        campoActivo === 'cuentaDestino'
                          ? 'border-sky-400'
                          : 'border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-300 mb-2">
                      Montos rápidos
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MONTOS_RAPIDOS.map((monto) => {
                        const seleccionado =
                          montoTransferenciaInput === String(monto);
                        const excedeSaldo = monto > cuenta.saldo;
                        return (
                          <button
                            key={monto}
                            type="button"
                            disabled={procesando}
                            onClick={() => {
                              setMontoTransferenciaInput(String(monto));
                              setCampoActivo('montoTransferencia');
                              setMensaje(null);
                            }}
                            className={`h-10 px-3 rounded-lg border font-mono tabular-nums text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                              seleccionado
                                ? excedeSaldo
                                  ? 'bg-red-500/20 border-red-400 text-red-100'
                                  : 'bg-sky-500/20 border-sky-400 text-white'
                                : excedeSaldo
                                  ? 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-red-500/70 hover:text-red-200'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-500'
                            }`}
                          >
                            {pesosCOP(monto)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="transferencia-valor"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Valor a transferir (pesos colombianos, sin decimales)
                    </label>
                    <input
                      id="transferencia-valor"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej. 150000"
                      value={montoTransferenciaInput}
                      onFocus={() => setCampoActivo('montoTransferencia')}
                      onChange={(e) => {
                        const soloDigitos = e.target.value.replace(/\D/g, '');
                        setMontoTransferenciaInput(soloDigitos);
                        setMensaje(null);
                      }}
                      disabled={procesando}
                      className={`w-full h-11 px-4 rounded-lg bg-slate-950 border font-mono tabular-nums text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 ${
                        transferenciaExcedeSaldo
                          ? 'border-red-500 focus:ring-red-400'
                          : campoActivo === 'montoTransferencia'
                            ? 'border-sky-400 focus:ring-sky-400'
                            : 'border-slate-700 focus:ring-sky-400'
                      }`}
                    />
                    <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                      Monto a transferir:{' '}
                      <span
                        className={`font-semibold ${
                          transferenciaExcedeSaldo
                            ? 'text-red-400'
                            : 'text-slate-200'
                        }`}
                      >
                        {montoTransferenciaInput
                          ? pesosCOP(Number(montoTransferenciaInput))
                          : '$ 0'}
                      </span>
                    </p>
                    {transferenciaExcedeSaldo && (
                      <div
                        role="alert"
                        className="mt-2 rounded-lg border border-red-700/70 bg-red-950/60 px-3 py-2 text-xs text-red-100 flex items-center gap-2"
                      >
                        <AlertCircle
                          className="w-4 h-4 text-red-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Saldo insuficiente: el monto debe ser igual o menor a{' '}
                          <strong className="font-mono tabular-nums text-white">
                            {pesosCOP(cuenta.saldo)}
                          </strong>
                          .
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="transferencia-descripcion"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Descripción (opcional)
                    </label>
                    <input
                      id="transferencia-descripcion"
                      type="text"
                      autoComplete="off"
                      maxLength={100}
                      placeholder="Ej. Pago de arriendo mensual"
                      value={descripcionTransferenciaInput}
                      onChange={(e) =>
                        setDescripcionTransferenciaInput(e.target.value)
                      }
                      disabled={procesando}
                      className="w-full h-11 px-4 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={
                        procesando ||
                        !cuentaDestinoInput ||
                        !montoTransferenciaInput ||
                        transferenciaExcedeSaldo
                      }
                      className="flex-1 min-w-[180px] h-12 px-5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {procesando
                        ? 'Procesando transferencia...'
                        : transferenciaExcedeSaldo
                          ? 'Saldo insuficiente'
                          : 'Confirmar transferencia'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMensaje(null);
                        setPantalla('MENU');
                      }}
                      className="h-12 px-4 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 whitespace-nowrap hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : pantalla === 'EXITO_TRANSFERENCIA' &&
                ultimoComprobante?.tipoOperacion === 'TRANSFERENCIA' ? (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-slate-800">
                    <p className="text-xs font-semibold text-emerald-400">
                      Transferencia #{ultimoComprobante.id_transferencia} · Cuenta
                      destino{' '}
                      <span className="font-mono tabular-nums">
                        {ultimoComprobante.numero_cuenta_destino}
                      </span>
                    </p>
                    <h2 className="text-2xl font-bold text-white mt-1">
                      Transferencia realizada con éxito
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Destinatario: {ultimoComprobante.titular_destino}
                      {ultimoComprobante.descripcion
                        ? ` · ${ultimoComprobante.descripcion}`
                        : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                      <p className="text-xs text-slate-400">Valor transferido</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                        {pesosCOP(ultimoComprobante.valor_transferido)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-950 border border-emerald-700/60">
                      <p className="text-xs text-slate-400">Nuevo saldo</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                        {pesosCOP(ultimoComprobante.saldo_resultante)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={abrirPantallaTransferencia}
                      className="px-4 py-2.5 rounded-lg bg-[#16A34A] text-sm font-semibold text-white whitespace-nowrap shrink-0 hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Hacer otra transferencia
                    </button>
                    <button
                      type="button"
                      onClick={irAMovimientos}
                      className="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Ver últimos movimientos
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMensaje(null);
                        setPantalla('MENU');
                      }}
                      className="px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 whitespace-nowrap shrink-0 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Volver al menú
                    </button>
                  </div>
                </div>
              ) : pantalla === 'MOVIMIENTOS' && cuenta ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Últimos movimientos
                      </h2>
                      <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                        Cuenta {cuenta.numero_cuenta} · Saldo actual:{' '}
                        <span className="text-emerald-400 font-semibold">
                          {pesosCOP(cuenta.saldo)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={cargandoMovimientos}
                      onClick={irAMovimientos}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          cargandoMovimientos ? 'animate-spin' : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span>Actualizar</span>
                    </button>
                  </div>

                  {cargandoMovimientos ? (
                    <div className="space-y-2 py-2" aria-busy="true">
                      {[1, 2, 3, 4].map((row) => (
                        <div
                          key={row}
                          className="h-10 w-full bg-slate-800/80 rounded animate-pulse"
                        />
                      ))}
                    </div>
                  ) : movimientos.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-400">
                        Aún no hay movimientos registrados para esta cuenta.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead className="sticky top-0 bg-[#0F172A] border-b border-slate-800 text-slate-400">
                          <tr>
                            <th className="py-2 pr-3 font-medium">Fecha</th>
                            <th className="py-2 pr-3 font-medium">Movimiento</th>
                            <th className="py-2 pr-3 font-medium text-right">
                              Valor
                            </th>
                            <th className="py-2 font-medium text-right">
                              Saldo
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {movimientos.map((m) => (
                            <tr
                              key={m.id_movimiento}
                              className="hover:bg-slate-800/40"
                            >
                              <td className="py-2.5 pr-3 font-mono tabular-nums text-xs text-slate-400 whitespace-nowrap">
                                {formatearFecha(m.fecha)}
                              </td>
                              <td className="py-2.5 pr-3">
                                <div className="font-medium text-slate-100">
                                  {nombreTipoMovimiento(m.tipo)}
                                </div>
                                {m.descripcion && (
                                  <div className="text-xs text-slate-400 truncate max-w-[220px]">
                                    {m.descripcion}
                                  </div>
                                )}
                              </td>
                              <td
                                className={`py-2.5 pr-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                                  m.valor < 0
                                    ? 'text-red-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {m.valor > 0 ? '+' : ''}
                                {pesosCOP(m.valor)}
                              </td>
                              <td className="py-2.5 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                                {pesosCOP(m.saldo_resultante)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMensaje(null);
                        setPantalla('MENU');
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Volver al menú
                    </button>
                  </div>
                </div>
              ) : pantalla === 'PERFIL' && cuenta && titular ? (
                <form onSubmit={ejecutarActualizarPerfil} className="space-y-4">
                  <div className="pb-3 border-b border-slate-800">
                    <h2 className="text-lg font-semibold text-white">
                      Modificar datos del perfil
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Usuario:{' '}
                      <span className="font-mono text-slate-200">
                        {titular.usuario}
                      </span>{' '}
                      · Cuenta{' '}
                      <span className="font-mono tabular-nums text-slate-200">
                        {cuenta.numero_cuenta}
                      </span>{' '}
                      · Estado:{' '}
                      <span className="font-semibold text-emerald-400">
                        {cuenta.estado}
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label
                        htmlFor="cajero-perfil-nombre"
                        className="block text-xs font-medium text-slate-300 mb-1.5"
                      >
                        Nombre
                      </label>
                      <input
                        id="cajero-perfil-nombre"
                        type="text"
                        required
                        value={nombrePerfil}
                        onFocus={() => setCampoActivo('textoPerfil')}
                        onChange={(e) => setNombrePerfil(e.target.value)}
                        disabled={procesando}
                        className="w-full h-11 px-3.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="cajero-perfil-apellidos"
                        className="block text-xs font-medium text-slate-300 mb-1.5"
                      >
                        Apellidos
                      </label>
                      <input
                        id="cajero-perfil-apellidos"
                        type="text"
                        required
                        value={apellidosPerfil}
                        onFocus={() => setCampoActivo('textoPerfil')}
                        onChange={(e) => setApellidosPerfil(e.target.value)}
                        disabled={procesando}
                        className="w-full h-11 px-3.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-perfil-correo"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Correo electrónico
                    </label>
                    <input
                      id="cajero-perfil-correo"
                      type="email"
                      required
                      value={correoPerfil}
                      onFocus={() => setCampoActivo('textoPerfil')}
                      onChange={(e) => setCorreoPerfil(e.target.value)}
                      disabled={procesando}
                      className="w-full h-11 px-3.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-perfil-telefono"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Teléfono
                    </label>
                    <input
                      id="cajero-perfil-telefono"
                      type="text"
                      inputMode="numeric"
                      maxLength={15}
                      placeholder="Ej. 3104445566"
                      value={telefonoPerfil}
                      onFocus={() => setCampoActivo('telefonoPerfil')}
                      onChange={(e) =>
                        setTelefonoPerfil(e.target.value.replace(/\D/g, ''))
                      }
                      disabled={procesando}
                      className={`w-full h-11 px-3.5 rounded-lg bg-slate-950 border font-mono tabular-nums text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        campoActivo === 'telefonoPerfil'
                          ? 'border-sky-400'
                          : 'border-slate-700'
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={procesando}
                      className="flex-1 min-w-[180px] h-12 px-5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
                    >
                      {procesando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMensaje(null);
                        setPantalla('MENU');
                      }}
                      className="h-12 px-4 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 whitespace-nowrap hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : pantalla === 'CAMBIAR_CLAVE' && cuenta ? (
                <form onSubmit={ejecutarCambioClave} className="space-y-4">
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        Cambiar contraseña / PIN
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Clave numérica de 7 dígitos compartida entre el cajero y la banca virtual.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMostrarClaves((v) => !v)}
                      aria-label={
                        mostrarClaves ? 'Ocultar claves' : 'Mostrar claves'
                      }
                      className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 shrink-0"
                    >
                      {mostrarClaves ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-clave-actual"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Contraseña / PIN actual (7 dígitos)
                    </label>
                    <input
                      id="cajero-clave-actual"
                      type={mostrarClaves ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={7}
                      placeholder="•••••••"
                      value={claveActualInput}
                      onFocus={() => setCampoActivo('claveActual')}
                      onChange={(e) =>
                        setClaveActualInput(
                          e.target.value.replace(/\D/g, '').slice(0, 7),
                        )
                      }
                      disabled={procesando}
                      className={`w-full h-11 px-4 rounded-lg bg-slate-950 border font-mono tabular-nums text-base tracking-widest text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        campoActivo === 'claveActual'
                          ? 'border-sky-400'
                          : 'border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-clave-nueva"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Nueva contraseña / PIN (7 dígitos)
                    </label>
                    <input
                      id="cajero-clave-nueva"
                      type={mostrarClaves ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={7}
                      placeholder="•••••••"
                      value={nuevaClaveInput}
                      onFocus={() => setCampoActivo('nuevaClave')}
                      onChange={(e) =>
                        setNuevaClaveInput(
                          e.target.value.replace(/\D/g, '').slice(0, 7),
                        )
                      }
                      disabled={procesando}
                      className={`w-full h-11 px-4 rounded-lg bg-slate-950 border font-mono tabular-nums text-base tracking-widest text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        campoActivo === 'nuevaClave'
                          ? 'border-sky-400'
                          : 'border-slate-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cajero-clave-confirmar"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Confirmar nueva contraseña / PIN
                    </label>
                    <input
                      id="cajero-clave-confirmar"
                      type={mostrarClaves ? 'text' : 'password'}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={7}
                      placeholder="•••••••"
                      value={confirmarClaveInput}
                      onFocus={() => setCampoActivo('confirmarClave')}
                      onChange={(e) =>
                        setConfirmarClaveInput(
                          e.target.value.replace(/\D/g, '').slice(0, 7),
                        )
                      }
                      disabled={procesando}
                      className={`w-full h-11 px-4 rounded-lg bg-slate-950 border font-mono tabular-nums text-base tracking-widest text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                        campoActivo === 'confirmarClave'
                          ? 'border-sky-400'
                          : 'border-slate-700'
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={
                        procesando ||
                        claveActualInput.length !== 7 ||
                        nuevaClaveInput.length !== 7 ||
                        confirmarClaveInput.length !== 7
                      }
                      className="flex-1 min-w-[180px] h-12 px-5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {procesando
                        ? 'Actualizando...'
                        : 'Actualizar contraseña'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMensaje(null);
                        setPantalla('MENU');
                      }}
                      className="h-12 px-4 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 whitespace-nowrap hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="pt-4 mt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Moneda: COP (sin decimales)</span>
              <span>Solo cuentas de ahorros</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <TecladoNumerico
            etiquetaCampoActivo={obtenerEtiquetaCampoActivo()}
            deshabilitado={!tecladoHabilitado}
            onDigito={onTecladoDigito}
            onBorrar={onTecladoBorrar}
            onLimpiar={onTecladoLimpiar}
            onConfirmar={onTecladoConfirmar}
            textoConfirmar={
              pantalla === 'LOGIN'
                ? campoActivo === 'cuenta' && pinInput.length < 7
                  ? 'Siguiente'
                  : 'Entrar'
                : pantalla === 'TRANSFERIR'
                  ? campoActivo !== 'montoTransferencia' &&
                    !montoTransferenciaInput
                    ? 'Siguiente'
                    : 'Transferir'
                  : pantalla === 'PERFIL'
                    ? 'Guardar'
                    : pantalla === 'CAMBIAR_CLAVE'
                      ? (campoActivo === 'claveActual' &&
                          nuevaClaveInput.length < 7) ||
                        (campoActivo === 'nuevaClave' &&
                          confirmarClaveInput.length < 7)
                        ? 'Siguiente'
                        : 'Actualizar'
                      : 'Retirar'
            }
          />

          <ComprobanteOperacion comprobante={ultimoComprobante} />
        </div>
      </section>

      {ultimoComprobante && (
        <div className="hidden print:block">
          <ComprobanteOperacion comprobante={ultimoComprobante} />
        </div>
      )}
    </div>
  );
}
