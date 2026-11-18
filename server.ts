import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import {
  actualizarClientePorAdmin,
  actualizarContrasenaUsuario,
  actualizarPerfilUsuario,
  cambiarEstadoCuenta,
  crearClienteConCuenta,
  crearCuentaAdicionalCliente,
  findCuentaById,
  findCuentaByNumero,
  findUsuarioById,
  findUsuarioByUsername,
  getAdminDashboardStats,
  getCuentasByUsuario,
  getUltimosMovimientos,
  listarClientesConCuentas,
  listarTodasLasCuentas,
  listarTodosLosMovimientos,
  nowDatetime,
  registrarConsignacionAdmin,
  registrarRetiroCajero,
  registrarTransferencia,
  saveDb,
  type EstadoCuenta,
} from './server/bancoStore.ts';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'simulador-bancario-dev-secret-2026';
const COOKIE_CAJERO = 'cajero_session';
const COOKIE_BANCA = 'banca_session';
const COOKIE_ADMIN = 'admin_session';

interface CajeroSessionPayload {
  idCuenta: number;
  idUsuario: number;
  numeroCuenta: string;
  iat: number;
}

interface UsuarioSessionPayload {
  idUsuario: number;
  rol: 'CLIENTE' | 'ADMIN';
  iat: number;
}

function signToken<T extends object>(payload: T): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken<T extends object>(token: string | undefined): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function verifySessionToken(token: string | undefined): CajeroSessionPayload | null {
  const parsed = verifyToken<CajeroSessionPayload>(token);
  if (!parsed || !parsed.idCuenta || !parsed.idUsuario || !parsed.numeroCuenta) {
    return null;
  }
  return parsed;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function setNamedCookie(res: Response, name: string, token: string): void {
  res.append(
    'Set-Cookie',
    `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`,
  );
}

function clearNamedCookie(res: Response, name: string): void {
  res.append(
    'Set-Cookie',
    `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  );
}

function setSessionCookie(res: Response, token: string): void {
  setNamedCookie(res, COOKIE_CAJERO, token);
}

function clearSessionCookie(res: Response): void {
  clearNamedCookie(res, COOKIE_CAJERO);
}

function formatoPesos(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

function validateSession(req: Request, res: Response) {
  const cookies = parseCookies(req);
  const payload = verifySessionToken(cookies[COOKIE_CAJERO]);
  if (!payload) {
    res.status(401).json({
      ok: false,
      sesionCerrada: true,
      mensaje: 'Debes identificarte con tu número de cuenta y PIN para operar.',
    });
    return null;
  }

  const cuenta = findCuentaById(payload.idCuenta);
  const usuario = findUsuarioById(payload.idUsuario);

  if (!cuenta || !usuario || cuenta.id_usuario !== usuario.id_usuario) {
    clearSessionCookie(res);
    res.status(401).json({
      ok: false,
      sesionCerrada: true,
      mensaje: 'La sesión del cajero ya no es válida. Inicia nuevamente.',
    });
    return null;
  }

  // Decisión 8 y RN-06: si la cuenta fue bloqueada o inactivada, cerrar de inmediato
  if (cuenta.estado !== 'ACTIVO') {
    clearSessionCookie(res);
    res.status(403).json({
      ok: false,
      sesionCerrada: true,
      mensaje: `Operación cerrada: la cuenta se encuentra ${cuenta.estado} y no puede operar.`,
    });
    return null;
  }

  return { cuenta, usuario };
}

function validateBancaSession(req: Request, res: Response) {
  const cookies = parseCookies(req);
  const payload = verifyToken<UsuarioSessionPayload>(cookies[COOKIE_BANCA]);
  if (!payload || payload.rol !== 'CLIENTE' || !payload.idUsuario) {
    res.status(401).json({
      ok: false,
      sesionCerrada: true,
      mensaje: 'Inicia sesión en la banca virtual para continuar.',
    });
    return null;
  }

  const usuario = findUsuarioById(payload.idUsuario);
  if (!usuario || usuario.rol !== 'CLIENTE') {
    clearNamedCookie(res, COOKIE_BANCA);
    res.status(401).json({
      ok: false,
      sesionCerrada: true,
      mensaje: 'Tu sesión de banca virtual ya no es válida.',
    });
    return null;
  }

  const cuentas = getCuentasByUsuario(usuario.id_usuario);
  const tieneActiva = cuentas.some((c) => c.estado === 'ACTIVO');
  if (!tieneActiva) {
    clearNamedCookie(res, COOKIE_BANCA);
    res.status(403).json({
      ok: false,
      sesionCerrada: true,
      mensaje:
        'Sesión cerrada: no tienes cuentas activas para operar en la banca virtual.',
    });
    return null;
  }

  return { usuario, cuentas };
}

function validateAdminSession(req: Request, res: Response) {
  const cookies = parseCookies(req);
  const payload = verifyToken<UsuarioSessionPayload>(cookies[COOKIE_ADMIN]);
  if (!payload || payload.rol !== 'ADMIN' || !payload.idUsuario) {
    res.status(401).json({
      ok: false,
      sesionCerrada: true,
      mensaje: 'Inicia sesión como administrador para continuar.',
    });
    return null;
  }

  const admin = findUsuarioById(payload.idUsuario);
  if (!admin || admin.rol !== 'ADMIN') {
    clearNamedCookie(res, COOKIE_ADMIN);
    res.status(401).json({
      ok: false,
      sesionCerrada: true,
      mensaje: 'La sesión administrativa ya no es válida.',
    });
    return null;
  }

  return { admin };
}

function serializeUsuarioPublico(u: NonNullable<ReturnType<typeof findUsuarioById>>) {
  return {
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    apellidos: u.apellidos,
    usuario: u.usuario,
    rol: u.rol,
    correo: u.correo,
    telefono: u.telefono,
    fecha_creacion: u.fecha_creacion,
    cambio_clave: u.cambio_clave,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, modulo: 'cajero-automatico', fecha: nowDatetime() });
  });

  // 1. Identificación en el cajero automático (RF-30, RN-06, Decisión 1, 9, 11)
  app.post('/api/cajero/login', async (req: Request, res: Response) => {
    const numeroCuenta = String(req.body?.numeroCuenta ?? '').trim();
    const pin = String(req.body?.pin ?? '').trim();

    if (!/^\d{6,20}$/.test(numeroCuenta)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa un número de cuenta válido (solo dígitos numéricos).',
      });
    }

    if (!/^\d{7}$/.test(pin)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El PIN debe tener exactamente 7 dígitos numéricos.',
      });
    }

    const cuenta = findCuentaByNumero(numeroCuenta);
    if (!cuenta) {
      return res.status(404).json({
        ok: false,
        mensaje: 'El número de cuenta ingresado no existe en el sistema.',
      });
    }

    const usuario = findUsuarioById(cuenta.id_usuario);
    if (!usuario || usuario.rol !== 'CLIENTE') {
      return res.status(403).json({
        ok: false,
        mensaje: 'Esta cuenta no está habilitada para operar en el cajero.',
      });
    }

    if (cuenta.estado !== 'ACTIVO') {
      return res.status(403).json({
        ok: false,
        mensaje: `Acceso denegado: la cuenta ${cuenta.numero_cuenta} se encuentra en estado ${cuenta.estado}.`,
      });
    }

    // Verificar bloqueo temporal por intentos fallidos (Decisión 9: 10 segundos tras 2 fallos)
    if (usuario.bloqueado_hasta) {
      const hastaMs = new Date(usuario.bloqueado_hasta).getTime();
      const restanteMs = hastaMs - Date.now();
      if (restanteMs > 0) {
        const segundos = Math.ceil(restanteMs / 1000);
        return res.status(429).json({
          ok: false,
          bloqueoRestanteSegundos: segundos,
          mensaje: `Demasiados intentos fallidos. Espera ${segundos} ${
            segundos === 1 ? 'segundo' : 'segundos'
          } e inténtalo de nuevo.`,
        });
      }
      usuario.bloqueado_hasta = null;
      saveDb();
    }

    const pinValido = await bcrypt.compare(pin, usuario.contrasena);
    if (!pinValido) {
      usuario.intentos_fallidos += 1;
      if (usuario.intentos_fallidos >= 2) {
        usuario.intentos_fallidos = 0;
        usuario.bloqueado_hasta = new Date(Date.now() + 10_000).toISOString();
        saveDb();
        return res.status(429).json({
          ok: false,
          bloqueoRestanteSegundos: 10,
          mensaje:
            'PIN incorrecto. Por seguridad, el acceso se bloqueó durante 10 segundos.',
        });
      }
      saveDb();
      return res.status(401).json({
        ok: false,
        intentosRestantes: 1,
        mensaje:
          'PIN incorrecto. Si fallas un intento más, el acceso se bloqueará por 10 segundos.',
      });
    }

    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    saveDb();

    const token = signToken<CajeroSessionPayload>({
      idCuenta: cuenta.id_cuenta,
      idUsuario: usuario.id_usuario,
      numeroCuenta: cuenta.numero_cuenta,
      iat: Date.now(),
    });
    setSessionCookie(res, token);

    return res.json({
      ok: true,
      mensaje: 'Identificación exitosa. Bienvenido al cajero automático.',
      cuenta: {
        id_cuenta: cuenta.id_cuenta,
        numero_cuenta: cuenta.numero_cuenta,
        tipo_cuenta: cuenta.tipo_cuenta,
        saldo: cuenta.saldo,
        estado: cuenta.estado,
      },
      titular: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        usuario: usuario.usuario,
        correo: usuario.correo,
        telefono: usuario.telefono,
        cambio_clave: usuario.cambio_clave,
      },
    });
  });

  // 2. Verificar sesión activa del cajero
  app.get('/api/cajero/sesion', (req: Request, res: Response) => {
    const session = validateSession(req, res);
    if (!session) return;

    const { cuenta, usuario } = session;
    return res.json({
      ok: true,
      cuenta: {
        id_cuenta: cuenta.id_cuenta,
        numero_cuenta: cuenta.numero_cuenta,
        tipo_cuenta: cuenta.tipo_cuenta,
        saldo: cuenta.saldo,
        estado: cuenta.estado,
      },
      titular: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        usuario: usuario.usuario,
        correo: usuario.correo,
        telefono: usuario.telefono,
        cambio_clave: usuario.cambio_clave,
      },
    });
  });

  // 3. Consultar saldo (RF-31, RN-01, RN-08)
  app.get('/api/cajero/saldo', (req: Request, res: Response) => {
    const session = validateSession(req, res);
    if (!session) return;

    const { cuenta } = session;
    return res.json({
      ok: true,
      numero_cuenta: cuenta.numero_cuenta,
      tipo_cuenta: cuenta.tipo_cuenta,
      estado: cuenta.estado,
      saldo: cuenta.saldo,
      consultadoEn: nowDatetime(),
    });
  });

  // 4. Realizar retiro (RF-32, RN-03, RN-04, RN-05, RN-06, RN-08, Decisión 10)
  app.post('/api/cajero/retiros', (req: Request, res: Response) => {
    const session = validateSession(req, res);
    if (!session) return;

    const { cuenta, usuario } = session;
    const rawValor = String(req.body?.valor ?? '').trim();

    if (!/^-?\d+$/.test(rawValor)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'El valor del retiro debe ser un número entero en pesos, sin puntos, comas ni decimales.',
      });
    }

    const valor = Number(rawValor);
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El valor del retiro debe ser mayor que cero.',
      });
    }

    if (valor > cuenta.saldo) {
      return res.status(400).json({
        ok: false,
        saldoDisponible: cuenta.saldo,
        mensaje: `Saldo insuficiente para retirar ${formatoPesos(
          valor,
        )}. El monto debe ser igual o menor a tu saldo disponible (${formatoPesos(
          cuenta.saldo,
        )}).`,
      });
    }

    const { movimiento, saldoAnterior, nuevoSaldo } = registrarRetiroCajero(
      cuenta.id_cuenta,
      valor,
    );

    return res.status(201).json({
      ok: true,
      mensaje: `Retiro realizado con éxito. Nuevo saldo disponible: ${formatoPesos(
        nuevoSaldo,
      )}.`,
      retiro: {
        id_movimiento: movimiento.id_movimiento,
        fecha: movimiento.fecha,
        descripcion: movimiento.descripcion,
        valor_retirado: valor,
        saldo_anterior: saldoAnterior,
        saldo_resultante: nuevoSaldo,
        numero_cuenta: cuenta.numero_cuenta,
        tipo_cuenta: cuenta.tipo_cuenta,
        titular: `${usuario.nombre} ${usuario.apellidos}`,
      },
    });
  });

  // 4b. Realizar transferencia hacia otra cuenta registrada (Punto 6, RN-01, RN-03, RN-05, RN-06, RN-08, Decisión 7, 10)
  app.post('/api/cajero/transferencias', (req: Request, res: Response) => {
    const session = validateSession(req, res);
    if (!session) return;

    const { cuenta, usuario } = session;
    const cuentaDestinoNumero = String(req.body?.cuentaDestino ?? '').trim();
    const rawValor = String(req.body?.valor ?? '').trim();
    const descripcion = String(req.body?.descripcion ?? '').trim();

    if (!/^\d{6,20}$/.test(cuentaDestinoNumero)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'Ingresa un número de cuenta destino válido (entre 6 y 20 dígitos numéricos).',
      });
    }

    if (cuentaDestinoNumero === cuenta.numero_cuenta) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No puedes transferir dinero a la misma cuenta de origen.',
      });
    }

    if (!/^-?\d+$/.test(rawValor)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'El valor a transferir debe ser un número entero en pesos, sin puntos, comas ni decimales.',
      });
    }

    const valor = Number(rawValor);
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El valor a transferir debe ser mayor que cero.',
      });
    }

    const cuentaDestino = findCuentaByNumero(cuentaDestinoNumero);
    if (!cuentaDestino) {
      return res.status(404).json({
        ok: false,
        mensaje: 'La cuenta de destino ingresada no existe en el sistema.',
      });
    }

    const usuarioDestino = findUsuarioById(cuentaDestino.id_usuario);
    if (!usuarioDestino || usuarioDestino.rol !== 'CLIENTE') {
      return res.status(403).json({
        ok: false,
        mensaje:
          'La cuenta de destino no está habilitada para recibir transferencias.',
      });
    }

    if (cuentaDestino.estado === 'INACTIVO') {
      return res.status(400).json({
        ok: false,
        mensaje:
          'La cuenta de destino se encuentra INACTIVO y no puede recibir transferencias.',
      });
    }

    if (valor > cuenta.saldo) {
      return res.status(400).json({
        ok: false,
        saldoDisponible: cuenta.saldo,
        mensaje: `Saldo insuficiente para transferir ${formatoPesos(
          valor,
        )}. El monto debe ser igual o menor a tu saldo disponible (${formatoPesos(
          cuenta.saldo,
        )}).`,
      });
    }

    const resultado = registrarTransferencia(
      cuenta.id_cuenta,
      cuentaDestinoNumero,
      valor,
      descripcion,
    );

    return res.status(201).json({
      ok: true,
      mensaje: `Transferencia realizada con éxito a la cuenta ${resultado.cuentaDestinoNumero}. Nuevo saldo disponible: ${formatoPesos(
        resultado.nuevoSaldoOrigen,
      )}.`,
      transferencia: {
        id_transferencia: resultado.transferencia.id_transferencia,
        id_movimiento: resultado.movimientoOrigen.id_movimiento,
        fecha: resultado.transferencia.fecha,
        descripcion: resultado.transferencia.descripcion,
        valor_transferido: valor,
        saldo_anterior: resultado.saldoAnteriorOrigen,
        saldo_resultante: resultado.nuevoSaldoOrigen,
        numero_cuenta_origen: resultado.cuentaOrigenNumero,
        tipo_cuenta_origen: resultado.cuentaOrigenTipo,
        titular_origen: `${usuario.nombre} ${usuario.apellidos}`,
        numero_cuenta_destino: resultado.cuentaDestinoNumero,
        titular_destino: resultado.titularDestino,
      },
    });
  });

  // 5. Consultar últimos movimientos (RF-33, RN-01, RN-07)
  app.get('/api/cajero/movimientos', (req: Request, res: Response) => {
    const session = validateSession(req, res);
    if (!session) return;

    const { cuenta } = session;
    const rawLimite = Number(req.query.limite ?? 10);
    const limite =
      Number.isInteger(rawLimite) && rawLimite > 0 ? Math.min(rawLimite, 50) : 10;

    const movimientos = getUltimosMovimientos(cuenta.id_cuenta, limite);
    return res.json({
      ok: true,
      numero_cuenta: cuenta.numero_cuenta,
      saldo: cuenta.saldo,
      movimientos,
    });
  });

  // 5b. Modificar datos permitidos del perfil desde el cajero
  app.put('/api/cajero/perfil', (req: Request, res: Response) => {
    const session = validateSession(req, res);
    if (!session) return;

    const nombre = String(req.body?.nombre ?? '').trim();
    const apellidos = String(req.body?.apellidos ?? '').trim();
    const correo = String(req.body?.correo ?? '').trim();
    const telefonoRaw = String(req.body?.telefono ?? '').trim();

    if (nombre.length < 2 || apellidos.length < 2) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Nombre y apellidos son obligatorios (mínimo 2 caracteres).',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa un correo electrónico válido.',
      });
    }
    if (telefonoRaw && !/^\d{7,15}$/.test(telefonoRaw)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El teléfono debe contener entre 7 y 15 dígitos numéricos.',
      });
    }

    try {
      const actualizado = actualizarPerfilUsuario(session.usuario.id_usuario, {
        nombre,
        apellidos,
        correo,
        telefono: telefonoRaw || null,
      });
      return res.json({
        ok: true,
        mensaje: 'Datos de perfil actualizados correctamente.',
        titular: {
          id_usuario: actualizado.id_usuario,
          nombre: actualizado.nombre,
          apellidos: actualizado.apellidos,
          usuario: actualizado.usuario,
          correo: actualizado.correo,
          telefono: actualizado.telefono,
          cambio_clave: actualizado.cambio_clave,
        },
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        mensaje:
          error instanceof Error
            ? error.message
            : 'No fue posible actualizar los datos del perfil.',
      });
    }
  });

  // 5c. Cambiar contraseña / PIN de 7 dígitos desde el cajero (Decisión 1 y 11)
  app.post('/api/cajero/cambiar-clave', async (req: Request, res: Response) => {
    const session = validateSession(req, res);
    if (!session) return;

    const { usuario } = session;
    const claveActual = String(req.body?.claveActual ?? '').trim();
    const nuevaClave = String(req.body?.nuevaClave ?? '').trim();

    if (!/^\d{7}$/.test(claveActual) || !/^\d{7}$/.test(nuevaClave)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'Tanto la contraseña/PIN actual como la nueva deben tener exactamente 7 dígitos numéricos.',
      });
    }

    const coincide = await bcrypt.compare(claveActual, usuario.contrasena);
    if (!coincide) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La contraseña / PIN actual ingresada no es correcta.',
      });
    }

    if (claveActual === nuevaClave) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La nueva contraseña / PIN debe ser diferente a la actual.',
      });
    }

    const hash = await bcrypt.hash(nuevaClave, 10);
    const actualizado = actualizarContrasenaUsuario(usuario.id_usuario, hash, true);

    return res.json({
      ok: true,
      mensaje:
        'Contraseña / PIN actualizado correctamente. También aplica para tu ingreso en la banca virtual.',
      titular: {
        id_usuario: actualizado.id_usuario,
        nombre: actualizado.nombre,
        apellidos: actualizado.apellidos,
        usuario: actualizado.usuario,
        correo: actualizado.correo,
        telefono: actualizado.telefono,
        cambio_clave: actualizado.cambio_clave,
      },
    });
  });

  // 6. Cerrar operación en el cajero (RF-34)
  app.post('/api/cajero/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res);
    return res.json({
      ok: true,
      mensaje: 'Operación finalizada. Retira tu comprobante y recuerda proteger tu PIN.',
    });
  });

  // ============================================================================
  // MÓDULO 1: BANCA VIRTUAL DEL CLIENTE (/api/banca/*)
  // ============================================================================

  app.post('/api/banca/login', async (req: Request, res: Response) => {
    const username = String(req.body?.usuario ?? '').trim();
    const contrasena = String(req.body?.contrasena ?? '').trim();

    if (!username) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa tu nombre de usuario.',
      });
    }
    if (!/^\d{7}$/.test(contrasena)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La contraseña debe tener exactamente 7 dígitos numéricos.',
      });
    }

    const usuario = findUsuarioByUsername(username);
    if (!usuario || usuario.rol !== 'CLIENTE') {
      return res.status(401).json({
        ok: false,
        mensaje: 'Usuario o contraseña incorrectos.',
      });
    }

    if (usuario.bloqueado_hasta) {
      const hastaMs = new Date(usuario.bloqueado_hasta).getTime();
      const restanteMs = hastaMs - Date.now();
      if (restanteMs > 0) {
        const segundos = Math.ceil(restanteMs / 1000);
        return res.status(429).json({
          ok: false,
          bloqueoRestanteSegundos: segundos,
          mensaje: `Demasiados intentos fallidos. Espera ${segundos} ${
            segundos === 1 ? 'segundo' : 'segundos'
          } e inténtalo de nuevo.`,
        });
      }
      usuario.bloqueado_hasta = null;
      saveDb();
    }

    const claveValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!claveValida) {
      usuario.intentos_fallidos += 1;
      if (usuario.intentos_fallidos >= 2) {
        usuario.intentos_fallidos = 0;
        usuario.bloqueado_hasta = new Date(Date.now() + 10_000).toISOString();
        saveDb();
        return res.status(429).json({
          ok: false,
          bloqueoRestanteSegundos: 10,
          mensaje:
            'Contraseña incorrecta. Por seguridad, el acceso se bloqueó durante 10 segundos.',
        });
      }
      saveDb();
      return res.status(401).json({
        ok: false,
        intentosRestantes: 1,
        mensaje:
          'Contraseña incorrecta. Si fallas un intento más, el acceso se bloqueará por 10 segundos.',
      });
    }

    const cuentas = getCuentasByUsuario(usuario.id_usuario);
    const tieneActiva = cuentas.some((c) => c.estado === 'ACTIVO');
    if (!tieneActiva) {
      const estadoPrincipal = cuentas[0]?.estado ?? 'BLOQUEADO';
      return res.status(403).json({
        ok: false,
        mensaje: `Acceso denegado: tu cuenta se encuentra en estado ${estadoPrincipal}.`,
      });
    }

    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    saveDb();

    const token = signToken<UsuarioSessionPayload>({
      idUsuario: usuario.id_usuario,
      rol: 'CLIENTE',
      iat: Date.now(),
    });
    setNamedCookie(res, COOKIE_BANCA, token);

    return res.json({
      ok: true,
      mensaje: 'Bienvenido a tu banca virtual.',
      usuario: serializeUsuarioPublico(usuario),
      cuentas,
    });
  });

  app.get('/api/banca/sesion', (req: Request, res: Response) => {
    const session = validateBancaSession(req, res);
    if (!session) return;
    return res.json({
      ok: true,
      usuario: serializeUsuarioPublico(session.usuario),
      cuentas: session.cuentas,
    });
  });

  app.post('/api/banca/logout', (_req: Request, res: Response) => {
    clearNamedCookie(res, COOKIE_BANCA);
    return res.json({
      ok: true,
      mensaje: 'Has cerrado tu sesión en la banca virtual.',
    });
  });

  app.post('/api/banca/cambiar-clave', async (req: Request, res: Response) => {
    const session = validateBancaSession(req, res);
    if (!session) return;

    const { usuario } = session;
    const claveActual = String(req.body?.claveActual ?? '').trim();
    const nuevaClave = String(req.body?.nuevaClave ?? '').trim();

    if (!/^\d{7}$/.test(claveActual) || !/^\d{7}$/.test(nuevaClave)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Tanto la clave actual como la nueva deben tener exactamente 7 dígitos numéricos.',
      });
    }

    const coincide = await bcrypt.compare(claveActual, usuario.contrasena);
    if (!coincide) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La contraseña actual ingresada no es correcta.',
      });
    }

    if (claveActual === nuevaClave) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La nueva contraseña debe ser diferente a la actual.',
      });
    }

    const hash = await bcrypt.hash(nuevaClave, 10);
    const actualizado = actualizarContrasenaUsuario(usuario.id_usuario, hash, true);

    return res.json({
      ok: true,
      mensaje: 'Contraseña actualizada correctamente. También aplica como nuevo PIN de cajero.',
      usuario: serializeUsuarioPublico(actualizado),
    });
  });

  app.put('/api/banca/perfil', (req: Request, res: Response) => {
    const session = validateBancaSession(req, res);
    if (!session) return;

    const nombre = String(req.body?.nombre ?? '').trim();
    const apellidos = String(req.body?.apellidos ?? '').trim();
    const correo = String(req.body?.correo ?? '').trim();
    const telefonoRaw = String(req.body?.telefono ?? '').trim();

    if (nombre.length < 2 || apellidos.length < 2) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Nombre y apellidos son obligatorios.',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa un correo electrónico válido.',
      });
    }
    if (telefonoRaw && !/^\d{7,15}$/.test(telefonoRaw)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El teléfono debe contener entre 7 y 15 dígitos numéricos.',
      });
    }

    try {
      const actualizado = actualizarPerfilUsuario(session.usuario.id_usuario, {
        nombre,
        apellidos,
        correo,
        telefono: telefonoRaw || null,
      });
      return res.json({
        ok: true,
        mensaje: 'Datos personales actualizados correctamente.',
        usuario: serializeUsuarioPublico(actualizado),
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        mensaje: error instanceof Error ? error.message : 'No fue posible actualizar el perfil.',
      });
    }
  });

  app.get('/api/banca/movimientos', (req: Request, res: Response) => {
    const session = validateBancaSession(req, res);
    if (!session) return;

    const idCuenta = Number(req.query.idCuenta);
    const cuenta =
      session.cuentas.find((c) => c.id_cuenta === idCuenta) ?? session.cuentas[0];

    if (!cuenta) {
      return res.status(404).json({
        ok: false,
        mensaje: 'No se encontró una cuenta asociada al cliente.',
      });
    }

    const rawLimite = Number(req.query.limite ?? 50);
    const limite =
      Number.isInteger(rawLimite) && rawLimite > 0 ? Math.min(rawLimite, 100) : 50;

    return res.json({
      ok: true,
      cuenta,
      movimientos: getUltimosMovimientos(cuenta.id_cuenta, limite),
    });
  });

  app.post('/api/banca/transferencias', (req: Request, res: Response) => {
    const session = validateBancaSession(req, res);
    if (!session) return;

    const idCuentaOrigen = Number(req.body?.idCuentaOrigen);
    const cuentaOrigen = session.cuentas.find((c) => c.id_cuenta === idCuentaOrigen);

    if (!cuentaOrigen) {
      return res.status(403).json({
        ok: false,
        mensaje: 'Solo puedes transferir desde tus propias cuentas registradas.',
      });
    }

    if (cuentaOrigen.estado !== 'ACTIVO') {
      return res.status(403).json({
        ok: false,
        mensaje: `La cuenta origen ${cuentaOrigen.numero_cuenta} se encuentra ${cuentaOrigen.estado} y no puede realizar transferencias.`,
      });
    }

    const cuentaDestinoNumero = String(req.body?.cuentaDestino ?? '').trim();
    const rawValor = String(req.body?.valor ?? '').trim();
    const descripcion = String(req.body?.descripcion ?? '').trim();

    if (!/^\d{6,20}$/.test(cuentaDestinoNumero)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa un número de cuenta destino válido (entre 6 y 20 dígitos numéricos).',
      });
    }

    if (cuentaDestinoNumero === cuentaOrigen.numero_cuenta) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No puedes transferir dinero a la misma cuenta de origen.',
      });
    }

    if (!/^-?\d+$/.test(rawValor)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El valor a transferir debe ser un número entero en pesos, sin puntos, comas ni decimales.',
      });
    }

    const valor = Number(rawValor);
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El valor a transferir debe ser mayor que cero.',
      });
    }

    const cuentaDestino = findCuentaByNumero(cuentaDestinoNumero);
    if (!cuentaDestino) {
      return res.status(404).json({
        ok: false,
        mensaje: 'La cuenta de destino ingresada no existe en el sistema.',
      });
    }

    const usuarioDestino = findUsuarioById(cuentaDestino.id_usuario);
    if (!usuarioDestino || usuarioDestino.rol !== 'CLIENTE') {
      return res.status(403).json({
        ok: false,
        mensaje: 'La cuenta de destino no está habilitada para recibir transferencias.',
      });
    }

    if (cuentaDestino.estado === 'INACTIVO') {
      return res.status(400).json({
        ok: false,
        mensaje: 'La cuenta de destino se encuentra INACTIVO y no puede recibir transferencias.',
      });
    }

    if (valor > cuentaOrigen.saldo) {
      return res.status(400).json({
        ok: false,
        mensaje: `Saldo insuficiente para transferir ${formatoPesos(
          valor,
        )}. Tu saldo disponible es ${formatoPesos(cuentaOrigen.saldo)}.`,
      });
    }

    const resultado = registrarTransferencia(
      cuentaOrigen.id_cuenta,
      cuentaDestinoNumero,
      valor,
      descripcion,
    );

    return res.status(201).json({
      ok: true,
      mensaje: `Transferencia realizada con éxito a la cuenta ${resultado.cuentaDestinoNumero}. Nuevo saldo: ${formatoPesos(
        resultado.nuevoSaldoOrigen,
      )}.`,
      cuentas: getCuentasByUsuario(session.usuario.id_usuario),
      transferencia: {
        id_transferencia: resultado.transferencia.id_transferencia,
        id_movimiento: resultado.movimientoOrigen.id_movimiento,
        fecha: resultado.transferencia.fecha,
        descripcion: resultado.transferencia.descripcion,
        valor_transferido: valor,
        saldo_anterior: resultado.saldoAnteriorOrigen,
        saldo_resultante: resultado.nuevoSaldoOrigen,
        numero_cuenta_origen: resultado.cuentaOrigenNumero,
        tipo_cuenta_origen: resultado.cuentaOrigenTipo,
        titular_origen: `${session.usuario.nombre} ${session.usuario.apellidos}`,
        numero_cuenta_destino: resultado.cuentaDestinoNumero,
        titular_destino: resultado.titularDestino,
      },
    });
  });

  // ============================================================================
  // MÓDULO 2: MÓDULO ADMINISTRATIVO DEL BANCO (/api/admin/*)
  // ============================================================================

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const username = String(req.body?.usuario ?? '').trim();
    const contrasena = String(req.body?.contrasena ?? '').trim();

    if (!username) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa el usuario del administrador.',
      });
    }
    if (!/^\d{7}$/.test(contrasena)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La contraseña administrativa debe tener exactamente 7 dígitos numéricos.',
      });
    }

    const admin = findUsuarioByUsername(username);
    if (!admin || admin.rol !== 'ADMIN') {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales administrativas incorrectas.',
      });
    }

    if (admin.bloqueado_hasta) {
      const hastaMs = new Date(admin.bloqueado_hasta).getTime();
      const restanteMs = hastaMs - Date.now();
      if (restanteMs > 0) {
        const segundos = Math.ceil(restanteMs / 1000);
        return res.status(429).json({
          ok: false,
          bloqueoRestanteSegundos: segundos,
          mensaje: `Acceso administrativo bloqueado temporalmente. Espera ${segundos} ${
            segundos === 1 ? 'segundo' : 'segundos'
          }.`,
        });
      }
      admin.bloqueado_hasta = null;
      saveDb();
    }

    const claveValida = await bcrypt.compare(contrasena, admin.contrasena);
    if (!claveValida) {
      admin.intentos_fallidos += 1;
      if (admin.intentos_fallidos >= 2) {
        admin.intentos_fallidos = 0;
        admin.bloqueado_hasta = new Date(Date.now() + 10_000).toISOString();
        saveDb();
        return res.status(429).json({
          ok: false,
          bloqueoRestanteSegundos: 10,
          mensaje:
            'Contraseña incorrecta. Por seguridad, el acceso se bloqueó durante 10 segundos.',
        });
      }
      saveDb();
      return res.status(401).json({
        ok: false,
        intentosRestantes: 1,
        mensaje:
          'Contraseña incorrecta. Si fallas un intento más, el acceso se bloqueará por 10 segundos.',
      });
    }

    admin.intentos_fallidos = 0;
    admin.bloqueado_hasta = null;
    saveDb();

    const token = signToken<UsuarioSessionPayload>({
      idUsuario: admin.id_usuario,
      rol: 'ADMIN',
      iat: Date.now(),
    });
    setNamedCookie(res, COOKIE_ADMIN, token);

    return res.json({
      ok: true,
      mensaje: 'Acceso administrativo autorizado.',
      admin: serializeUsuarioPublico(admin),
    });
  });

  app.get('/api/admin/sesion', (req: Request, res: Response) => {
    const session = validateAdminSession(req, res);
    if (!session) return;
    return res.json({
      ok: true,
      admin: serializeUsuarioPublico(session.admin),
    });
  });

  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    clearNamedCookie(res, COOKIE_ADMIN);
    return res.json({
      ok: true,
      mensaje: 'Sesión administrativa cerrada.',
    });
  });

  app.get('/api/admin/resumen', (req: Request, res: Response) => {
    const session = validateAdminSession(req, res);
    if (!session) return;

    return res.json({
      ok: true,
      stats: getAdminDashboardStats(),
      clientes: listarClientesConCuentas(),
      cuentas: listarTodasLasCuentas(),
      movimientos: listarTodosLosMovimientos(120),
    });
  });

  app.post('/api/admin/clientes', async (req: Request, res: Response) => {
    const session = validateAdminSession(req, res);
    if (!session) return;

    const nombre = String(req.body?.nombre ?? '').trim();
    const apellidos = String(req.body?.apellidos ?? '').trim();
    const usuario = String(req.body?.usuario ?? '').trim();
    const correo = String(req.body?.correo ?? '').trim();
    const telefonoRaw = String(req.body?.telefono ?? '').trim();
    const claveTemporal = String(req.body?.claveTemporal ?? '').trim();
    const saldoRaw = String(req.body?.saldoInicial ?? '0').trim() || '0';

    if (nombre.length < 2 || apellidos.length < 2) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Nombre y apellidos son obligatorios.',
      });
    }
    if (!/^[a-zA-Z0-9._-]{4,50}$/.test(usuario)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El usuario debe tener entre 4 y 50 caracteres (letras, números, punto o guion).',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa un correo electrónico válido.',
      });
    }
    if (telefonoRaw && !/^\d{7,15}$/.test(telefonoRaw)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El teléfono debe tener entre 7 y 15 dígitos numéricos.',
      });
    }
    if (!/^\d{7}$/.test(claveTemporal)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La clave temporal debe tener exactamente 7 dígitos numéricos.',
      });
    }
    if (!/^\d+$/.test(saldoRaw)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El saldo inicial debe ser un número entero en pesos, sin decimales.',
      });
    }
    const saldoInicial = Number(saldoRaw);

    try {
      const passwordHash = await bcrypt.hash(claveTemporal, 10);
      const { cliente, cuenta } = crearClienteConCuenta({
        nombre,
        apellidos,
        usuario,
        correo,
        telefono: telefonoRaw || null,
        passwordHash,
        saldoInicial,
      });

      return res.status(201).json({
        ok: true,
        mensaje: `Cliente ${cliente.nombre} ${cliente.apellidos} creado con cuenta ${cuenta.numero_cuenta}.`,
        cliente: serializeUsuarioPublico(cliente),
        cuenta,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        mensaje: error instanceof Error ? error.message : 'No fue posible crear el cliente.',
      });
    }
  });

  app.put('/api/admin/clientes/:id', async (req: Request, res: Response) => {
    const session = validateAdminSession(req, res);
    if (!session) return;

    const idUsuario = Number(req.params.id);
    const existente = findUsuarioById(idUsuario);
    if (!existente || existente.rol !== 'CLIENTE') {
      return res.status(404).json({
        ok: false,
        mensaje: 'Cliente no encontrado.',
      });
    }

    const nombre = String(req.body?.nombre ?? '').trim();
    const apellidos = String(req.body?.apellidos ?? '').trim();
    const usuario = String(req.body?.usuario ?? existente.usuario).trim();
    const correo = String(req.body?.correo ?? '').trim();
    const telefonoRaw = String(req.body?.telefono ?? '').trim();
    const claveTemporal = String(req.body?.claveTemporal ?? '').trim();
    const exigirCambioClave =
      typeof req.body?.exigirCambioClave === 'boolean'
        ? req.body.exigirCambioClave
        : true;

    if (nombre.length < 2 || apellidos.length < 2) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Nombre y apellidos son obligatorios.',
      });
    }
    if (!/^[a-zA-Z0-9._-]{4,50}$/.test(usuario)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'El usuario debe tener entre 4 y 50 caracteres (letras, números, punto o guion).',
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa un correo electrónico válido.',
      });
    }
    if (telefonoRaw && !/^\d{7,15}$/.test(telefonoRaw)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El teléfono debe tener entre 7 y 15 dígitos numéricos.',
      });
    }
    if (claveTemporal && !/^\d{7}$/.test(claveTemporal)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La nueva clave / PIN debe tener exactamente 7 dígitos numéricos.',
      });
    }

    try {
      const passwordHash = claveTemporal
        ? await bcrypt.hash(claveTemporal, 10)
        : undefined;
      const actualizado = actualizarClientePorAdmin(idUsuario, {
        nombre,
        apellidos,
        usuario,
        correo,
        telefono: telefonoRaw || null,
        passwordHash,
        exigirCambioClave,
      });
      return res.json({
        ok: true,
        mensaje: claveTemporal
          ? 'Información y nueva clave del cliente actualizadas correctamente.'
          : 'Información del cliente actualizada correctamente.',
        cliente: serializeUsuarioPublico(actualizado),
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        mensaje: error instanceof Error ? error.message : 'No fue posible actualizar el cliente.',
      });
    }
  });

  app.post('/api/admin/clientes/:id/cuentas', (req: Request, res: Response) => {
    const session = validateAdminSession(req, res);
    if (!session) return;

    const idUsuario = Number(req.params.id);
    const saldoRaw = String(req.body?.saldoInicial ?? '0').trim() || '0';
    if (!/^\d+$/.test(saldoRaw)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El saldo inicial debe ser un entero en pesos, sin decimales.',
      });
    }

    try {
      const cuenta = crearCuentaAdicionalCliente(idUsuario, Number(saldoRaw));
      return res.status(201).json({
        ok: true,
        mensaje: `Cuenta de ahorros ${cuenta.numero_cuenta} creada correctamente.`,
        cuenta,
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        mensaje: error instanceof Error ? error.message : 'No fue posible crear la cuenta.',
      });
    }
  });

  app.patch('/api/admin/cuentas/:id/estado', (req: Request, res: Response) => {
    const session = validateAdminSession(req, res);
    if (!session) return;

    const idCuenta = Number(req.params.id);
    const estado = String(req.body?.estado ?? '').trim() as EstadoCuenta;
    if (!['ACTIVO', 'INACTIVO', 'BLOQUEADO'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Estado de cuenta inválido. Debe ser ACTIVO, BLOQUEADO o INACTIVO.',
      });
    }

    try {
      const cuenta = cambiarEstadoCuenta(idCuenta, estado);
      return res.json({
        ok: true,
        mensaje: `Estado de la cuenta ${cuenta.numero_cuenta} actualizado a ${cuenta.estado}.`,
        cuenta,
      });
    } catch (error) {
      return res.status(404).json({
        ok: false,
        mensaje: error instanceof Error ? error.message : 'Cuenta no encontrada.',
      });
    }
  });

  app.post('/api/admin/consignaciones', (req: Request, res: Response) => {
    const session = validateAdminSession(req, res);
    if (!session) return;

    const numeroCuenta = String(req.body?.numeroCuenta ?? '').trim();
    const rawValor = String(req.body?.valor ?? '').trim();
    const descripcion = String(req.body?.descripcion ?? '').trim();

    if (!/^\d{6,20}$/.test(numeroCuenta)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Ingresa un número de cuenta válido (solo dígitos).',
      });
    }
    if (!/^-?\d+$/.test(rawValor)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El valor de la consignación debe ser un número entero en pesos, sin decimales.',
      });
    }
    const valor = Number(rawValor);
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El valor de la consignación debe ser mayor que cero.',
      });
    }

    try {
      const resultado = registrarConsignacionAdmin(numeroCuenta, valor, descripcion);
      return res.status(201).json({
        ok: true,
        mensaje: `Consignación de ${formatoPesos(valor)} realizada a la cuenta ${resultado.cuenta.numero_cuenta}. Nuevo saldo: ${formatoPesos(
          resultado.nuevoSaldo,
        )}.`,
        consignacion: {
          numero_cuenta: resultado.cuenta.numero_cuenta,
          titular: resultado.titular,
          saldo_anterior: resultado.saldoAnterior,
          valor_consignado: valor,
          nuevo_saldo: resultado.nuevoSaldo,
          movimiento: resultado.movimiento,
        },
      });
    } catch (error) {
      return res.status(400).json({
        ok: false,
        mensaje: error instanceof Error ? error.message : 'No fue posible realizar la consignación.',
      });
    }
  });

  // Integración Vite en desarrollo o archivos estáticos en producción
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Express del Cajero Automático escuchando en puerto ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
