import fs from 'fs';
import path from 'path';

export type RolUsuario = 'CLIENTE' | 'ADMIN';
export type TipoCuenta = 'AHORROS';
export type EstadoCuenta = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
export type TipoMovimiento =
  | 'CONSIGNACION'
  | 'RETIRO'
  | 'TRANSFERENCIA_ENVIADA'
  | 'TRANSFERENCIA_RECIBIDA';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  usuario: string;
  contrasena: string;
  rol: RolUsuario;
  correo: string;
  telefono: string | null;
  fecha_creacion: string;
  cambio_clave: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: string | null;
}

export interface Cuenta {
  id_cuenta: number;
  numero_cuenta: string;
  id_usuario: number;
  tipo_cuenta: TipoCuenta;
  saldo: number;
  estado: EstadoCuenta;
  fecha_creacion: string;
}

export interface Transferencia {
  id_transferencia: number;
  id_cuenta_origen: number;
  id_cuenta_destino: number;
  valor: number;
  descripcion: string | null;
  fecha: string;
}

export interface Movimiento {
  id_movimiento: number;
  id_cuenta: number;
  id_transferencia: number | null;
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string | null;
  valor: number;
  saldo_resultante: number;
}

export interface BancoDatabase {
  usuarios: Usuario[];
  cuentas: Cuenta[];
  transferencias: Transferencia[];
  movimientos: Movimiento[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'banco.json');

const FECHA_BASE = '2026-11-17 09:00:00';

// Datos iniciales idénticos a database.sql (contraseñas con hash bcrypt de 7 dígitos)
const SEED_DATA: BancoDatabase = {
  usuarios: [
    {
      id_usuario: 1,
      nombre: 'Carlos',
      apellidos: 'Mendoza Ruiz',
      usuario: 'admin_banco',
      contrasena:
        '$2b$10$PBlG3eucJA01kQDBi1LwgOSWdOo1FgOOO1A.JwFEMEKBVWYMtqOoG', // 1234567
      rol: 'ADMIN',
      correo: 'admin@banco.com',
      telefono: '3001112233',
      fecha_creacion: FECHA_BASE,
      cambio_clave: false,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    },
    {
      id_usuario: 2,
      nombre: 'Laura',
      apellidos: 'Gómez Pérez',
      usuario: 'laura.gomez',
      contrasena:
        '$2b$10$d8zZ5G6c3cRFYQCBWs/hjuqK6xSPELVyOe53W7OfS29J07IYvpLJq', // 2222222
      rol: 'CLIENTE',
      correo: 'laura.gomez@email.com',
      telefono: '3104445566',
      fecha_creacion: FECHA_BASE,
      cambio_clave: false,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    },
    {
      id_usuario: 3,
      nombre: 'Andrés',
      apellidos: 'Ramírez Soto',
      usuario: 'andres.ramirez',
      contrasena:
        '$2b$10$0gOjd/mQeX/YHE1bSUsMaeZjk2/6.HpxQuH.wmDmwbHvvUog1c7C2', // 3333333
      rol: 'CLIENTE',
      correo: 'andres.ramirez@email.com',
      telefono: '3207778899',
      fecha_creacion: FECHA_BASE,
      cambio_clave: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    },
    {
      id_usuario: 4,
      nombre: 'Sofía',
      apellidos: 'Castro López',
      usuario: 'sofia.castro',
      contrasena:
        '$2b$10$BuqGE8M4L6HYHXam9pwKHux2pBigFJNhtKIk3c98RdQjHvVHIJDSC', // 4444444
      rol: 'CLIENTE',
      correo: 'sofia.castro@email.com',
      telefono: '3159990011',
      fecha_creacion: FECHA_BASE,
      cambio_clave: false,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
    },
  ],
  cuentas: [
    {
      id_cuenta: 1,
      numero_cuenta: '1001000001',
      id_usuario: 2,
      tipo_cuenta: 'AHORROS',
      saldo: 1200000,
      estado: 'ACTIVO',
      fecha_creacion: FECHA_BASE,
    },
    {
      id_cuenta: 2,
      numero_cuenta: '1001000002',
      id_usuario: 2,
      tipo_cuenta: 'AHORROS',
      saldo: 500000,
      estado: 'ACTIVO',
      fecha_creacion: FECHA_BASE,
    },
    {
      id_cuenta: 3,
      numero_cuenta: '1001000003',
      id_usuario: 3,
      tipo_cuenta: 'AHORROS',
      saldo: 1100000,
      estado: 'ACTIVO',
      fecha_creacion: FECHA_BASE,
    },
    {
      id_cuenta: 4,
      numero_cuenta: '1001000004',
      id_usuario: 4,
      tipo_cuenta: 'AHORROS',
      saldo: 250000,
      estado: 'BLOQUEADO',
      fecha_creacion: FECHA_BASE,
    },
  ],
  transferencias: [
    {
      id_transferencia: 1,
      id_cuenta_origen: 1,
      id_cuenta_destino: 3,
      valor: 200000,
      descripcion: 'Pago de arriendo mensual',
      fecha: '2026-11-17 09:05:00',
    },
  ],
  movimientos: [
    {
      id_movimiento: 1,
      id_cuenta: 1,
      id_transferencia: null,
      fecha: '2026-11-17 09:00:00',
      tipo: 'CONSIGNACION',
      descripcion: 'Depósito inicial apertura de cuenta',
      valor: 1500000,
      saldo_resultante: 1500000,
    },
    {
      id_movimiento: 2,
      id_cuenta: 2,
      id_transferencia: null,
      fecha: '2026-11-17 09:01:00',
      tipo: 'CONSIGNACION',
      descripcion: 'Depósito inicial cuenta de ahorros',
      valor: 500000,
      saldo_resultante: 500000,
    },
    {
      id_movimiento: 3,
      id_cuenta: 3,
      id_transferencia: null,
      fecha: '2026-11-17 09:02:00',
      tipo: 'CONSIGNACION',
      descripcion: 'Depósito inicial apertura de cuenta',
      valor: 1000000,
      saldo_resultante: 1000000,
    },
    {
      id_movimiento: 4,
      id_cuenta: 4,
      id_transferencia: null,
      fecha: '2026-11-17 09:03:00',
      tipo: 'CONSIGNACION',
      descripcion: 'Depósito inicial apertura de cuenta',
      valor: 250000,
      saldo_resultante: 250000,
    },
    {
      id_movimiento: 5,
      id_cuenta: 1,
      id_transferencia: null,
      fecha: '2026-11-17 09:04:00',
      tipo: 'RETIRO',
      descripcion: 'Retiro cajero',
      valor: -100000,
      saldo_resultante: 1400000,
    },
    {
      id_movimiento: 6,
      id_cuenta: 1,
      id_transferencia: 1,
      fecha: '2026-11-17 09:05:00',
      tipo: 'TRANSFERENCIA_ENVIADA',
      descripcion: 'Transferencia a cuenta 1001000003 - Pago de arriendo mensual',
      valor: -200000,
      saldo_resultante: 1200000,
    },
    {
      id_movimiento: 7,
      id_cuenta: 3,
      id_transferencia: 1,
      fecha: '2026-11-17 09:05:00',
      tipo: 'TRANSFERENCIA_RECIBIDA',
      descripcion: 'Transferencia desde cuenta 1001000001 - Pago de arriendo mensual',
      valor: 200000,
      saldo_resultante: 1200000,
    },
    {
      id_movimiento: 8,
      id_cuenta: 3,
      id_transferencia: null,
      fecha: '2026-11-17 09:06:00',
      tipo: 'RETIRO',
      descripcion: 'Compra en datáfono',
      valor: -100000,
      saldo_resultante: 1100000,
    },
  ],
};

function cloneSeed(): BancoDatabase {
  return JSON.parse(JSON.stringify(SEED_DATA)) as BancoDatabase;
}

function ensureStoreFile(): BancoDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial = cloneSeed();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw) as BancoDatabase;
  } catch {
    const fallback = cloneSeed();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
}

let dbCache: BancoDatabase = ensureStoreFile();

export function readDb(): BancoDatabase {
  return dbCache;
}

export function saveDb(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf8');
  fs.renameSync(tempFile, DATA_FILE);
}

export function nowDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function findCuentaByNumero(numeroCuenta: string): Cuenta | undefined {
  return dbCache.cuentas.find((c) => c.numero_cuenta === numeroCuenta);
}

export function findCuentaById(idCuenta: number): Cuenta | undefined {
  return dbCache.cuentas.find((c) => c.id_cuenta === idCuenta);
}

export function findUsuarioById(idUsuario: number): Usuario | undefined {
  return dbCache.usuarios.find((u) => u.id_usuario === idUsuario);
}

export function getUltimosMovimientos(idCuenta: number, limite = 10): Movimiento[] {
  return dbCache.movimientos
    .filter((m) => m.id_cuenta === idCuenta)
    .sort((a, b) => {
      if (b.fecha !== a.fecha) {
        return b.fecha.localeCompare(a.fecha);
      }
      return b.id_movimiento - a.id_movimiento;
    })
    .slice(0, limite);
}

export function registrarRetiroCajero(
  idCuenta: number,
  valor: number,
): { movimiento: Movimiento; saldoAnterior: number; nuevoSaldo: number } {
  const cuenta = findCuentaById(idCuenta);
  if (!cuenta) {
    throw new Error('La cuenta no existe');
  }
  if (cuenta.estado !== 'ACTIVO') {
    throw new Error(`La cuenta se encuentra ${cuenta.estado}`);
  }
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error('El valor debe ser un entero mayor que cero');
  }
  if (valor > cuenta.saldo) {
    throw new Error('Saldo insuficiente');
  }

  const saldoAnterior = cuenta.saldo;
  const nuevoSaldo = saldoAnterior - valor;
  cuenta.saldo = nuevoSaldo;

  const nextId =
    dbCache.movimientos.reduce((max, m) => Math.max(max, m.id_movimiento), 0) + 1;

  const movimiento: Movimiento = {
    id_movimiento: nextId,
    id_cuenta: cuenta.id_cuenta,
    id_transferencia: null,
    fecha: nowDatetime(),
    tipo: 'RETIRO',
    descripcion: 'Retiro cajero',
    valor: -valor,
    saldo_resultante: nuevoSaldo,
  };

  dbCache.movimientos.push(movimiento);
  saveDb();

  return { movimiento, saldoAnterior, nuevoSaldo };
}

export interface TransferenciaResultado {
  transferencia: Transferencia;
  movimientoOrigen: Movimiento;
  movimientoDestino: Movimiento;
  cuentaOrigenNumero: string;
  cuentaOrigenTipo: TipoCuenta;
  cuentaDestinoNumero: string;
  titularDestino: string;
  saldoAnteriorOrigen: number;
  nuevoSaldoOrigen: number;
}

export function registrarTransferencia(
  idCuentaOrigen: number,
  numeroCuentaDestino: string,
  valor: number,
  descripcionRaw?: string,
): TransferenciaResultado {
  const cuentaOrigen = findCuentaById(idCuentaOrigen);
  if (!cuentaOrigen) {
    throw new Error('La cuenta de origen no existe');
  }
  if (cuentaOrigen.estado !== 'ACTIVO') {
    throw new Error(`La cuenta de origen se encuentra ${cuentaOrigen.estado}`);
  }

  const cuentaDestino = findCuentaByNumero(numeroCuentaDestino.trim());
  if (!cuentaDestino) {
    throw new Error('La cuenta de destino no existe en el sistema');
  }
  if (cuentaDestino.id_cuenta === cuentaOrigen.id_cuenta) {
    throw new Error('No puedes transferir dinero a la misma cuenta de origen');
  }

  const usuarioDestino = findUsuarioById(cuentaDestino.id_usuario);
  if (!usuarioDestino || usuarioDestino.rol !== 'CLIENTE') {
    throw new Error('La cuenta de destino no está habilitada para recibir transferencias');
  }
  // Decisión 7: una cuenta INACTIVO no puede recibir dinero; BLOQUEADO sí puede recibirlo
  if (cuentaDestino.estado === 'INACTIVO') {
    throw new Error('La cuenta de destino se encuentra INACTIVO y no puede recibir transferencias');
  }

  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error('El valor a transferir debe ser un entero mayor que cero');
  }
  if (valor > cuentaOrigen.saldo) {
    throw new Error('Saldo insuficiente para realizar la transferencia');
  }

  const descripcionLimpia = (descripcionRaw ?? '').trim().slice(0, 100);
  const fecha = nowDatetime();

  const nextTransferenciaId =
    dbCache.transferencias.reduce((max, t) => Math.max(max, t.id_transferencia), 0) + 1;
  const nextMovimientoId =
    dbCache.movimientos.reduce((max, m) => Math.max(max, m.id_movimiento), 0) + 1;

  // 1. Descontar dinero de la cuenta origen
  const saldoAnteriorOrigen = cuentaOrigen.saldo;
  const nuevoSaldoOrigen = saldoAnteriorOrigen - valor;
  cuentaOrigen.saldo = nuevoSaldoOrigen;

  // 2. Incrementar saldo de la cuenta destino
  const nuevoSaldoDestino = cuentaDestino.saldo + valor;
  cuentaDestino.saldo = nuevoSaldoDestino;

  // 3. Registrar transferencia
  const transferencia: Transferencia = {
    id_transferencia: nextTransferenciaId,
    id_cuenta_origen: cuentaOrigen.id_cuenta,
    id_cuenta_destino: cuentaDestino.id_cuenta,
    valor,
    descripcion: descripcionLimpia || null,
    fecha,
  };
  dbCache.transferencias.push(transferencia);

  const sufijoDesc = descripcionLimpia ? ` - ${descripcionLimpia}` : '';

  // 4. Registrar movimiento en la cuenta origen y en la cuenta destino
  const movimientoOrigen: Movimiento = {
    id_movimiento: nextMovimientoId,
    id_cuenta: cuentaOrigen.id_cuenta,
    id_transferencia: transferencia.id_transferencia,
    fecha,
    tipo: 'TRANSFERENCIA_ENVIADA',
    descripcion: `Transferencia a cuenta ${cuentaDestino.numero_cuenta}${sufijoDesc}`,
    valor: -valor,
    saldo_resultante: nuevoSaldoOrigen,
  };

  const movimientoDestino: Movimiento = {
    id_movimiento: nextMovimientoId + 1,
    id_cuenta: cuentaDestino.id_cuenta,
    id_transferencia: transferencia.id_transferencia,
    fecha,
    tipo: 'TRANSFERENCIA_RECIBIDA',
    descripcion: `Transferencia desde cuenta ${cuentaOrigen.numero_cuenta}${sufijoDesc}`,
    valor,
    saldo_resultante: nuevoSaldoDestino,
  };

  dbCache.movimientos.push(movimientoOrigen, movimientoDestino);
  saveDb();

  return {
    transferencia,
    movimientoOrigen,
    movimientoDestino,
    cuentaOrigenNumero: cuentaOrigen.numero_cuenta,
    cuentaOrigenTipo: cuentaOrigen.tipo_cuenta,
    cuentaDestinoNumero: cuentaDestino.numero_cuenta,
    titularDestino: `${usuarioDestino.nombre} ${usuarioDestino.apellidos}`,
    saldoAnteriorOrigen,
    nuevoSaldoOrigen,
  };
}

export function findUsuarioByUsername(username: string): Usuario | undefined {
  const normalizado = username.trim().toLowerCase();
  return dbCache.usuarios.find((u) => u.usuario.toLowerCase() === normalizado);
}

export function findUsuarioByCorreo(correo: string): Usuario | undefined {
  const normalizado = correo.trim().toLowerCase();
  return dbCache.usuarios.find((u) => u.correo.toLowerCase() === normalizado);
}

export function getCuentasByUsuario(idUsuario: number): Cuenta[] {
  return dbCache.cuentas
    .filter((c) => c.id_usuario === idUsuario)
    .sort((a, b) => a.id_cuenta - b.id_cuenta);
}

export function actualizarPerfilUsuario(
  idUsuario: number,
  datos: { nombre: string; apellidos: string; correo: string; telefono: string | null },
): Usuario {
  const usuario = findUsuarioById(idUsuario);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }
  const correoExistente = findUsuarioByCorreo(datos.correo);
  if (correoExistente && correoExistente.id_usuario !== idUsuario) {
    throw new Error('Ya existe otro usuario registrado con ese correo electrónico');
  }
  usuario.nombre = datos.nombre.trim();
  usuario.apellidos = datos.apellidos.trim();
  usuario.correo = datos.correo.trim().toLowerCase();
  usuario.telefono = datos.telefono ? datos.telefono.trim() : null;
  saveDb();
  return usuario;
}

export function actualizarContrasenaUsuario(
  idUsuario: number,
  passwordHash: string,
  limpiarCambioClave = true,
): Usuario {
  const usuario = findUsuarioById(idUsuario);
  if (!usuario) {
    throw new Error('Usuario no encontrado');
  }
  usuario.contrasena = passwordHash;
  if (limpiarCambioClave) {
    usuario.cambio_clave = false;
  }
  saveDb();
  return usuario;
}

export function actualizarClientePorAdmin(
  idUsuario: number,
  datos: {
    nombre: string;
    apellidos: string;
    usuario: string;
    correo: string;
    telefono: string | null;
    passwordHash?: string;
    exigirCambioClave?: boolean;
  },
): Usuario {
  const cliente = findUsuarioById(idUsuario);
  if (!cliente || cliente.rol !== 'CLIENTE') {
    throw new Error('Cliente no encontrado');
  }

  const usuarioExistente = findUsuarioByUsername(datos.usuario);
  if (usuarioExistente && usuarioExistente.id_usuario !== idUsuario) {
    throw new Error('Ya existe otro usuario registrado con ese nombre de usuario');
  }

  const correoExistente = findUsuarioByCorreo(datos.correo);
  if (correoExistente && correoExistente.id_usuario !== idUsuario) {
    throw new Error('Ya existe otro usuario registrado con ese correo electrónico');
  }

  cliente.nombre = datos.nombre.trim();
  cliente.apellidos = datos.apellidos.trim();
  cliente.usuario = datos.usuario.trim().toLowerCase();
  cliente.correo = datos.correo.trim().toLowerCase();
  cliente.telefono = datos.telefono ? datos.telefono.trim() : null;

  if (datos.passwordHash) {
    cliente.contrasena = datos.passwordHash;
    cliente.cambio_clave = datos.exigirCambioClave ?? true;
    cliente.intentos_fallidos = 0;
    cliente.bloqueado_hasta = null;
  }

  saveDb();
  return cliente;
}

export interface AdminDashboardStats {
  totalClientes: number;
  cuentasActivas: number;
  cuentasBloqueadas: number;
  cuentasInactivas: number;
  totalCuentas: number;
  sumaTotalSaldos: number;
}

export function getAdminDashboardStats(): AdminDashboardStats {
  const clientes = dbCache.usuarios.filter((u) => u.rol === 'CLIENTE');
  const cuentas = dbCache.cuentas;
  return {
    totalClientes: clientes.length,
    cuentasActivas: cuentas.filter((c) => c.estado === 'ACTIVO').length,
    cuentasBloqueadas: cuentas.filter((c) => c.estado === 'BLOQUEADO').length,
    cuentasInactivas: cuentas.filter((c) => c.estado === 'INACTIVO').length,
    totalCuentas: cuentas.length,
    sumaTotalSaldos: cuentas.reduce((sum, c) => sum + c.saldo, 0),
  };
}

export interface ClienteConCuentas {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  usuario: string;
  correo: string;
  telefono: string | null;
  fecha_creacion: string;
  cambio_clave: boolean;
  cuentas: Cuenta[];
  saldo_total: number;
}

export function listarClientesConCuentas(): ClienteConCuentas[] {
  return dbCache.usuarios
    .filter((u) => u.rol === 'CLIENTE')
    .sort((a, b) => a.id_usuario - b.id_usuario)
    .map((u) => {
      const cuentas = getCuentasByUsuario(u.id_usuario);
      return {
        id_usuario: u.id_usuario,
        nombre: u.nombre,
        apellidos: u.apellidos,
        usuario: u.usuario,
        correo: u.correo,
        telefono: u.telefono,
        fecha_creacion: u.fecha_creacion,
        cambio_clave: u.cambio_clave,
        cuentas,
        saldo_total: cuentas.reduce((acc, c) => acc + c.saldo, 0),
      };
    });
}

export interface CuentaConTitular extends Cuenta {
  titular: string;
  usuario: string;
}

export function listarTodasLasCuentas(): CuentaConTitular[] {
  return dbCache.cuentas
    .slice()
    .sort((a, b) => a.id_cuenta - b.id_cuenta)
    .map((c) => {
      const u = findUsuarioById(c.id_usuario);
      return {
        ...c,
        titular: u ? `${u.nombre} ${u.apellidos}` : 'Titular desconocido',
        usuario: u ? u.usuario : '',
      };
    });
}

export interface MovimientoGeneral extends Movimiento {
  numero_cuenta: string;
  titular: string;
}

export function listarTodosLosMovimientos(limite = 100): MovimientoGeneral[] {
  return dbCache.movimientos
    .slice()
    .sort((a, b) => {
      if (b.fecha !== a.fecha) {
        return b.fecha.localeCompare(a.fecha);
      }
      return b.id_movimiento - a.id_movimiento;
    })
    .slice(0, limite)
    .map((m) => {
      const cuenta = findCuentaById(m.id_cuenta);
      const u = cuenta ? findUsuarioById(cuenta.id_usuario) : undefined;
      return {
        ...m,
        numero_cuenta: cuenta ? cuenta.numero_cuenta : String(m.id_cuenta),
        titular: u ? `${u.nombre} ${u.apellidos}` : 'Desconocido',
      };
    });
}

function generarNumeroCuentaUnico(): string {
  const usados = new Set(dbCache.cuentas.map((c) => c.numero_cuenta));
  let candidato = 1001000001 + dbCache.cuentas.length;
  while (usados.has(String(candidato))) {
    candidato += 1;
  }
  return String(candidato);
}

export function crearClienteConCuenta(datos: {
  nombre: string;
  apellidos: string;
  usuario: string;
  correo: string;
  telefono: string | null;
  passwordHash: string;
  saldoInicial: number;
}): { cliente: Usuario; cuenta: Cuenta } {
  if (findUsuarioByUsername(datos.usuario)) {
    throw new Error('Ya existe un usuario con ese nombre de usuario');
  }
  if (findUsuarioByCorreo(datos.correo)) {
    throw new Error('Ya existe un usuario registrado con ese correo electrónico');
  }
  if (!Number.isInteger(datos.saldoInicial) || datos.saldoInicial < 0) {
    throw new Error('El saldo inicial debe ser un entero mayor o igual a cero');
  }

  const fecha = nowDatetime();
  const nextUserId =
    dbCache.usuarios.reduce((max, u) => Math.max(max, u.id_usuario), 0) + 1;
  const nextCuentaId =
    dbCache.cuentas.reduce((max, c) => Math.max(max, c.id_cuenta), 0) + 1;

  const cliente: Usuario = {
    id_usuario: nextUserId,
    nombre: datos.nombre.trim(),
    apellidos: datos.apellidos.trim(),
    usuario: datos.usuario.trim().toLowerCase(),
    contrasena: datos.passwordHash,
    rol: 'CLIENTE',
    correo: datos.correo.trim().toLowerCase(),
    telefono: datos.telefono ? datos.telefono.trim() : null,
    fecha_creacion: fecha,
    cambio_clave: true,
    intentos_fallidos: 0,
    bloqueado_hasta: null,
  };

  const cuenta: Cuenta = {
    id_cuenta: nextCuentaId,
    numero_cuenta: generarNumeroCuentaUnico(),
    id_usuario: cliente.id_usuario,
    tipo_cuenta: 'AHORROS',
    saldo: datos.saldoInicial,
    estado: 'ACTIVO',
    fecha_creacion: fecha,
  };

  dbCache.usuarios.push(cliente);
  dbCache.cuentas.push(cuenta);

  if (datos.saldoInicial > 0) {
    const nextMovId =
      dbCache.movimientos.reduce((max, m) => Math.max(max, m.id_movimiento), 0) + 1;
    dbCache.movimientos.push({
      id_movimiento: nextMovId,
      id_cuenta: cuenta.id_cuenta,
      id_transferencia: null,
      fecha,
      tipo: 'CONSIGNACION',
      descripcion: 'Depósito inicial apertura de cuenta',
      valor: datos.saldoInicial,
      saldo_resultante: datos.saldoInicial,
    });
  }

  saveDb();
  return { cliente, cuenta };
}

export function crearCuentaAdicionalCliente(
  idUsuario: number,
  saldoInicial = 0,
): Cuenta {
  const usuario = findUsuarioById(idUsuario);
  if (!usuario || usuario.rol !== 'CLIENTE') {
    throw new Error('El cliente indicado no existe');
  }
  if (!Number.isInteger(saldoInicial) || saldoInicial < 0) {
    throw new Error('El saldo inicial debe ser un entero mayor o igual a cero');
  }

  const fecha = nowDatetime();
  const nextCuentaId =
    dbCache.cuentas.reduce((max, c) => Math.max(max, c.id_cuenta), 0) + 1;

  const cuenta: Cuenta = {
    id_cuenta: nextCuentaId,
    numero_cuenta: generarNumeroCuentaUnico(),
    id_usuario: usuario.id_usuario,
    tipo_cuenta: 'AHORROS',
    saldo: saldoInicial,
    estado: 'ACTIVO',
    fecha_creacion: fecha,
  };

  dbCache.cuentas.push(cuenta);

  if (saldoInicial > 0) {
    const nextMovId =
      dbCache.movimientos.reduce((max, m) => Math.max(max, m.id_movimiento), 0) + 1;
    dbCache.movimientos.push({
      id_movimiento: nextMovId,
      id_cuenta: cuenta.id_cuenta,
      id_transferencia: null,
      fecha,
      tipo: 'CONSIGNACION',
      descripcion: 'Depósito inicial cuenta de ahorros',
      valor: saldoInicial,
      saldo_resultante: saldoInicial,
    });
  }

  saveDb();
  return cuenta;
}

export function cambiarEstadoCuenta(
  idCuenta: number,
  nuevoEstado: EstadoCuenta,
): Cuenta {
  const cuenta = findCuentaById(idCuenta);
  if (!cuenta) {
    throw new Error('La cuenta no existe');
  }
  cuenta.estado = nuevoEstado;
  saveDb();
  return cuenta;
}

export function registrarConsignacionAdmin(
  numeroCuenta: string,
  valor: number,
  descripcionRaw?: string,
): {
  cuenta: Cuenta;
  movimiento: Movimiento;
  titular: string;
  saldoAnterior: number;
  nuevoSaldo: number;
} {
  const cuenta = findCuentaByNumero(numeroCuenta.trim());
  if (!cuenta) {
    throw new Error('La cuenta indicada no existe en el sistema');
  }
  const usuario = findUsuarioById(cuenta.id_usuario);
  if (!usuario || usuario.rol !== 'CLIENTE') {
    throw new Error('Solo se pueden realizar consignaciones a cuentas de clientes');
  }
  if (cuenta.estado === 'INACTIVO') {
    throw new Error('La cuenta se encuentra INACTIVO y no admite consignaciones');
  }
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error('El valor de la consignación debe ser un entero mayor que cero');
  }

  const saldoAnterior = cuenta.saldo;
  const nuevoSaldo = saldoAnterior + valor;
  cuenta.saldo = nuevoSaldo;

  const descripcionLimpia = (descripcionRaw ?? '').trim().slice(0, 120);
  const nextMovId =
    dbCache.movimientos.reduce((max, m) => Math.max(max, m.id_movimiento), 0) + 1;

  const movimiento: Movimiento = {
    id_movimiento: nextMovId,
    id_cuenta: cuenta.id_cuenta,
    id_transferencia: null,
    fecha: nowDatetime(),
    tipo: 'CONSIGNACION',
    descripcion: descripcionLimpia || 'Consignación administrativa',
    valor,
    saldo_resultante: nuevoSaldo,
  };

  dbCache.movimientos.push(movimiento);
  saveDb();

  return {
    cuenta,
    movimiento,
    titular: `${usuario.nombre} ${usuario.apellidos}`,
    saldoAnterior,
    nuevoSaldo,
  };
}


