import { Printer, Receipt } from 'lucide-react';
import type { ComprobanteOperacionData } from '../types/cajero';
import { formatearFecha, pesosCOP } from '../utils/formato';

interface ComprobanteOperacionProps {
  comprobante: ComprobanteOperacionData | null;
}

export function ComprobanteOperacion({ comprobante }: ComprobanteOperacionProps) {
  if (!comprobante) {
    return (
      <section
        aria-label="Comprobante de operación"
        className="bg-white border border-slate-200 rounded-xl p-5"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Comprobante de operación
          </h2>
          <Receipt className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Cuando realices un retiro o una transferencia, aquí se generará el
          comprobante con la fecha, el valor de la operación y el saldo resultante.
        </p>
      </section>
    );
  }

  const esTransferencia = comprobante.tipoOperacion === 'TRANSFERENCIA';

  return (
    <section
      id="comprobante-imprimible"
      aria-label={
        esTransferencia ? 'Comprobante de transferencia' : 'Comprobante de retiro'
      }
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-dashed border-slate-300">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {esTransferencia
              ? 'Comprobante de transferencia'
              : 'Comprobante de retiro'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            {esTransferencia
              ? `Transferencia #${comprobante.id_transferencia}`
              : `Movimiento #${comprobante.id_movimiento}`}{' '}
            · {formatearFecha(comprobante.fecha)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B3D6B] print:hidden"
        >
          <Printer className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Imprimir</span>
        </button>
      </div>

      {esTransferencia ? (
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Titular origen</dt>
            <dd className="font-medium text-slate-900 text-right">
              {comprobante.titular_origen}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">
              Cuenta origen ({comprobante.tipo_cuenta_origen})
            </dt>
            <dd className="font-mono tabular-nums font-medium text-slate-900">
              {comprobante.numero_cuenta_origen}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Cuenta destino</dt>
            <dd className="font-mono tabular-nums font-medium text-slate-900">
              {comprobante.numero_cuenta_destino}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Destinatario</dt>
            <dd className="font-medium text-slate-900 text-right">
              {comprobante.titular_destino}
            </dd>
          </div>
          {comprobante.descripcion && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Descripción</dt>
              <dd className="font-medium text-slate-900 text-right">
                {comprobante.descripcion}
              </dd>
            </div>
          )}
          <div className="pt-2.5 border-t border-dashed border-slate-200 flex items-center justify-between gap-4">
            <dt className="text-slate-500">Saldo anterior</dt>
            <dd className="font-mono tabular-nums text-slate-700">
              {pesosCOP(comprobante.saldo_anterior)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-700 font-medium">Valor transferido</dt>
            <dd className="font-mono tabular-nums font-semibold text-[#DC2626]">
              -{pesosCOP(comprobante.valor_transferido)}
            </dd>
          </div>
          <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-4">
            <dt className="text-slate-900 font-semibold">Nuevo saldo</dt>
            <dd className="font-mono tabular-nums text-base font-bold text-[#16A34A]">
              {pesosCOP(comprobante.saldo_resultante)}
            </dd>
          </div>
        </dl>
      ) : (
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Titular</dt>
            <dd className="font-medium text-slate-900 text-right">
              {comprobante.titular}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Cuenta ({comprobante.tipo_cuenta})</dt>
            <dd className="font-mono tabular-nums font-medium text-slate-900">
              {comprobante.numero_cuenta}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Descripción</dt>
            <dd className="font-medium text-slate-900">{comprobante.descripcion}</dd>
          </div>
          <div className="pt-2.5 border-t border-dashed border-slate-200 flex items-center justify-between gap-4">
            <dt className="text-slate-500">Saldo anterior</dt>
            <dd className="font-mono tabular-nums text-slate-700">
              {pesosCOP(comprobante.saldo_anterior)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-700 font-medium">Valor retirado</dt>
            <dd className="font-mono tabular-nums font-semibold text-[#DC2626]">
              -{pesosCOP(comprobante.valor_retirado)}
            </dd>
          </div>
          <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-4">
            <dt className="text-slate-900 font-semibold">Nuevo saldo</dt>
            <dd className="font-mono tabular-nums text-base font-bold text-[#16A34A]">
              {pesosCOP(comprobante.saldo_resultante)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
