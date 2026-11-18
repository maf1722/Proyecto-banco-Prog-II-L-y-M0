import type {
  ComprobanteRetiro,
  ComprobanteTransferencia,
  CuentaCajero,
  MovimientoCajero,
  TitularCajero,
} from '../types/cajero';

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T & {
    ok?: boolean;
    mensaje?: string;
    sesionCerrada?: boolean;
    bloqueoRestanteSegundos?: number;
    intentosRestantes?: number;
    saldoDisponible?: number;
  };
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
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
    return {
      ok: res.ok,
      status: res.status,
      data,
    };
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

export function obtenerSesionCajero() {
  return request<{ cuenta: CuentaCajero; titular: TitularCajero }>(
    '/api/cajero/sesion',
  );
}

export function iniciarSesionCajero(numeroCuenta: string, pin: string) {
  return request<{ cuenta: CuentaCajero; titular: TitularCajero }>(
    '/api/cajero/login',
    {
      method: 'POST',
      body: JSON.stringify({ numeroCuenta, pin }),
    },
  );
}

export function consultarSaldoCajero() {
  return request<{
    numero_cuenta: string;
    tipo_cuenta: 'AHORROS';
    estado: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
    saldo: number;
    consultadoEn: string;
  }>('/api/cajero/saldo');
}

export function realizarRetiroCajero(valor: string) {
  return request<{ retiro: ComprobanteRetiro }>('/api/cajero/retiros', {
    method: 'POST',
    body: JSON.stringify({ valor }),
  });
}

export function realizarTransferenciaCajero(
  cuentaDestino: string,
  valor: string,
  descripcion: string,
) {
  return request<{ transferencia: ComprobanteTransferencia }>(
    '/api/cajero/transferencias',
    {
      method: 'POST',
      body: JSON.stringify({ cuentaDestino, valor, descripcion }),
    },
  );
}

export function consultarMovimientosCajero(limite = 10) {
  return request<{
    numero_cuenta: string;
    saldo: number;
    movimientos: MovimientoCajero[];
  }>(`/api/cajero/movimientos?limite=${limite}`);
}

export function actualizarPerfilCajero(datos: {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
}) {
  return request<{ titular: TitularCajero }>('/api/cajero/perfil', {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

export function cambiarClaveCajero(claveActual: string, nuevaClave: string) {
  return request<{ titular: TitularCajero }>('/api/cajero/cambiar-clave', {
    method: 'POST',
    body: JSON.stringify({ claveActual, nuevaClave }),
  });
}

export function cerrarOperacionCajero() {
  return request<{ ok: boolean }>('/api/cajero/logout', {
    method: 'POST',
  });
}
