'use client';

import { useRouter } from 'next/navigation';
import { Pedido } from '@/lib/types';

type Props = {
  pedido: Pedido;
  showMoney?: boolean;
};

const MAX_CHIPS = 5;

// Mapa de colores FIGS → hex para el puntito del chip
const COLOR_HEX: Record<string, string> = {
  'NEGRO': '#1A1A1A', 'BLACK': '#1A1A1A',
  'BLANCO': '#F5F5F0', 'BLANCO OPTICO': '#F5F5F0', 'WHITE': '#F5F5F0',
  'AZUL MARINO': '#1F3A5F', 'NAVY': '#1F3A5F', 'DEEP ROYAL BLUE': '#1F3A5F', 'ROYAL BLUE': '#2B4C9B', 'AZUL REAL': '#2B4C9B',
  'AZUL CARIBE': '#3AA8C1', 'AZUL CARIBEÑO': '#3AA8C1', 'CARIBBEAN BLUE': '#3AA8C1', 'AZUL USA': '#2C5DA8',
  'CELESTE': '#9FD4E3', 'AZUL CIELO': '#9FD4E3',
  'PURPLE HAZE': '#7E6B9E', 'WILD IRIS': '#8E7CC3', 'MALVA': '#9C7BA0',
  'POP RED': '#C0392B', 'BURGUNDY': '#6E2433', 'FIRESIDE': '#A23E2E',
  'SHOCKING PINK': '#E84393', 'RAPID RESPONSE PINK': '#D81B60',
  'CHARCOAL': '#4A4A4A', 'GRAFITO': '#3A3A3A', 'ESPRESSO': '#4B3621',
  'WALNUT': '#7A5C3E', 'LAGUNA': '#4FA3A3',
  'SEAMIST': '#A8C8B5', 'SEA MIST': '#A8C8B5', 'SEAGLASS': '#B8D8C8', 'FOREST GREEN': '#2E5A3E', 'MOSS': '#6B7A4F', 'DEEP REEF': '#1E5E5E',
  'BUTTERYELLOW': '#F2D98D', 'CREAMSICLE': '#F2A65A',
  'HUNTER GREEN': '#355E3B', 'DARK HARBOR': '#2C3E50',
};

function colorHex(color: string): string {
  return COLOR_HEX[String(color || '').toUpperCase().trim()] || '#CCCCC4';
}

function shortName(it: { NOMBRE_PRODUCTO?: string; SKU?: string; TIPO_PRENDA?: string }): string {
  const n = it.NOMBRE_PRODUCTO || it.SKU || it.TIPO_PRENDA || '';
  // Acortar nombres largos para el chip
  return n.replace(/Rafaela oversized Scrub Jumpsuit/i, 'Jumpsuit Rafaela')
          .replace(/Pantalón |Pantalon /i, 'Pant ')
          .trim();
}

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

// Chip de ítem con punto de color
function ItemChip({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 100, fontSize: 11,
      background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-soft)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorHex(color), border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
      {nombre}
    </span>
  );
}

// Bloque de info del cliente (dirección, ciudad, especialización) + chips de ítems
function CardExtra({ pedido }: { pedido: Pedido }) {
  const items = (pedido.items || []).filter(
    it => String((it as any).ESTATUS_ITEM || '').toUpperCase().trim() !== 'CANCELADO'
  );
  const dir = pedido.cliente?.DIRECCION?.trim();
  const ciudad = pedido.cliente?.CIUDAD?.trim();
  const industria = pedido.cliente?.INDUSTRIA?.trim();
  const muchos = items.length > MAX_CHIPS;
  const visibles = muchos ? [] : items;

  const hayInfo = dir || industria || items.length > 0;
  if (!hayInfo) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(dir || ciudad || industria) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--text-soft)' }}>
          {dir && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--text-faint)' }}>📍</span>
              {dir}{ciudad ? `, ${ciudad}` : ''}
            </span>
          )}
          {industria && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: 'var(--text-faint)' }}>🩺</span>
              {industria}
            </span>
          )}
        </div>
      )}

      {items.length > 0 && (
        muchos ? (
          <div style={{ fontSize: 12, color: 'var(--blue)', fontStyle: 'italic' }}>
            {items.length} prendas · chequear los ítems más a fondo →
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {visibles.map((it, i) => (
              <ItemChip key={i} nombre={shortName(it as any)} color={(it as any).COLOR} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function OrderCard({ pedido, showMoney = false }: Props) {
  const router = useRouter();
  const atraso = diasAtraso(pedido);
  const saldo = pedido.totales.saldo;
  const hasRegalo = !!pedido.REGALO_ENVIADO && String(pedido.REGALO_ENVIADO).trim() !== '';

  return (
    <div className="card clickable" onClick={() => router.push(`/pedido/${encodeURIComponent(pedido.ORDEN_ID)}`)} style={{ padding: '20px 24px' }}>
      {/* DESKTOP */}
      <div className="hide-mobile">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 24, alignItems: 'center' }}>
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
        <CardExtra pedido={pedido} />
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
        {showMoney && (saldo > 0
          ? <div style={{ fontSize: 11, color: 'var(--amber)' }}>Saldo: {fmtMoney(saldo)}</div>
          : <div style={{ fontSize: 11, color: 'var(--green)' }}>Pagado</div>
        )}
        <CardExtra pedido={pedido} />
      </div>
    </div>
  );
}
