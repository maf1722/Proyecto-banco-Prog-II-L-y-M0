import type { ComprobanteTransferencia, MovimientoCajero } from '../types/cajero';
import type { CuentaBancaria, UsuarioPublico } from '../types/banco';

export interface BancaApiResponse<T> {
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
): Promise<BancaApiResponse<T>> {
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

export function obtenerSesionBanca() {
  return request<{ usuario: UsuarioPublico; cuentas: CuentaBancaria[] }>(
    '/api/banca/sesion',
  );
}

export function iniciarSesionBanca(usuario: string, contrasena: string) {
  return request<{ usuario: UsuarioPublico; cuentas: CuentaBancaria[] }>(
    '/api/banca/login',
    {
      method: 'POST',
      body: JSON.stringify({ usuario, contrasena }),
    },
  );
}

export function cerrarSesionBanca() {
  return request<{ ok: boolean }>('/api/banca/logout', { method: 'POST' });
}

export function cambiarClaveBanca(claveActual: string, nuevaClave: string) {
  return request<{ usuario: UsuarioPublico }>('/api/banca/cambiar-clave', {
    method: 'POST',
    body: JSON.stringify({ claveActual, nuevaClave }),
  });
}

export function actualizarPerfilBanca(datos: {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
}) {
  return request<{ usuario: UsuarioPublico }>('/api/banca/perfil', {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

export function consultarMovimientosBanca(idCuenta: number, limite = 50) {
  return request<{ cuenta: CuentaBancaria; movimientos: MovimientoCajero[] }>(
    `/api/banca/movimientos?idCuenta=${idCuenta}&limite=${limite}`,
  );
}

export function realizarTransferenciaBanca(
  idCuentaOrigen: number,
  cuentaDestino: string,
  valor: string,
  descripcion: string,
) {
  return request<{
    cuentas: CuentaBancaria[];
    transferencia: ComprobanteTransferencia;
  }>('/api/banca/transferencias', {
    method: 'POST',
    body: JSON.stringify({ idCuentaOrigen, cuentaDestino, valor, descripcion }),
  });
}
