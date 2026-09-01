'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pedido } from '@/lib/types';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

type Props = {
  pedido: Pedido;
  showMoney?: boolean;
};

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

function generarMensajeCobro(pedido: Pedido): string {
  const nombre = pedido.CLIENTE_NOMBRE || pedido.NOMBRE || '';
  const saldo = pedido.totales?.saldo ?? 0;
  let mensaje = `💕 ¡Hola ${nombre}! 💕\n\n`;
  mensaje += `Te escribimos para recordarte el saldo pendiente de tu pedido:\n`;
  mensaje += `💰 Saldo pendiente: *$${saldo.toFixed(2)}*\n\n`;
  mensaje += `💳 Puedes realizar tu pago a cualquiera de estas cuentas:\n\n`;
  mensaje += `💛 Banco Pichincha #2215262086 (Mildred Zamora)\n`;
  mensaje += `🩷 Banco Guayaquil #0050468351 (Freddy Moreno)\n`;
  mensaje += `💳 Si deseas pagar con tarjeta, avísanos y te enviaremos el link de pago por PayPhone.`;
  return mensaje;
}

// Mismo mensaje que en el detalle del pedido — horarios de envío + saldo si aplica.
function generarMensajeListoParaEnviar(pedido: Pedido): string {
  const saldo = pedido.totales?.saldo ?? 0;
  let mensaje = `💕 *¡Tu FIGS te está esperando!* 💕\n\n`;
  mensaje += `🚚 Nuestros envíos (delivery o Servientrega) se realizan en los siguientes horarios:\n`;
  mensaje += `🗓️ *Martes y Jueves*\n`;
  mensaje += `🕦 11:30 a. m. – 3:30 p. m.\n`;
  mensaje += `🗓️ *Viernes*\n`;
  mensaje += `🕥 10:30 a. m. – 4:00 p. m.\n\n`;
  mensaje += `📦 ¡Tu pedido ya está listo para ser entregado!\n`;
  if (saldo > 0.005) {
    mensaje += `\n💰 Saldo pendiente: *$${saldo.toFixed(2)}*\n`;
  }
  mensaje += `\n💳 Puedes realizar tu pago a cualquiera de estas cuentas:\n\n`;
  mensaje += `💛 Banco Pichincha #2215262086 (Mildred Zamora)\n`;
  mensaje += `🩷 Banco Guayaquil #0050468351 (Freddy Moreno)\n`;
  mensaje += `💳 Si deseas pagar con tarjeta, avísanos y te enviaremos el link de pago por PayPhone.`;
  return mensaje;
}

function calcularDiasAtraso(pedido: Pedido): number | null {
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

// Chip de ítem con punto de color, talla y color escrito
function ItemChip({ nombre, talla, longitud, color }: { nombre: string; talla?: string; longitud?: string; color?: string }) {
  const tallaTxt = [talla, longitud].filter(Boolean).join(' ').trim();
  const colorTxt = color ? String(color).trim() : '';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 100, fontSize: 11,
      background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-soft)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorHex(color || ''), border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 }} />
      <span style={{ color: 'var(--text)' }}>{nombre}</span>
      {tallaTxt && <span style={{ color: 'var(--text-faint)' }}>· {tallaTxt}</span>}
      {colorTxt && <span style={{ color: 'var(--text-soft)' }}>· {colorTxt}</span>}
    </span>
  );
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

// Bloque de info del cliente (dirección, teléfono, cédula/RUC, industria) + chips de TODOS los ítems
// Campo libre de courier — solo informativo, guarda al salir del campo o
// al presionar Enter. No afecta costos ni lógica de envío.
function CourierInput({ ordenId, valorInicial }: { ordenId: string; valorInicial: string }) {
  const [valor, setValor] = useState(valorInicial);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setValor(valorInicial); }, [valorInicial]);

  async function guardar() {
    if (valor === valorInicial) return;
    const user = auth.getUser();
    if (!user) return;
    setGuardando(true);
    try {
      await api.setCourier(ordenId, valor.trim(), user.usuario);
    } catch (err) {
      alert('Error al guardar courier: ' + (err instanceof Error ? err.message : 'desconocido'));
      setValor(valorInicial);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={(e) => e.stopPropagation()}>
      <span style={{ color: 'var(--text-faint)' }}>🚚</span>
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="Courier…"
        disabled={guardando}
        style={{
          border: 'none', borderBottom: '1px dashed var(--border)', background: 'transparent',
          fontSize: 12, color: 'var(--text-soft)', padding: '2px 0', width: 90,
          outline: 'none', opacity: guardando ? 0.5 : 1,
        }}
      />
    </span>
  );
}

function CardExtra({ pedido }: { pedido: Pedido }) {
  const items = (pedido.items || []).filter(
    it => String((it as any).ESTATUS_ITEM || '').toUpperCase().trim() !== 'CANCELADO'
  );
  const dir = str(pedido.cliente?.DIRECCION);
  const ciudad = str(pedido.cliente?.CIUDAD);
  const telefono = str(pedido.cliente?.TELEFONO);
  const cedulaRuc = str(pedido.cliente?.CEDULA_RUC);
  const industria = str(pedido.cliente?.INDUSTRIA);

  const hayInfo = dir || telefono || cedulaRuc || industria || items.length > 0;
  if (!hayInfo) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(dir || ciudad || telefono || cedulaRuc || industria) && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Verificar antes de enviar
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--text)' }}>
            <div><span style={{ color: 'var(--text-faint)' }}>Ciudad: </span>{ciudad || '—'}</div>
            <div><span style={{ color: 'var(--text-faint)' }}>Dirección: </span>{dir || '—'}</div>
            <div><span style={{ color: 'var(--text-faint)' }}>Cédula: </span>{cedulaRuc || '—'}</div>
            <div><span style={{ color: 'var(--text-faint)' }}>Teléfono: </span>{telefono || '—'}</div>
            <div><span style={{ color: 'var(--text-faint)' }}>Industria/especialización/interés: </span>{industria || '—'}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12 }}>
        <CourierInput ordenId={pedido.ORDEN_ID} valorInicial={str(pedido.COURIER)} />
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((it, i) => (
            <ItemChip key={i} nombre={shortName(it as any)} talla={(it as any).TALLA} longitud={(it as any).LONGITUD} color={(it as any).COLOR} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrderCard({ pedido, showMoney = false }: Props) {
  const router = useRouter();
  const [copiado, setCopiado] = useState<'cobro' | 'listo' | null>(null);
  // Empieza en null (igual en servidor y cliente) y se calcula de verdad
  // solo en el navegador, para evitar un mismatch de hydration (React #418)
  // cuando el servidor (UTC) y el cliente (Ecuador) creen que es un día distinto.
  const [atraso, setAtraso] = useState<number | null>(null);
  useEffect(() => {
    setAtraso(calcularDiasAtraso(pedido));
  }, [pedido.ESTATUS_ENVIO, pedido.F_ENTREGA_EST]);
  const saldo = pedido.totales?.saldo ?? 0;
  const hasRegalo = !!pedido.REGALO_ENVIADO && String(pedido.REGALO_ENVIADO).trim() !== '';
  const listoParaEnviar = pedido.ESTATUS_ENVIO === 'LISTO PARA ENVIAR';

  function gestionar() {
    // Guardamos el pedido ya cargado para que el detalle abra al instante,
    // sin volver a pedirlo al backend.
    try { sessionStorage.setItem('pedido:' + pedido.ORDEN_ID, JSON.stringify(pedido)); } catch {}
    router.push(`/pedido/${encodeURIComponent(pedido.ORDEN_ID)}`);
  }

  function copiarCobro() {
    navigator.clipboard.writeText(generarMensajeCobro(pedido));
    setCopiado('cobro');
    setTimeout(() => setCopiado(null), 2000);
  }

  function copiarListoParaEnviar() {
    navigator.clipboard.writeText(generarMensajeListoParaEnviar(pedido));
    setCopiado('listo');
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <div className="card" style={{ padding: '20px 24px' }}>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={gestionar} style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
              Gestionar
            </button>
            {listoParaEnviar && (
              <button
                className="btn"
                onClick={copiarListoParaEnviar}
                style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap', background: copiado === 'listo' ? '#25D366' : undefined, color: copiado === 'listo' ? 'white' : undefined, borderColor: copiado === 'listo' ? '#25D366' : undefined }}
              >
                {copiado === 'listo' ? '✓ Copiado' : '📦 Listo para enviar'}
              </button>
            )}
            {showMoney && saldo > 0.005 && (
              <button
                className="btn"
                onClick={copiarCobro}
                style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap', background: copiado === 'cobro' ? '#25D366' : undefined, color: copiado === 'cobro' ? 'white' : undefined, borderColor: copiado === 'cobro' ? '#25D366' : undefined }}
              >
                {copiado === 'cobro' ? '✓ Copiado' : '💬 Copiar cobro'}
              </button>
            )}
          </div>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={gestionar} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
            Gestionar
          </button>
          {listoParaEnviar && (
            <button
              className="btn"
              onClick={copiarListoParaEnviar}
              style={{ flex: 1, justifyContent: 'center', fontSize: 12, background: copiado === 'listo' ? '#25D366' : undefined, color: copiado === 'listo' ? 'white' : undefined, borderColor: copiado === 'listo' ? '#25D366' : undefined }}
            >
              {copiado === 'listo' ? '✓ Copiado' : '📦 Envío'}
            </button>
          )}
          {showMoney && saldo > 0.005 && (
            <button
              className="btn"
              onClick={copiarCobro}
              style={{ flex: 1, justifyContent: 'center', fontSize: 12, background: copiado === 'cobro' ? '#25D366' : undefined, color: copiado === 'cobro' ? 'white' : undefined, borderColor: copiado === 'cobro' ? '#25D366' : undefined }}
            >
              {copiado === 'cobro' ? '✓ Copiado' : '💬 Cobro'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
