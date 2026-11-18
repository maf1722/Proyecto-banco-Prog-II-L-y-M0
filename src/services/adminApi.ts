import type { EstadoCuenta } from '../types/cajero';
import type {
  AdminDashboardStats,
  ClienteConCuentas,
  ConsignacionResultado,
  CuentaBancaria,
  CuentaConTitular,
  MovimientoGeneral,
  UsuarioPublico,
} from '../types/banco';

export interface AdminApiResponse<T> {
  ok: boolean;
  status: number;
  data: T & {
    ok?: boolean;
    mensaje?: string;
    sesionCerrada?: boolean;
    bloqueoRestanteSegundos?: number;
    intentosRestantes?: number;
  };
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<AdminApiResponse<T>> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: {
        mensaje: 'No hay conexión con el servidor del banco.',
      } as T & { mensaje: string },
    };
  }
}

export function obtenerSesionAdmin() {
  return request<{ admin: UsuarioPublico }>('/api/admin/sesion');
}

export function iniciarSesionAdmin(usuario: string, contrasena: string) {
  return request<{ admin: UsuarioPublico }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ usuario, contrasena }),
  });
}

export function cerrarSesionAdmin() {
  return request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' });
}

export function obtenerResumenAdmin() {
  return request<{
    stats: AdminDashboardStats;
    clientes: ClienteConCuentas[];
    cuentas: CuentaConTitular[];
    movimientos: MovimientoGeneral[];
  }>('/api/admin/resumen');
}

export function crearClienteAdmin(datos: {
  nombre: string;
  apellidos: string;
  usuario: string;
  correo: string;
  telefono: string;
  claveTemporal: string;
  saldoInicial: string;
}) {
  return request<{ cliente: UsuarioPublico; cuenta: CuentaBancaria }>(
    '/api/admin/clientes',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
  );
}

export function actualizarClienteAdmin(
  idUsuario: number,
  datos: {
    nombre: string;
    apellidos: string;
    usuario?: string;
    correo: string;
    telefono: string;
    claveTemporal?: string;
    exigirCambioClave?: boolean;
  },
) {
  return request<{ cliente: UsuarioPublico }>(`/api/admin/clientes/${idUsuario}`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

export function crearCuentaAdicionalAdmin(
  idUsuario: number,
  saldoInicial: string,
) {
  return request<{ cuenta: CuentaBancaria }>(
    `/api/admin/clientes/${idUsuario}/cuentas`,
    {
      method: 'POST',
      body: JSON.stringify({ saldoInicial }),
    },
  );
}

export function cambiarEstadoCuentaAdmin(
  idCuenta: number,
  estado: EstadoCuenta,
) {
  return request<{ cuenta: CuentaBancaria }>(
    `/api/admin/cuentas/${idCuenta}/estado`,
    {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    },
  );
}

export function realizarConsignacionAdmin(
  numeroCuenta: string,
  valor: string,
  descripcion: string,
) {
  return request<{ consignacion: ConsignacionResultado }>(
    '/api/admin/consignaciones',
    {
      method: 'POST',
      body: JSON.stringify({ numeroCuenta, valor, descripcion }),
    },
  );
}
