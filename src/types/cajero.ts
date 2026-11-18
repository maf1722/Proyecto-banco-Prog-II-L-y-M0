export type EstadoCuenta = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

export type TipoMovimiento =
  | 'CONSIGNACION'
  | 'RETIRO'
  | 'TRANSFERENCIA_ENVIADA'
  | 'TRANSFERENCIA_RECIBIDA';

export interface CuentaCajero {
  id_cuenta: number;
  numero_cuenta: string;
  tipo_cuenta: 'AHORROS';
  saldo: number;
  estado: EstadoCuenta;
}

export interface TitularCajero {
  id_usuario: number;
  nombre: string;
  apellidos: string;
  usuario: string;
  correo: string;
  telefono: string | null;
  cambio_clave?: boolean;
}

export interface MovimientoCajero {
  id_movimiento: number;
  id_cuenta: number;
  id_transferencia: number | null;
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string | null;
  valor: number;
  saldo_resultante: number;
}

export interface ComprobanteRetiro {
  id_movimiento: number;
  fecha: string;
  descripcion: string;
  valor_retirado: number;
  saldo_anterior: number;
  saldo_resultante: number;
  numero_cuenta: string;
  tipo_cuenta: string;
  titular: string;
}

export interface ComprobanteTransferencia {
  id_transferencia: number;
  id_movimiento: number;
  fecha: string;
  descripcion: string | null;
  valor_transferido: number;
  saldo_anterior: number;
  saldo_resultante: number;
  numero_cuenta_origen: string;
  tipo_cuenta_origen: string;
  titular_origen: string;
  numero_cuenta_destino: string;
  titular_destino: string;
}

export type ComprobanteOperacionData =
  | ({ tipoOperacion: 'RETIRO' } & ComprobanteRetiro)
  | ({ tipoOperacion: 'TRANSFERENCIA' } & ComprobanteTransferencia);

export type PantallaCajero =
  | 'LOGIN'
  | 'MENU'
  | 'SALDO'
  | 'RETIRO'
  | 'EXITO_RETIRO'
  | 'TRANSFERIR'
  | 'EXITO_TRANSFERENCIA'
  | 'MOVIMIENTOS'
  | 'PERFIL'
  | 'CAMBIAR_CLAVE';

