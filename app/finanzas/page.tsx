// app/finanzas/page.tsx
// Finanzas v2: Corte (reparto cada 15), Registrar (gastos, sueldos, envíos, tarjetas…),
// Movimientos (el libro) y Cuentas (saldos y capital real).

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  api, type Corte, type CuentaConSaldo, type FinanzasCuentas, type Movimiento, type NuevoMovimiento,
} from '@/lib/api';
import Navbar from '@/components/Navbar';

// ───────────────────────── utilidades ─────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoy = () => ymd(new Date());
const sumarDias = (f: string, n: number) => { const [y, m, d] = f.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };

function money(n: number) {
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '−$' : '$') + s;
}
function fechaCorta(f: string) {
  if (!f) return '';
  return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
function fechaLarga(f: string) {
  if (!f) return '';
  return new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Corte = del 15 de un mes al 14 del siguiente.
type RangoCorte = { desde: string; hasta: string };
function corteDe(fecha: string): RangoCorte {
  const [y, m, d] = fecha.split('-').map(Number);
  const ini = d >= 15 ? new Date(y, m - 1, 15) : new Date(y, m - 2, 15);
  const fin = new Date(ini.getFullYear(), ini.getMonth() + 1, 14);
  return { desde: ymd(ini), hasta: ymd(fin) };
}
function moverCorte(c: RangoCorte, n: number): RangoCorte {
  const [y, m] = c.desde.split('-').map(Number);
  const ini = new Date(y, m - 1 + n, 15);
  return { desde: ymd(ini), hasta: ymd(new Date(ini.getFullYear(), ini.getMonth() + 1, 14)) };
}

const T = {
  label: { fontSize: 12, color: 'var(--text-soft)', display: 'block', marginBottom: 6 } as React.CSSProperties,
  h2: { fontSize: 24, fontWeight: 400, margin: '0 0 12px' } as React.CSSProperties,
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', fontSize: 14 } as React.CSSProperties,
  sub: { fontSize: 12, color: 'var(--text-soft)' } as React.CSSProperties,
};

function Fila({ label, valor, color, fuerte, borde }: { label: React.ReactNode; valor: number; color?: string; fuerte?: boolean; borde?: boolean }) {
  return (
    <div style={{ ...T.row, fontWeight: fuerte ? 600 : 400, borderTop: borde ? '1px solid var(--border)' : undefined, marginTop: borde ? 4 : 0, paddingTop: borde ? 10 : 7 }}>
      <span>{label}</span>
      <span className="tabular" style={{ color }}>{money(valor)}</span>
    </div>
  );
}

function Chips<V extends string>({ opciones, valor, onChange }: { opciones: { v: V; t: string }[]; valor: V; onChange: (v: V) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {opciones.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          style={{
            minHeight: 44, padding: '0 14px', borderRadius: 100, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid ${valor === o.v ? 'var(--text)' : 'var(--border)'}`,
            background: valor === o.v ? 'var(--text)' : 'var(--surface)', color: valor === o.v ? 'var(--surface)' : 'var(--text)',
          }}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

function Aviso({ children, tono = 'amber' }: { children: React.ReactNode; tono?: 'amber' | 'rose' | 'green' }) {
  const c = { amber: ['var(--amber-bg)', '#7A4E17'], rose: ['var(--rose-bg)', 'var(--rose)'], green: ['var(--green-bg)', 'var(--green)'] }[tono];
  return <div style={{ background: c[0], color: c[1], borderRadius: 6, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>{children}</div>;
}

// ───────────────────────── página ─────────────────────────

type Tab = 'corte' | 'registrar' | 'movimientos' | 'cuentas';

export default function FinanzasPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [tab, setTab] = useState<Tab>('corte');
  const [fin, setFin] = useState<FinanzasCuentas | null>(null);
  const [errorFin, setErrorFin] = useState('');
  const [prefillReparto, setPrefillReparto] = useState<{ monto: number } | null>(null);

  const cargarCuentas = useCallback(() => {
    api.getFinanzasCuentas().then(f => { setFin(f); setErrorFin(''); })
      .catch(e => setErrorFin(e instanceof Error ? e.message : 'No se pudieron cargar las cuentas'));
  }, []);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    setUsuario(user.usuario);
    setListo(true);
    cargarCuentas();
  }, [router, cargarCuentas]);

  if (!listo) return null;

  const tabs: { id: Tab; t: string }[] = [
    { id: 'corte', t: 'Corte' }, { id: 'registrar', t: 'Registrar' },
    { id: 'movimientos', t: 'Movimientos' }, { id: 'cuentas', t: 'Cuentas' },
  ];

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px 64px' }}>
        <h1 className="display" style={{ fontSize: 40, fontWeight: 300, margin: '0 0 14px', lineHeight: 1 }}>Finanzas</h1>
        <nav style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
          {tabs.map(x => (
            <button key={x.id} onClick={() => setTab(x.id)}
              style={{
                flex: 1, minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, color: tab === x.id ? 'var(--text)' : 'var(--text-soft)', fontWeight: tab === x.id ? 600 : 400,
                borderBottom: `2px solid ${tab === x.id ? 'var(--text)' : 'transparent'}`, marginBottom: -1,
              }}>
              {x.t}
            </button>
          ))}
        </nav>

        {errorFin && <div style={{ marginBottom: 14 }}><Aviso tono="rose">No se pudieron cargar las cuentas: {errorFin}</Aviso></div>}

        {tab === 'corte' && (
          <CorteTab usuario={usuario} inicio={fin?.inicio || '2026-10-15'}
            onPagarReparto={(monto) => { setPrefillReparto({ monto }); setTab('registrar'); }} />
        )}
        {tab === 'registrar' && (
          <RegistrarTab usuario={usuario} fin={fin} prefillReparto={prefillReparto}
            onGuardado={() => { cargarCuentas(); setPrefillReparto(null); }} />
        )}
        {tab === 'movimientos' && <MovimientosTab usuario={usuario} fin={fin} onCambio={cargarCuentas} />}
        {tab === 'cuentas' && <CuentasTab fin={fin} />}
      </div>
    </>
  );
}

// ───────────────────────── CORTE ─────────────────────────

function CorteTab({ usuario, inicio, onPagarReparto }: { usuario: string; inicio: string; onPagarReparto: (monto: number) => void }) {
  const [rango, setRango] = useState<RangoCorte | null>(null);
  const [donacion, setDonacion] = useState('');
  const [corte, setCorte] = useState<Corte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [verPedidos, setVerPedidos] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  // Por defecto: el corte anterior si todavía no se cerró; si no, el actual.
  useEffect(() => {
    const actual = corteDe(hoy());
    const anterior = moverCorte(actual, -1);
    api.getCortesCerrados()
      .then(cs => {
        const cerradoAnterior = cs.some(c => c.desde === anterior.desde);
        setRango(anterior.desde >= inicio && !cerradoAnterior ? anterior : actual);
      })
      .catch(() => setRango(actual));
  }, [inicio]);

  const esAnterior = !!rango && rango.desde < inicio;
  // En el sistema anterior el corte empezaba el 15 y el 15 ya había entrado en el corte previo.
  const desdeConsulta = rango ? (esAnterior ? sumarDias(rango.desde, 1) : rango.desde) : '';

  const cargar = useCallback(() => {
    if (!rango) return;
    setCargando(true); setError('');
    api.getCorte(desdeConsulta, rango.hasta, Number(donacion) || 0)
      .then(setCorte)
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo calcular el corte'))
      .finally(() => setCargando(false));
  }, [rango, desdeConsulta, donacion]);

  useEffect(() => {
    const t = setTimeout(cargar, 350); // espera a que termines de escribir la donación
    return () => clearTimeout(t);
  }, [cargar]);

  async function cerrar() {
    if (!rango || !corte?.totales) return;
    const t = corte.totales;
    if (!confirm(`¿Cerrar el corte ${fechaLarga(rango.desde)} – ${fechaLarga(rango.hasta)}?\n\nA cada uno: ${money(t.porSocio)}\nDonación: ${money(t.donacion)}\n\nDespués de cerrarlo, estos números ya no cambian.`)) return;
    setCerrando(true);
    try {
      await api.cerrarCorte(rango.desde, rango.hasta, Number(donacion) || 0, usuario);
      cargar();
    } catch (e) {
      alert('No se pudo cerrar: ' + (e instanceof Error ? e.message : 'error'));
    } finally {
      setCerrando(false);
    }
  }

  if (!rango) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Cargando…</div>;

  const t = corte?.totales;
  const abierto = corte?.estado === 'ABIERTO';
  const terminado = rango.hasta < hoy();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Selector de corte */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 6 }}>
        <button className="btn" aria-label="Corte anterior" onClick={() => { setRango(moverCorte(rango, -1)); setDonacion(''); }} style={{ border: 0, minHeight: 44, minWidth: 44, justifyContent: 'center' }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div className="tabular" style={{ fontSize: 15, fontWeight: 600 }}>
            {fechaCorta(desdeConsulta || rango.desde)} – {fechaLarga(rango.hasta)}
          </div>
          <span className="pill" style={{
            marginTop: 4,
            background: corte?.estado === 'CERRADO' ? 'var(--green-bg)' : esAnterior ? 'var(--blue-bg)' : 'var(--amber-bg)',
            color: corte?.estado === 'CERRADO' ? 'var(--green)' : esAnterior ? 'var(--blue)' : '#8A5A1E',
          }}>
            {corte?.estado === 'CERRADO' ? 'Cerrado' : esAnterior ? 'Sistema anterior' : terminado ? 'Listo para cerrar' : 'Abierto'}
          </span>
        </div>
        <button className="btn" aria-label="Corte siguiente" onClick={() => { setRango(moverCorte(rango, 1)); setDonacion(''); }} style={{ border: 0, minHeight: 44, minWidth: 44, justifyContent: 'center' }}>›</button>
      </div>

      {error && <Aviso tono="rose">{error}</Aviso>}
      {cargando && !corte && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Calculando…</div>}

      {/* ---------- Corte del sistema anterior ---------- */}
      {corte && esAnterior && corte.anterior && (
        <div className="card m-pad" style={{ padding: 22, opacity: cargando ? 0.5 : 1 }}>
          <h2 className="display" style={T.h2}>Reparto (sistema anterior)</h2>
          <p style={{ ...T.sub, margin: '0 0 12px', lineHeight: 1.5 }}>
            Este corte es de antes del {fechaLarga(inicio)}: cuenta los pedidos entregados y pagados completos según su fecha de cobro.
            Empieza el {fechaCorta(desdeConsulta)} porque el día 15 ya entró en el corte previo.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            <SocioBox nombre="Freddy" monto={corte.anterior.repartible.porFreddyFinal} />
            <SocioBox nombre="Mildred" monto={corte.anterior.repartible.porSocio} />
          </div>
          <Fila label={`Ganancia de ${corte.anterior.repartible.cantidadPedidos} pedidos cobrados`} valor={corte.anterior.repartible.gananciaPedidosPagados} />
          <Fila label="− Gastos fijos" valor={-corte.anterior.repartible.gastosFijos} color="var(--rose)" />
          <DonacionInput valor={donacion} onChange={setDonacion} />
          <Fila label="Neto a repartir" valor={corte.anterior.repartible.neto} fuerte borde />
          {corte.anterior.repartible.cubiertoPorFreddy > 0 && (
            <p style={{ ...T.sub, margin: '6px 0 0' }}>A Freddy se le suma {money(corte.anterior.repartible.cubiertoPorFreddy)} que puso de su bolsillo (regla anterior).</p>
          )}
        </div>
      )}

      {/* ---------- Corte del sistema nuevo ---------- */}
      {corte && !esAnterior && t && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: cargando ? 0.5 : 1, transition: 'opacity .2s' }}>
          {corte.esPrimerCorte && abierto && (
            <Aviso tono="green">Primer corte del sistema nuevo: incluye también los pedidos hechos antes del {fechaLarga(inicio)} que el sistema anterior no llegó a repartir (marcados “de antes”).</Aviso>
          )}
          {corte.avisos.length > 0 && (
            <Aviso>
              <strong>{corte.avisos.length} pedido{corte.avisos.length === 1 ? '' : 's'} sin factura FIGS.</strong>{' '}
              Cárgalas antes de cerrar para que el reparto use el costo real de la prenda:{' '}
              {corte.avisos.map(a => `${a.ordenId} (${a.cliente})`).join(', ')}.
            </Aviso>
          )}

          <div className="card m-pad" style={{ padding: 22 }}>
            <h2 className="display" style={T.h2}>Reparto</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 8 }}>
              <SocioBox nombre="Freddy" monto={t.porSocio} />
              <SocioBox nombre="Mildred" monto={t.porSocio} />
            </div>
            {Object.entries(corte.gastosSocio || {}).map(([socio, monto]) => (
              <p key={socio} style={{ ...T.sub, margin: '0 0 6px', lineHeight: 1.45 }}>
                {socio === 'FREDDY' ? 'Freddy' : 'Mildred'}: pusiste {money(monto)} de tu bolsillo (comida, uber…). Queda registrado a tu nombre; no se descuenta otra vez.
              </p>
            ))}
            <div style={{ marginTop: 8 }} />
            <Fila label={`Ganancia de ${t.cantPedidos} pedido${t.cantPedidos === 1 ? '' : 's'} del corte`} valor={t.gananciaPedidos} />
            <Fila label="− Sueldo de Sebas" valor={-t.sueldos} color={t.sueldos ? 'var(--rose)' : undefined} />
            {abierto ? <DonacionInput valor={donacion} onChange={setDonacion} />
              : <Fila label="− Donación a ScrubMe" valor={-t.donacion} />}
            <Fila label="Neto a repartir" valor={t.neto} fuerte borde color={t.neto < 0 ? 'var(--rose)' : undefined} />
            <div style={{ ...T.row, color: 'var(--text-soft)' }}><span>÷ 2, a cada uno</span><span className="tabular">{money(t.porSocio)}</span></div>
          </div>

          <div className="card m-pad" style={{ padding: 22 }}>
            <h2 className="display" style={{ ...T.h2, marginBottom: 2 }}>Negocio</h2>
            <p style={{ ...T.sub, margin: '0 0 10px' }}>Lo que entra y sale del capital de ScrubMe en este corte</p>
            <div style={{ ...T.sub, fontWeight: 600, marginTop: 4 }}>Entró</div>
            <Fila label="Ganancia de stock" valor={t.gananciaStock} />
            <Fila label="Donación" valor={t.donacion} />
            <div style={{ ...T.sub, fontWeight: 600, marginTop: 8 }}>Salió</div>
            {corte.gastosNegocioDetalle.length === 0
              ? <div style={{ ...T.sub, padding: '6px 0' }}>Nada registrado todavía</div>
              : corte.gastosNegocioDetalle.map(g => <Fila key={g.categoria} label={g.categoria} valor={-g.monto} />)}
            <Fila label="Resultado del corte" valor={t.resultadoNegocio} fuerte borde color={t.resultadoNegocio < 0 ? 'var(--rose)' : 'var(--green)'} />
            {t.resultadoNegocio < 0 && <p style={{ fontSize: 12, color: 'var(--rose)', margin: '4px 0 0' }}>El capital del negocio bajó en este corte.</p>}
          </div>

          <div className="card m-pad" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <h2 className="display" style={{ ...T.h2, margin: 0 }}>Pedidos del corte</h2>
              <button className="btn" onClick={() => setVerPedidos(!verPedidos)} style={{ minHeight: 40 }}>{verPedidos ? 'Ocultar' : `Ver ${corte.pedidos.length}`}</button>
            </div>
            {verPedidos && (
              <div style={{ marginTop: 10 }}>
                {corte.pedidos.length === 0 && <div style={{ ...T.sub, padding: '10px 0' }}>No hay pedidos en este corte.</div>}
                {corte.pedidos.map(p => (
                  <div key={p.ordenId} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ ...T.row, padding: 0 }}>
                      <a href={`/pedido/${encodeURIComponent(p.ordenId)}`} style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>{p.ordenId} · {p.cliente}</a>
                      <span className="tabular" style={{ fontWeight: 600, color: p.gananciaReparto < 0 ? 'var(--rose)' : undefined }}>{money(p.gananciaReparto)}</span>
                    </div>
                    <div style={{ ...T.sub, margin: '2px 0 6px' }}>{fechaCorta(p.fecha)} · {p.metodoEnvio || 'sin envío'} · venta {money(p.venta)}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.transicion && <span className="pill" style={{ background: 'var(--blue-bg)', color: 'var(--blue)', textTransform: 'none' }}>de antes</span>}
                      <span className="pill" style={{ textTransform: 'none', background: p.prendaReal ? 'var(--green-bg)' : 'var(--rose-bg)', color: p.prendaReal ? 'var(--green)' : 'var(--rose)' }}>
                        {p.prendaReal ? 'prenda real' : 'sin factura'}
                      </span>
                      {p.estimados.length > 0 && (
                        <span className="pill" style={{ textTransform: 'none', background: 'var(--amber-bg)', color: '#8A5A1E' }}>{p.estimados.join(', ')} estimado{p.estimados.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {p.gananciaStock !== 0 && <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 6 }}>+ parte de stock: {money(p.gananciaStock)} → al negocio</div>}
                  </div>
                ))}
                {corte.promedios && (
                  <p style={{ ...T.sub, marginTop: 12, lineHeight: 1.5 }}>
                    Promedios usados donde falta el costo real: courier {money(corte.promedios.courierPorPieza)} por prenda
                    {corte.promedios.courierBase ? ` (de ${corte.promedios.courierBase} prendas)` : ' (valor fijo, sin historial)'};
                    empaque y pin {money(corte.promedios.empaquePorPedido)} por pedido
                    {corte.promedios.empaqueBase ? ` (de ${corte.promedios.empaqueBase} pedidos)` : ' (valor fijo)'};
                    envío Servientrega {money(corte.promedios.envio['Servientrega'] ?? 0)}
                    {corte.promedios.envioBase['Servientrega'] ? '' : ' (valor fijo)'}, delivery local {money(corte.promedios.envio['Delivery local'] ?? 0)}
                    {corte.promedios.envioBase['Delivery local'] ? '' : ' (valor fijo)'}.
                  </p>
                )}
              </div>
            )}
          </div>

          {abierto && (
            <>
              <button className="btn btn-primary" disabled={!terminado || cerrando || corte.avisos.length > 0} onClick={cerrar}
                style={{ minHeight: 48, justifyContent: 'center', background: 'var(--text)', color: 'var(--surface)', border: 'none', fontSize: 15 }}>
                {cerrando ? 'Cerrando…' : 'Cerrar corte'}
              </button>
              <p style={{ ...T.sub, margin: '-6px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
                {!terminado ? `Se puede cerrar desde el ${fechaLarga(sumarDias(rango.hasta, 1))}.`
                  : corte.avisos.length > 0 ? 'Carga las facturas que faltan para poder cerrarlo.'
                  : 'Se guarda el resultado y ya no cambia.'}
              </p>
            </>
          )}
          {corte.estado === 'CERRADO' && (
            <div className="card m-pad" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={T.sub}>Cerrado el {corte.fechaCierre?.slice(0, 10)} por {corte.cerradoPor}.</div>
              <button className="btn" style={{ minHeight: 44, justifyContent: 'center' }} onClick={() => onPagarReparto(t.porSocio)}>Registrar pago del reparto</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SocioBox({ nombre, monto }: { nombre: string; monto: number }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 14 }}>
      <div style={T.sub}>{nombre}</div>
      <div className="display tabular" style={{ fontSize: 30, fontWeight: 300, marginTop: 4, color: monto < 0 ? 'var(--rose)' : 'var(--green)' }}>{money(monto)}</div>
    </div>
  );
}

function DonacionInput({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div style={{ ...T.row, alignItems: 'center' }}>
      <label htmlFor="donacion">− Donación a ScrubMe</label>
      <input id="donacion" type="number" min={0} step="0.01" inputMode="decimal" className="input tabular" placeholder="0.00"
        value={valor} onChange={e => onChange(e.target.value)} style={{ width: 120, textAlign: 'right' }} />
    </div>
  );
}

// ───────────────────────── REGISTRAR ─────────────────────────

type Form = 'GASTO_NEGOCIO' | 'SUELDO' | 'ENVIO' | 'PAGO_TARJETA' | 'TRANSFERENCIA' | 'COMPRA_MATERIAL' | 'GASTO_SOCIO' | 'GASTO_PERSONAL' | 'PAGO_REPARTO';

const TILES: { f: Form; t: string; s: string; color: string }[] = [
  { f: 'GASTO_NEGOCIO', t: 'Gasto del negocio', s: 'Shopify, anuncios, herramientas', color: 'var(--rose)' },
  { f: 'SUELDO', t: 'Sueldo de Sebas', s: 'Sale del reparto', color: 'var(--gold)' },
  { f: 'ENVIO', t: 'Envío', s: 'Servientrega o delivery de un pedido', color: 'var(--blue)' },
  { f: 'PAGO_TARJETA', t: 'Pagar tarjeta', s: 'Western Union', color: 'var(--blue)' },
  { f: 'TRANSFERENCIA', t: 'Mover entre cuentas', s: 'Ej: a la cuenta de Sebas', color: 'var(--teal)' },
  { f: 'COMPRA_MATERIAL', t: 'Compra de materiales', s: 'Cajas, stickers, pines, medias', color: 'var(--green)' },
  { f: 'GASTO_SOCIO', t: 'Gasto mío', s: 'Comida y uber de Sebas', color: 'var(--purple)' },
  { f: 'GASTO_PERSONAL', t: 'Gasto personal', s: 'Con plata del negocio: sube tu deuda', color: 'var(--orange)' },
  { f: 'PAGO_REPARTO', t: 'Pagar reparto', s: 'Después de cerrar el corte', color: 'var(--text)' },
];

const CATEGORIAS_GASTO = ['Suscripción', 'Publicidad', 'Herramientas y equipos', 'Comisión bancaria', 'Intereses de tarjeta', 'Otro'];

type Material = { tabla: 'empaque' | 'regalos'; id: string; nombre: string; stock: number; costo: number };

function RegistrarTab({ usuario, fin, prefillReparto, onGuardado }: {
  usuario: string; fin: FinanzasCuentas | null; prefillReparto: { monto: number } | null; onGuardado: () => void;
}) {
  const [form, setForm] = useState<Form | null>(prefillReparto ? 'PAGO_REPARTO' : null);
  const [toast, setToast] = useState('');
  const [recientes, setRecientes] = useState<Movimiento[]>([]);

  const cargarRecientes = useCallback(() => {
    api.getMovimientos().then(ms => setRecientes(ms.slice(0, 5))).catch(() => setRecientes([]));
  }, []);
  useEffect(() => { cargarRecientes(); }, [cargarRecientes]);

  if (form) {
    return (
      <FormMovimiento form={form} usuario={usuario} fin={fin} prefillMonto={form === 'PAGO_REPARTO' ? prefillReparto?.monto : undefined}
        onCancelar={() => setForm(null)}
        onGuardado={(msg) => { setForm(null); setToast(msg); setTimeout(() => setToast(''), 4000); onGuardado(); cargarRecientes(); }} />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {toast && <Aviso tono="green">{toast}</Aviso>}
      <p style={{ margin: 0, fontSize: 15, color: 'var(--text-soft)' }}>¿Qué quieres registrar?</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {TILES.map(x => (
          <button key={x.f} onClick={() => setForm(x.f)} className="card"
            style={{ textAlign: 'left', padding: 14, minHeight: 108, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10, fontFamily: 'inherit' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: x.color }} />
            <span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{x.t}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>{x.s}</span>
            </span>
          </button>
        ))}
      </div>
      <h2 className="display" style={{ fontSize: 20, fontWeight: 400, margin: '10px 0 0' }}>Últimos registrados</h2>
      {recientes.length === 0 ? <div style={T.sub}>Nada todavía.</div> : recientes.map(m => <FilaMovimiento key={m.id} m={m} />)}
    </div>
  );
}

function FormMovimiento({ form, usuario, fin, prefillMonto, onCancelar, onGuardado }: {
  form: Form; usuario: string; fin: FinanzasCuentas | null; prefillMonto?: number;
  onCancelar: () => void; onGuardado: (msg: string) => void;
}) {
  const cuentas = useMemo(() => fin?.cuentas || [], [fin]);
  const bancos = cuentas.filter(c => c.tipo === 'BANCO' || c.tipo === 'EFECTIVO');
  const tarjetas = cuentas.filter(c => c.tipo === 'TARJETA');
  const pagadores = cuentas.filter(c => ['BANCO', 'EFECTIVO', 'TARJETA'].includes(c.tipo));
  const buscar = (lista: CuentaConSaldo[], t: string) => lista.find(c => c.nombre.toLowerCase().includes(t.toLowerCase()))?.id || lista[0]?.id || '';
  const socioActual = usuario.toLowerCase().includes('mildred') ? 'MILDRED' : 'FREDDY';

  const defaults: Record<Form, { origen: string; destino: string }> = {
    GASTO_NEGOCIO: { origen: buscar(pagadores, 'capital'), destino: '' },
    SUELDO: { origen: buscar(bancos, '#2'), destino: '' },
    ENVIO: { origen: buscar(bancos, 'sebasti'), destino: '' },
    PAGO_TARJETA: { origen: buscar(bancos, '#1'), destino: buscar(tarjetas, 'capital') },
    TRANSFERENCIA: { origen: buscar(bancos, '#1'), destino: buscar(bancos, 'sebasti') },
    COMPRA_MATERIAL: { origen: buscar(pagadores, 'gastos'), destino: '' },
    GASTO_SOCIO: { origen: '', destino: '' },
    GASTO_PERSONAL: { origen: buscar(pagadores, 'capital'), destino: '' },
    PAGO_REPARTO: { origen: buscar(bancos, '#2'), destino: '' },
  };

  const [fecha, setFecha] = useState(hoy());
  const [monto, setMonto] = useState(prefillMonto ? prefillMonto.toFixed(2) : '');
  const [comision, setComision] = useState('');
  const [origen, setOrigen] = useState(defaults[form].origen);
  const [destino, setDestino] = useState(defaults[form].destino);
  const [categoria, setCategoria] = useState(form === 'GASTO_SOCIO' ? 'Comida y uber de Sebas' : 'Suscripción');
  const [socio, setSocio] = useState<'FREDDY' | 'MILDRED'>(socioActual);
  const [nota, setNota] = useState('');
  const [ordenId, setOrdenId] = useState('');
  const [empresa, setEmpresa] = useState('Servientrega');
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [materialSel, setMaterialSel] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [envioCompra, setEnvioCompra] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (form !== 'COMPRA_MATERIAL') return;
    api.getMateriales().then(m => {
      const lista: Material[] = [
        ...m.empaque.map(x => ({ tabla: 'empaque' as const, id: x.ID, nombre: x.NOMBRE, stock: x.STOCK, costo: x.COSTO })),
        ...m.regalos.map(x => ({ tabla: 'regalos' as const, id: x.ID, nombre: x.NOMBRE, stock: x.STOCK, costo: x.COSTO })),
      ];
      setMateriales(lista);
      if (lista[0]) setMaterialSel(lista[0].tabla + '|' + lista[0].id);
    }).catch(() => setError('No se pudo cargar la lista de materiales'));
  }, [form]);

  const titulo = TILES.find(x => x.f === form)?.t || '';
  const n = Number(monto) || 0, com = Number(comision) || 0;
  const tarjetaSel = cuentas.find(c => c.id === destino);
  const mat = materiales.find(m => m.tabla + '|' + m.id === materialSel);
  const cant = Number(cantidad) || 0, envC = Number(envioCompra) || 0;
  const costoUnidad = cant > 0 ? (n + envC) / cant : 0;
  const costoPromedio = mat && cant > 0 ? ((Math.max(0, mat.stock) * mat.costo) + n + envC) / (Math.max(0, mat.stock) + cant) : 0;

  async function guardar() {
    setError('');
    if (!(n > 0)) { setError('Escribe un monto mayor a 0'); return; }
    setGuardando(true);
    try {
      if (form === 'ENVIO') {
        let id = ordenId.trim();
        if (/^\d+$/.test(id)) id = '#' + id.padStart(4, '0');
        if (!/^#\d+$/.test(id)) throw new Error('Escribe el número del pedido, por ejemplo #0320');
        await api.registrarEnvio({ ordenId: id, monto: n, fecha, origen, empresa, nota }, usuario);
        onGuardado(`Envío de ${id} registrado: ${money(n)}`);
      } else if (form === 'COMPRA_MATERIAL') {
        if (!mat) throw new Error('Elige el material');
        if (!(cant > 0)) throw new Error('Escribe la cantidad');
        const r = await api.registrarCompraMaterial({ tabla: mat.tabla, id: mat.id, cantidad: cant, precioTotal: n, envio: envC, fecha, origen, nota }, usuario);
        onGuardado(`${mat.nombre}: ${r.stockAntes} → ${r.stockNuevo} unidades · costo por unidad ${money(r.costoNuevo)}`);
      } else {
        const m: NuevoMovimiento = { tipo: form, fecha, monto: n, nota };
        if (form === 'GASTO_NEGOCIO') { m.categoria = categoria; m.origen = origen; }
        if (form === 'SUELDO') m.origen = origen;
        if (form === 'GASTO_SOCIO') { m.aCargoDe = socio; m.categoria = categoria; }
        if (form === 'GASTO_PERSONAL') { m.aCargoDe = socio; m.origen = origen; }
        if (form === 'PAGO_TARJETA' || form === 'TRANSFERENCIA') { m.origen = origen; m.destino = destino; m.comision = com; }
        if (form === 'PAGO_REPARTO') { m.aCargoDe = socio; m.origen = origen; }
        await api.registrarMovimiento(m, usuario);
        onGuardado(`${titulo} registrado: ${money(form === 'PAGO_TARJETA' || form === 'TRANSFERENCIA' ? n - com : n)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  const selectCuenta = (id: string, valor: string, set: (v: string) => void, lista: CuentaConSaldo[], label: string) => (
    <div>
      <label style={T.label} htmlFor={id}>{label}</label>
      <select id={id} className="input" value={valor} onChange={e => set(e.target.value)}>
        {lista.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button onClick={onCancelar} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-soft)', fontSize: 14, minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>‹ Registrar</button>
      <h2 className="display" style={{ fontSize: 30, fontWeight: 300, margin: 0 }}>{titulo}</h2>
      {cuentas.length === 0 && <Aviso tono="rose">Todavía no cargan las cuentas. Espera un momento o recarga la página.</Aviso>}

      <div>
        <label style={T.label} htmlFor="f-fecha">Fecha</label>
        <input id="f-fecha" type="date" className="input" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>

      {form === 'GASTO_NEGOCIO' && (
        <div>
          <label style={T.label} htmlFor="f-cat">Categoría</label>
          <select id="f-cat" className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
            {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {(form === 'GASTO_SOCIO' || form === 'GASTO_PERSONAL' || form === 'PAGO_REPARTO') && (
        <div>
          <span style={T.label}>{form === 'PAGO_REPARTO' ? 'A quién' : 'De quién es el gasto'}</span>
          <Chips opciones={[{ v: 'FREDDY', t: 'Freddy' }, { v: 'MILDRED', t: 'Mildred' }]} valor={socio} onChange={setSocio} />
        </div>
      )}

      {form === 'GASTO_SOCIO' && (
        <div>
          <label style={T.label} htmlFor="f-concepto">Concepto</label>
          <input id="f-concepto" className="input" value={categoria} onChange={e => setCategoria(e.target.value)} />
        </div>
      )}

      {form === 'ENVIO' && (
        <>
          <div>
            <label style={T.label} htmlFor="f-orden">Pedido</label>
            <input id="f-orden" className="input" inputMode="numeric" placeholder="#0320" value={ordenId} onChange={e => setOrdenId(e.target.value)} />
          </div>
          <div>
            <span style={T.label}>Empresa</span>
            <Chips opciones={[{ v: 'Servientrega', t: 'Servientrega' }, { v: 'Delivery local', t: 'Delivery local' }, { v: 'Otro', t: 'Otro' }]} valor={empresa} onChange={setEmpresa} />
          </div>
        </>
      )}

      {form === 'COMPRA_MATERIAL' && (
        <div>
          <label style={T.label} htmlFor="f-mat">Material</label>
          <select id="f-mat" className="input" value={materialSel} onChange={e => setMaterialSel(e.target.value)}>
            {materiales.map(m => <option key={m.tabla + m.id} value={m.tabla + '|' + m.id}>{m.nombre} · hay {m.stock}</option>)}
          </select>
        </div>
      )}

      {form === 'PAGO_TARJETA' && (
        <div>
          <span style={T.label}>Tarjeta</span>
          <Chips opciones={tarjetas.map(c => ({ v: c.id, t: c.nombre }))} valor={destino} onChange={setDestino} />
        </div>
      )}

      {/* Cuentas */}
      {form === 'TRANSFERENCIA' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }} className="m-stack">
          {selectCuenta('f-org', origen, setOrigen, bancos, 'Sale de')}
          {selectCuenta('f-dst', destino, setDestino, bancos, 'Llega a')}
        </div>
      )}
      {['GASTO_NEGOCIO', 'COMPRA_MATERIAL', 'GASTO_PERSONAL'].includes(form) && selectCuenta('f-org', origen, setOrigen, pagadores, 'Pagado con')}
      {['SUELDO', 'ENVIO', 'PAGO_REPARTO'].includes(form) && selectCuenta('f-org', origen, setOrigen, bancos, 'Sale de')}
      {form === 'PAGO_TARJETA' && selectCuenta('f-org', origen, setOrigen, bancos, 'Sacado de')}

      {/* Montos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {form === 'COMPRA_MATERIAL' && (
          <div>
            <label style={T.label} htmlFor="f-cant">Cantidad</label>
            <input id="f-cant" type="number" inputMode="numeric" min={0} className="input tabular" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="100" />
          </div>
        )}
        <div>
          <label style={T.label} htmlFor="f-monto">
            {form === 'PAGO_TARJETA' ? 'Monto que sacaste' : form === 'COMPRA_MATERIAL' ? 'Precio total' : form === 'TRANSFERENCIA' ? 'Monto que sale' : 'Monto'}
          </label>
          <input id="f-monto" type="number" inputMode="decimal" min={0} step="0.01" className="input tabular" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" />
        </div>
        {(form === 'PAGO_TARJETA' || form === 'TRANSFERENCIA') && (
          <div>
            <label style={T.label} htmlFor="f-com">{form === 'PAGO_TARJETA' ? 'Comisión Western Union' : 'Comisión'}</label>
            <input id="f-com" type="number" inputMode="decimal" min={0} step="0.01" className="input tabular" value={comision} onChange={e => setComision(e.target.value)} placeholder="0.00" />
          </div>
        )}
        {form === 'COMPRA_MATERIAL' && (
          <div>
            <label style={T.label} htmlFor="f-env">Envío de la compra</label>
            <input id="f-env" type="number" inputMode="decimal" min={0} step="0.01" className="input tabular" value={envioCompra} onChange={e => setEnvioCompra(e.target.value)} placeholder="0.00" />
          </div>
        )}
      </div>

      {/* Cálculos en vivo */}
      {(form === 'PAGO_TARJETA' || form === 'TRANSFERENCIA') && n > 0 && (
        <Aviso tono="green">
          <div>Llegan {form === 'PAGO_TARJETA' ? 'a la tarjeta' : 'a la cuenta'}</div>
          <div className="display tabular" style={{ fontSize: 30, fontWeight: 300, margin: '2px 0 6px' }}>{money(n - com)}</div>
          {form === 'PAGO_TARJETA' && tarjetaSel && <div className="tabular">Deuda {tarjetaSel.nombre}: {money(tarjetaSel.saldo)} → {money(tarjetaSel.saldo - (n - com))}</div>}
          {com > 0 && <div>Comisión de {money(com)}: gasto del negocio</div>}
        </Aviso>
      )}
      {form === 'COMPRA_MATERIAL' && cant > 0 && n > 0 && mat && (
        <Aviso tono="green">
          <div>Costo por unidad de esta compra</div>
          <div className="display tabular" style={{ fontSize: 30, fontWeight: 300, margin: '2px 0 6px' }}>{money(costoUnidad)}</div>
          <div className="tabular">Inventario: {mat.stock} → {Math.max(0, mat.stock) + cant} · costo promedio {money(mat.costo)} → {money(costoPromedio)}</div>
          <div>Es inversión: no baja el reparto ahora; se cobra cuando se usa en un pedido.</div>
        </Aviso>
      )}
      {form === 'SUELDO' && <p style={{ ...T.sub, margin: 0 }}>Se resta del reparto del corte en que cae la fecha.</p>}
      {form === 'GASTO_SOCIO' && <p style={{ ...T.sub, margin: 0 }}>Es tuyo, pagado de tu bolsillo: queda registrado pero no cambia el reparto ni los saldos del negocio.</p>}
      {form === 'GASTO_PERSONAL' && <p style={{ ...T.sub, margin: 0 }}>Se pagó con plata o tarjeta del negocio: sube la deuda de {socio === 'FREDDY' ? 'Freddy' : 'Mildred'} con el negocio.</p>}
      {form === 'ENVIO' && <p style={{ ...T.sub, margin: 0 }}>Se guarda como costo real del pedido y sale de la cuenta elegida.</p>}

      <div>
        <label style={T.label} htmlFor="f-nota">Nota (opcional)</label>
        <input id="f-nota" className="input" value={nota} maxLength={200} onChange={e => setNota(e.target.value)} placeholder={form === 'SUELDO' ? 'Ej: semana del 20 al 26 oct' : ''} />
      </div>

      {error && <Aviso tono="rose">{error}</Aviso>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <button className="btn" onClick={onCancelar} style={{ minHeight: 48, justifyContent: 'center' }}>Cancelar</button>
        <button className="btn" onClick={guardar} disabled={guardando || cuentas.length === 0}
          style={{ minHeight: 48, justifyContent: 'center', background: 'var(--text)', color: 'var(--surface)', border: 'none' }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── MOVIMIENTOS ─────────────────────────

function FilaMovimiento({ m, onBorrar }: { m: Movimiento; onBorrar?: () => void }) {
  const entra = m.grupo === 'INGRESO' && !!m.destino;
  const transfer = m.grupo === 'TRANSFERENCIA';
  const soloInfo = m.tipo === 'GASTO_SOCIO';
  const color = soloInfo ? 'var(--text-soft)' : entra ? 'var(--green)' : transfer ? 'var(--text)' : 'var(--rose)';
  const signo = transfer || soloInfo ? '' : entra ? '+' : '−';
  const donde = soloInfo ? `Gasto de ${m.aCargoDe === 'MILDRED' ? 'Mildred' : 'Freddy'} · su bolsillo`
    : transfer ? `${m.origenNombre} → ${m.destinoNombre}`
    : null;
  const titulo = m.tipo === 'PAGO_CLIENTA' ? `Pago de clienta · ${m.ordenId}`
    : m.tipo === 'DEVOLUCION_CLIENTA' ? `Devolución · ${m.ordenId}`
    : m.ordenId ? `${m.categoria} · ${m.ordenId}` : (m.nota && m.tipo !== 'COMPRA_MATERIAL' ? m.nota : m.categoria);
  const cuentaTxt = m.origenNombre || m.destinoNombre;
  const sub = donde ?? [titulo !== m.categoria ? m.categoria : '', cuentaTxt].filter(Boolean).join(' · ');
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 6 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {titulo}
          {m.auto && <span className="pill" style={{ marginLeft: 6, padding: '1px 7px', fontSize: 10, background: 'var(--blue-bg)', color: 'var(--blue)' }}>auto</span>}
        </div>
        <div style={{ ...T.sub, marginTop: 2 }}>{fechaCorta(m.fecha)}{sub ? ' · ' + sub : ''}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span className="tabular" style={{ fontWeight: 600, color }}>{signo}{money(m.monto)}</span>
        {onBorrar && (
          <button onClick={onBorrar} aria-label="Borrar movimiento" title="Borrar"
            style={{ minWidth: 36, minHeight: 36, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', color: 'var(--rose)' }}>✕</button>
        )}
      </div>
    </div>
  );
}

function MovimientosTab({ usuario, fin, onCambio }: { usuario: string; fin: FinanzasCuentas | null; onCambio: () => void }) {
  const [rango, setRango] = useState<RangoCorte>(corteDe(hoy()));
  const [todo, setTodo] = useState(false);
  const [cuenta, setCuenta] = useState('');
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setCargando(true); setError('');
    api.getMovimientos(todo ? '' : rango.desde, todo ? '' : rango.hasta)
      .then(setMovs)
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudieron cargar'))
      .finally(() => setCargando(false));
  }, [rango, todo]);
  useEffect(() => { cargar(); }, [cargar]);

  const lista = movs.filter(m => !cuenta || m.origen === cuenta || m.destino === cuenta);
  const porDia: Record<string, Movimiento[]> = {};
  lista.forEach(m => { (porDia[m.fecha] = porDia[m.fecha] || []).push(m); });

  async function borrar(m: Movimiento) {
    if (!confirm(`¿Borrar "${m.categoria}" de ${money(m.monto)} del ${fechaLarga(m.fecha)}?`)) return;
    try { await api.borrarMovimiento(m.id, usuario); cargar(); onCambio(); }
    catch (e) { alert(e instanceof Error ? e.message : 'No se pudo borrar'); }
  }

  const borrable = (m: Movimiento) => /^MOV-/.test(m.id) && !m.auto && m.tipo !== 'COMPRA_MATERIAL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" onClick={() => { setTodo(false); setRango(moverCorte(rango, -1)); }} aria-label="Corte anterior" style={{ minHeight: 44 }}>‹</button>
        <span className="tabular" style={{ fontSize: 14, fontWeight: 600 }}>{todo ? 'Todo' : `${fechaCorta(rango.desde)} – ${fechaCorta(rango.hasta)}`}</span>
        <button className="btn" onClick={() => { setTodo(false); setRango(moverCorte(rango, 1)); }} aria-label="Corte siguiente" style={{ minHeight: 44 }}>›</button>
        <button className="btn" onClick={() => setTodo(!todo)} style={{ minHeight: 44 }}>{todo ? 'Por corte' : 'Ver todo'}</button>
        <select className="input" value={cuenta} onChange={e => setCuenta(e.target.value)} style={{ flex: '1 1 180px', minHeight: 44 }} aria-label="Filtrar por cuenta">
          <option value="">Todas las cuentas</option>
          {(fin?.cuentas || []).filter(c => c.tipo !== 'DEUDA_SOCIO').map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      {error && <Aviso tono="rose">{error}</Aviso>}
      {cargando ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-faint)' }}>Cargando…</div>
        : lista.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-faint)' }}>No hay movimientos aquí.</div>
        : Object.keys(porDia).sort().reverse().map(dia => (
          <div key={dia}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', padding: '8px 0 4px', textTransform: 'uppercase' }}>{fechaLarga(dia)}</div>
            {porDia[dia].map(m => <FilaMovimiento key={m.id} m={m} onBorrar={borrable(m) ? () => borrar(m) : undefined} />)}
          </div>
        ))}
      <p style={{ ...T.sub, lineHeight: 1.5 }}>Los movimientos “auto” los creó la app desde un pedido, factura, courier o envío: se corrigen desde ahí. Los pagos de clientas se corrigen en su pedido.</p>
    </div>
  );
}

// ───────────────────────── CUENTAS ─────────────────────────

function CuentasTab({ fin }: { fin: FinanzasCuentas | null }) {
  const [cuadrando, setCuadrando] = useState('');
  const [real, setReal] = useState('');

  if (!fin) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>Cargando…</div>;
  const g = (tipos: string[]) => fin.cuentas.filter(c => tipos.includes(c.tipo));
  const c = fin.capital;
  const antesDeInicio = hoy() < fin.inicio;

  const filaCuenta = (x: CuentaConSaldo, color: string) => {
    const abierta = cuadrando === x.id;
    const dif = Math.round(((Number(real) || 0) - x.saldo) * 100) / 100;
    return (
      <div key={x.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{x.nombre}</div>
            <div style={T.sub}>{x.uso}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span className="tabular" style={{ fontWeight: 600, color }}>{money(x.saldo)}</span>
            <button className="btn" style={{ minHeight: 40, fontSize: 13 }} onClick={() => { setCuadrando(abierta ? '' : x.id); setReal(''); }}>{abierta ? 'Cerrar' : 'Cuadrar'}</button>
          </div>
        </div>
        {abierta && (
          <div style={{ marginTop: 10, background: 'var(--bg)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={T.sub} htmlFor={`real-${x.id}`}>{x.tipo === 'TARJETA' ? 'Lo que dice el estado de cuenta que debes hoy' : 'Saldo que ves hoy en el banco'}</label>
            <input id={`real-${x.id}`} type="number" inputMode="decimal" step="0.01" className="input tabular" value={real} onChange={e => setReal(e.target.value)} placeholder="0.00" />
            {real !== '' && (Math.abs(dif) < 0.01
              ? <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>✓ Cuadra con el sistema</div>
              : <div style={{ fontSize: 13, color: 'var(--rose)', lineHeight: 1.5 }}>
                  No cuadra: hay {money(Math.abs(dif))} {dif > 0 ? 'más' : 'menos'} de lo que dice el sistema. Falta registrar algo (un gasto, una transferencia o un pago) o el saldo inicial está mal.
                </div>)}
          </div>
        )}
      </div>
    );
  };

  const seccion = (titulo: string, filas: React.ReactNode) => (
    <div className="card">
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', letterSpacing: '0.06em', padding: '14px 16px 4px' }}>{titulo}</div>
      {filas}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {antesDeInicio && (
        <Aviso>El sistema nuevo empieza el {fechaLarga(fin.inicio)}. Ese día escribe el saldo de cada cuenta y tarjeta en la columna SALDO_INICIAL de la hoja TablaCuentas; desde ahí los saldos se calculan solos.</Aviso>
      )}
      {seccion('BANCOS', g(['BANCO', 'EFECTIVO']).map(x => filaCuenta(x, 'var(--green)')))}
      {seccion('TARJETAS · LO QUE SE DEBE', <>
        {g(['TARJETA']).map(x => filaCuenta(x, 'var(--rose)'))}
        {g(['TARJETA_PERSONAL']).map(x => (
          <div key={x.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{x.nombre}</div><div style={T.sub}>{x.uso}</div></div>
              <span className="tabular" style={T.sub}>{money(x.usado)}{x.limite ? ` de ${money(x.limite)}` : ''}</span>
            </div>
            {x.limite > 0 && (
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 8 }}>
                <div style={{ width: `${Math.min(100, (x.usado / x.limite) * 100)}%`, height: 6, background: 'var(--gold)', borderRadius: 3 }} />
              </div>
            )}
          </div>
        ))}
      </>)}
      {seccion('DEUDA PERSONAL CON EL NEGOCIO', g(['DEUDA_SOCIO']).map(x => (
        <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>{x.titular || x.nombre}</span>
          <span className="tabular" style={{ fontWeight: 600, color: '#8A6A2E' }}>{money(x.saldo)}</span>
        </div>
      )))}

      <div className="card m-pad" style={{ padding: 22 }}>
        <h2 className="display" style={{ ...T.h2, marginBottom: 2 }}>Capital real</h2>
        <p style={{ ...T.sub, margin: '0 0 8px' }}>Lo que quedaría si vendieras todo, cobraras todo y pagaras las tarjetas hoy</p>
        <div className="display tabular" style={{ fontSize: 42, fontWeight: 300, color: c.total < 0 ? 'var(--rose)' : 'var(--green)', marginBottom: 10 }}>{money(c.total)}</div>
        <Fila label="Bancos" valor={c.bancos} />
        <Fila label="+ Stock" valor={c.stock} />
        <Fila label="+ Materiales guardados" valor={c.materiales} />
        <Fila label="+ Pedidos en curso (costo)" valor={c.pedidosEnCurso} />
        <Fila label="+ Lo que deben las clientas" valor={c.porCobrar} />
        <Fila label="+ Deuda personal de socios" valor={c.deudaSocios} />
        <Fila label="− Tarjetas" valor={-c.tarjetas} />
      </div>
    </div>
  );
}
