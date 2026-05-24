'use client';

import { useRouter } from 'next/navigation';
import { Pedido } from '@/lib/types';

type Props = {
  pedido: Pedido;
  showMoney?: boolean;
};

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateShort(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function diasAtraso(pedido: Pedido): number | null {
  if (pedido.ESTATUS_ENVIO === 'ENTREGADO' || pedido.ESTATUS_ENVIO === 'CANCELADO') return null;
  if (!pedido.F_ENTREGA_EST) return null;
  if (isNaN(Date.parse(pedido.F_ENTREGA_EST + 'T12:00:00'))) return null;
  const entrega = new Date(pedido.F_ENTREGA_EST + 'T12:00:00');
  const limite = new Date(entrega);
  limite.setDate(limite.getDate() + 14);
  const hoy = new Date();
  if (hoy > limite) return Math.floor((hoy.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24));
  return null;
}

function stateClass(estado: string) {
  return 'state-' + estado.replace(/\s+/g, '-');
}

export default function OrderCard({ pedido, showMoney = false }: Props) {
  const router = useRouter();
  const atraso = diasAtraso(pedido);
  const saldo = pedido.totales.saldo;
  const hasRegalo = !!pedido.REGALO_ENVIADO && String(pedido.REGALO_ENVIADO).trim() !== '';

  return (
    <div className="card clickable" onClick={() => router.push(`/pedido/${encodeURIComponent(pedido.ORDEN_ID)}`)} style={{ padding: '20px 24px' }}>
      {/* DESKTOP */}
      <div className="hide-mobile" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h3 className="display" style={{ fontSize: 20, fontWeight: 400, margin: 0 }}>{pedido.CLIENTE_NOMBRE}</h3>
            {hasRegalo && <span style={{ color: 'var(--gold)', fontSize: 14 }}>✦</span>}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-soft)' }}>
            <span className="mono">{pedido.ORDEN_ID}</span>
            <span>·</span>
            <span>{fmtDateShort(pedido.F_ORDEN)}</span>
            {pedido.cliente?.CIUDAD && (
              <>
                <span>·</span>
                <span>{pedido.cliente.CIUDAD}</span>
              </>
            )}
          </div>
        </div>
        <div>
          <span className={`pill ${stateClass(pedido.ESTATUS_ENVIO)}`}>{pedido.ESTATUS_ENVIO}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          {atraso !== null
            ? <div style={{ color: 'var(--rose)', fontSize: 12, fontWeight: 500 }}>Atrasado {atraso}d</div>
            : <div style={{ color: 'var(--text-soft)', fontSize: 12 }}>A tiempo</div>
          }
          {showMoney && (saldo > 0
            ? <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>Saldo: {fmtMoney(saldo)}</div>
            : <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>Pagado</div>
          )}
        </div>
        <div style={{ color: 'var(--text-faint)', fontSize: 18 }}>→</div>
      </div>

      {/* MOBILE */}
      <div className="show-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 className="display" style={{ fontSize: 18, fontWeight: 400, margin: 0 }}>{pedido.CLIENTE_NOMBRE}</h3>
              {hasRegalo && <span style={{ color: 'var(--gold)', fontSize: 14 }}>✦</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>
              <span className="mono">{pedido.ORDEN_ID}</span> {pedido.cliente?.CIUDAD ? `· ${pedido.cliente.CIUDAD}` : ''}
            </div>
          </div>
          <div style={{ color: 'var(--text-faint)', fontSize: 18 }}>→</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span className={`pill ${stateClass(pedido.ESTATUS_ENVIO)}`}>{pedido.ESTATUS_ENVIO}</span>
          {atraso !== null
            ? <span style={{ color: 'var(--rose)', fontSize: 11, fontWeight: 500 }}>Atrasado {atraso}d</span>
            : <span style={{ color: 'var(--text-soft)', fontSize: 11 }}>A tiempo</span>
          }
        </div>
      </div>
    </div>
  );
}
