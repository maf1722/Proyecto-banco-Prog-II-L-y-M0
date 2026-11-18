const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function pesosCOP(valor: number): string {
  return formatoCOP.format(valor);
}

export function nombreTipoMovimiento(tipo: string): string {
  switch (tipo) {
    case 'CONSIGNACION':
      return 'Consignación';
    case 'RETIRO':
      return 'Retiro';
    case 'TRANSFERENCIA_ENVIADA':
      return 'Transferencia enviada';
    case 'TRANSFERENCIA_RECIBIDA':
      return 'Transferencia recibida';
    default:
      return tipo;
  }
}

export function formatearFecha(fechaSql: string): string {
  if (!fechaSql) return '';
  const iso = fechaSql.includes('T') ? fechaSql : fechaSql.replace(' ', 'T');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fechaSql;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}
