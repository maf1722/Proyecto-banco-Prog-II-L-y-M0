import type {
  CuentaCajero,
  EstadoCuenta,
  MovimientoCajero,
  TipoMovimiento,
} from './cajero';

export type ModuloSistema = 'BANCA_VIRTUAL' | 'CAJERO' | 'ADMINISTRACION';

export interface UsuarioPublico {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  usuario: string;
  rol: 'CLIENTE' | 'ADMIN';
  correo: string;
  telefono: string | null;
  fecha_creacion: string;
  cambio_clave: boolean;
}

export interface CuentaBancaria extends CuentaCajero {
  id_usuario: number;
  fecha_creacion: string;
}

export interface AdminDashboardStats {
  totalClientes: number;
  cuentasActivas: number;
  cuentasBloqueadas: number;
  cuentasInactivas: number;
  totalCuentas: number;
  sumaTotalSaldos: number;
}

export interface ClienteConCuentas extends UsuarioPublico {
  cuentas: CuentaBancaria[];
  saldo_total: number;
}

export interface CuentaConTitular extends CuentaBancaria {
  titular: string;
  usuario: string;
}

export interface MovimientoGeneral {
  id_movimiento: number;
  id_cuenta: number;
  id_transferencia: number | null;
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string | null;
  valor: number;
  saldo_resultante: number;
  numero_cuenta: string;
  titular: string;
}

export interface ConsignacionResultado {
  numero_cuenta: string;
  titular: string;
  saldo_anterior: number;
  valor_consignado: number;
  nuevo_saldo: number;
  movimiento: MovimientoCajero;
}

export type EstadoCuentaFiltro = 'TODAS' | EstadoCuenta;
