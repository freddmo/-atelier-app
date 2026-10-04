// app/reportes/page.tsx
// Filtros (fecha de pedido, cliente, ciudad, color) + conteo de lo filtrado:
// qué clientes, ciudades, colores, tallas (con largo) y modelos se piden más.
// Talla y color tienen su selector; el modelo se filtra tocándolo en su lista.
// Todo se calcula en el navegador a partir de api.getPedidos().

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

// Solo los campos que esta página usa (vienen de enrichOrden en el backend).
type ItemRaw = {
  COLOR?: unknown; CANTIDAD?: unknown; ESTATUS_ITEM?: unknown;
  TALLA?: unknown; LONGITUD?: unknown; NOMBRE_PRODUCTO?: unknown; SKU?: unknown;
};
type PedidoRaw = {
  ORDEN_ID?: unknown;
  NOMBRE?: unknown;
  F_ORDEN?: unknown;
  ESTATUS_ENVIO?: unknown;
  cliente?: { CIUDAD?: unknown } | null;
  items?: ItemRaw[];
};

type Fila = {
  id: string;
  cliente: string;
  clienteKey: string;
  ciudad: string;
  ciudadKey: string;
  fecha: string;
  prendas: { color: string; talla: string; modelo: string; cantidad: number }[];
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim();

// "  Quíto " -> "quito"  (para comparar sin importar mayúsculas ni tildes)
const clave = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

const titulo = (s: string) =>
  s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SIN_CIUDAD = 'Sin ciudad';

// ─────────────────────────────────────────────────────────────
// Lista con barras: una fila por cliente / ciudad / color
// ─────────────────────────────────────────────────────────────
type FilaRanking = { key: string; label: string; valor: number; extra: string };

function Ranking({
  titulo: tituloRanking, unidad, filas, activo, onElegir,
}: {
  titulo: string;
  unidad: string;
  filas: FilaRanking[];
  activo: string;
  onElegir: (key: string) => void;
}) {
  const [verTodos, setVerTodos] = useState(false);
  const max = filas[0]?.valor || 1;
  const visibles = verTodos ? filas : filas.slice(0, 10);

  return (
    <section className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <h2 className="display" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>{tituloRanking}</h2>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{filas.length}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-soft)', margin: '0 0 14px' }}>Contado en {unidad}. Toca uno para filtrar.</p>

      {filas.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Nada con estos filtros</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibles.map((f, i) => {
            const esActivo = activo === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onElegir(esActivo ? '' : f.key)}
                style={{
                  all: 'unset', cursor: 'pointer', display: 'block', padding: '8px 10px', borderRadius: 4,
                  background: esActivo ? 'var(--bg)' : 'transparent',
                  outline: esActivo ? '1px solid var(--gold)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, marginBottom: 5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-faint)', display: 'inline-block', width: 22 }}>{i + 1}</span>
                    {f.label}
                  </span>
                  <span className="tabular" style={{ fontWeight: 600, flexShrink: 0 }}>
                    {f.valor}
                    <span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 6 }}>{f.extra}</span>
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(f.valor / max) * 100}%`, height: '100%', background: 'var(--gold)' }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {filas.length > 10 && (
        <button className="btn" onClick={() => setVerTodos(!verTodos)} style={{ marginTop: 12, fontSize: 12, padding: '6px 10px', alignSelf: 'flex-start' }}>
          {verTodos ? 'Ver solo los 10 primeros' : `Ver todos (${filas.length})`}
        </button>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cliente, setCliente] = useState('');      // texto libre
  const [ciudad, setCiudad] = useState('');        // clave de ciudad
  const [color, setColor] = useState('');          // color en MAYÚSCULAS
  const [talla, setTalla] = useState('');          // ej. "M · Tall" (se elige tocando la lista)
  const [modelo, setModelo] = useState('');        // nombre del modelo (se elige tocando la lista)
  const [verPedidos, setVerPedidos] = useState(false);

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    rangoRapido('mes');
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const data = (await api.getPedidos()) as unknown as PedidoRaw[];
      const lista: Fila[] = [];
      (data || []).forEach((p) => {
        if (str(p.ESTATUS_ENVIO).toUpperCase() === 'CANCELADO') return;
        const prendas = (p.items || [])
          .filter((it) => str(it.ESTATUS_ITEM).toUpperCase() !== 'CANCELADO')
          .map((it) => ({
            color: str(it.COLOR).toUpperCase() || 'SIN COLOR',
            talla: `${str(it.TALLA).toUpperCase() || 'SIN TALLA'} · ${titulo(str(it.LONGITUD) || 'Regular')}`,
            modelo: titulo(str(it.NOMBRE_PRODUCTO) || str(it.SKU) || 'Sin modelo'),
            cantidad: Number(it.CANTIDAD) || 1,
          }));
        if (prendas.length === 0) return;
        const nombre = str(p.NOMBRE) || 'Sin nombre';
        const ciudadTxt = str(p.cliente?.CIUDAD);
        lista.push({
          id: str(p.ORDEN_ID),
          cliente: titulo(nombre),
          clienteKey: clave(nombre),
          ciudad: ciudadTxt ? titulo(ciudadTxt) : SIN_CIUDAD,
          ciudadKey: ciudadTxt ? clave(ciudadTxt) : '__sin__',
          fecha: str(p.F_ORDEN).slice(0, 10),
          prendas,
        });
      });
      setFilas(lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  function rangoRapido(r: 'mes' | '30' | 'anio' | 'todo') {
    const hoy = new Date();
    if (r === 'todo') { setDesde(''); setHasta(''); return; }
    let ini: Date;
    if (r === 'mes') ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    else if (r === 'anio') ini = new Date(hoy.getFullYear(), 0, 1);
    else { ini = new Date(hoy); ini.setDate(ini.getDate() - 30); }
    setDesde(ymdLocal(ini));
    setHasta(ymdLocal(hoy));
  }

  function limpiar() {
    setCliente(''); setCiudad(''); setColor(''); setTalla(''); setModelo('');
  }

  // Opciones de los selectores (de TODOS los pedidos, para que no desaparezcan al filtrar)
  const opcionesCiudad = useMemo(() => {
    const m = new Map<string, string>();
    filas.forEach((f) => { if (!m.has(f.ciudadKey)) m.set(f.ciudadKey, f.ciudad); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [filas]);

  const opcionesColor = useMemo(() => {
    const s = new Set<string>();
    filas.forEach((f) => f.prendas.forEach((p) => s.add(p.color)));
    return [...s].sort();
  }, [filas]);

  const opcionesModelo = useMemo(() => {
    const s = new Set<string>();
    filas.forEach((f) => f.prendas.forEach((p) => s.add(p.modelo)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [filas]);

  // Tallas en orden de tamaño (XXS → 3XL) y luego por largo
  const opcionesTalla = useMemo(() => {
    const ORDEN = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'];
    const LARGO = ['Petite', 'Regular', 'Tall'];
    const s = new Set<string>();
    filas.forEach((f) => f.prendas.forEach((p) => s.add(p.talla)));
    const pos = (arr: string[], v: string) => { const i = arr.indexOf(v); return i === -1 ? 99 : i; };
    return [...s].sort((a, b) => {
      const [ta, la] = a.split(' · '); const [tb, lb] = b.split(' · ');
      return pos(ORDEN, ta) - pos(ORDEN, tb) || ta.localeCompare(tb) || pos(LARGO, la) - pos(LARGO, lb) || a.localeCompare(b);
    });
  }, [filas]);

  // Aplicar filtros. Con filtro de color, solo cuentan las prendas de ese color.
  const filtrados = useMemo(() => {
    const busca = clave(cliente);
    return filas
      .filter((f) => (!desde || (f.fecha && f.fecha >= desde)) && (!hasta || (f.fecha && f.fecha <= hasta)))
      .filter((f) => !busca || f.clienteKey.includes(busca))
      .filter((f) => !ciudad || f.ciudadKey === ciudad)
      .map((f) => (color || talla || modelo
        ? { ...f, prendas: f.prendas.filter((p) => (!color || p.color === color) && (!talla || p.talla === talla) && (!modelo || p.modelo === modelo)) }
        : f))
      .filter((f) => f.prendas.length > 0)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [filas, desde, hasta, cliente, ciudad, color, talla, modelo]);

  const totalPrendas = (f: Fila) => f.prendas.reduce((s, p) => s + p.cantidad, 0);

  const resumen = useMemo(() => {
    const porCliente = new Map<string, { label: string; pedidos: number; prendas: number }>();
    const porCiudad = new Map<string, { label: string; pedidos: number; prendas: number }>();
    const porColor = new Map<string, { prendas: number; pedidos: Set<string> }>();
    const porTalla = new Map<string, { prendas: number; pedidos: Set<string> }>();
    const porModelo = new Map<string, { prendas: number; pedidos: Set<string> }>();
    const sumar = (m: Map<string, { prendas: number; pedidos: Set<string> }>, k: string, n: number, id: string) => {
      const x = m.get(k) || { prendas: 0, pedidos: new Set<string>() };
      x.prendas += n; x.pedidos.add(id); m.set(k, x);
    };
    let prendas = 0;

    filtrados.forEach((f) => {
      const n = totalPrendas(f);
      prendas += n;

      const c = porCliente.get(f.clienteKey) || { label: f.cliente, pedidos: 0, prendas: 0 };
      c.pedidos++; c.prendas += n; porCliente.set(f.clienteKey, c);

      const ci = porCiudad.get(f.ciudadKey) || { label: f.ciudad, pedidos: 0, prendas: 0 };
      ci.pedidos++; ci.prendas += n; porCiudad.set(f.ciudadKey, ci);

      f.prendas.forEach((p) => {
        sumar(porColor, p.color, p.cantidad, f.id);
        sumar(porTalla, p.talla, p.cantidad, f.id);
        sumar(porModelo, p.modelo, p.cantidad, f.id);
      });
    });

    const plural = (n: number, s: string, pl: string) => `${n} ${n === 1 ? s : pl}`;
    const orden = (a: FilaRanking, b: FilaRanking) => b.valor - a.valor || a.label.localeCompare(b.label);

    return {
      pedidos: filtrados.length,
      prendas,
      clientes: porCliente.size,
      ciudades: porCiudad.size,
      rankingClientes: [...porCliente.entries()]
        .map(([key, v]) => ({ key, label: v.label, valor: v.pedidos, extra: plural(v.prendas, 'prenda', 'prendas') }))
        .sort(orden),
      rankingCiudades: [...porCiudad.entries()]
        .map(([key, v]) => ({ key, label: v.label, valor: v.pedidos, extra: plural(v.prendas, 'prenda', 'prendas') }))
        .sort(orden),
      rankingTallas: [...porTalla.entries()]
        .map(([key, v]) => ({ key, label: key, valor: v.prendas, extra: plural(v.pedidos.size, 'pedido', 'pedidos') }))
        .sort(orden),
      rankingModelos: [...porModelo.entries()]
        .map(([key, v]) => ({ key, label: key, valor: v.prendas, extra: plural(v.pedidos.size, 'pedido', 'pedidos') }))
        .sort(orden),
      rankingColores: [...porColor.entries()]
        .map(([key, v]) => ({ key, label: titulo(key), valor: v.prendas, extra: plural(v.pedidos.size, 'pedido', 'pedidos') }))
        .sort(orden),
    };
  }, [filtrados]);

  const hayFiltros = !!(cliente || ciudad || color || talla || modelo);
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-soft)' };

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 64px' }}>
        <h1 className="display" style={{ fontSize: 44, fontWeight: 300, margin: '0 0 24px', lineHeight: 1 }}>
          Reportes
        </h1>

        {/* ================= FILTROS ================= */}
        <section className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Pedidos hechos desde</label>
              <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Hasta</label>
              <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Cliente</label>
              <input className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Escribe un nombre" style={{ marginTop: 4, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Ciudad</label>
              <select className="input" value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={{ marginTop: 4, width: '100%' }}>
                <option value="">Todas</option>
                {opcionesCiudad.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Color</label>
              <select className="input" value={color} onChange={(e) => setColor(e.target.value)} style={{ marginTop: 4, width: '100%' }}>
                <option value="">Todos</option>
                {opcionesColor.map((c) => <option key={c} value={c}>{titulo(c)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Talla</label>
              <select className="input" value={talla} onChange={(e) => setTalla(e.target.value)} style={{ marginTop: 4, width: '100%' }}>
                <option value="">Todas</option>
                {opcionesTalla.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Modelo</label>
              <select className="input" value={modelo} onChange={(e) => setModelo(e.target.value)} style={{ marginTop: 4, width: '100%' }}>
                <option value="">Todos</option>
                {opcionesModelo.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => rangoRapido('mes')}>Este mes</button>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => rangoRapido('30')}>Últimos 30 días</button>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => rangoRapido('anio')}>Este año</button>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => rangoRapido('todo')}>Desde siempre</button>
            {hayFiltros && (
              <button className="btn" style={{ padding: '6px 12px', fontSize: 12, marginLeft: 'auto' }} onClick={limpiar}>
                Quitar todos los filtros
              </button>
            )}
          </div>
        </section>

        {error ? (
          <div className="card" style={{ padding: 24, color: 'var(--rose)' }}>
            No se pudieron cargar los pedidos: {error}.{' '}
            <button className="btn" style={{ marginLeft: 8, fontSize: 12, padding: '4px 10px' }} onClick={cargar}>Reintentar</button>
          </div>
        ) : cargando ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)' }}>Cargando pedidos…</div>
        ) : (
          <>
            {/* ================= TOTALES ================= */}
            <p style={{ fontSize: 14, color: 'var(--text-soft)', margin: '0 0 12px' }}>
              {desde || hasta
                ? <>Pedidos hechos {desde ? `desde el ${fmtDate(desde)}` : ''} {hasta ? `hasta el ${fmtDate(hasta)}` : ''}</>
                : <>Todos los pedidos</>}
              {(color || talla || modelo) && <> · solo prendas {[color && `color ${titulo(color)}`, talla && `talla ${talla}`, modelo && `modelo ${modelo}`].filter(Boolean).join(', ')}</>}
              {talla && <> · talla {talla}</>}
              {' '}· sin contar cancelados
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
              {[
                { l: 'Pedidos', v: resumen.pedidos },
                { l: 'Prendas', v: resumen.prendas },
                { l: 'Clientes distintos', v: resumen.clientes },
                { l: 'Ciudades', v: resumen.ciudades },
              ].map((x) => (
                <div key={x.l} style={{ background: 'var(--surface)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 6 }}>{x.l}</div>
                  <div className="display tabular" style={{ fontSize: 34, fontWeight: 300, lineHeight: 1 }}>{x.v}</div>
                </div>
              ))}
            </div>

            {/* ================= CONTEOS ================= */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 20 }}>
              <Ranking
                titulo="Clientes" unidad="pedidos" filas={resumen.rankingClientes}
                activo={cliente ? clave(cliente) : ''}
                onElegir={(k) => setCliente(k ? (resumen.rankingClientes.find((r) => r.key === k)?.label || '') : '')}
              />
              <Ranking titulo="Ciudades" unidad="pedidos" filas={resumen.rankingCiudades} activo={ciudad} onElegir={setCiudad} />
              <Ranking titulo="Colores" unidad="prendas" filas={resumen.rankingColores} activo={color} onElegir={setColor} />
              <Ranking titulo="Tallas" unidad="prendas" filas={resumen.rankingTallas} activo={talla} onElegir={setTalla} />
              <Ranking titulo="Modelos" unidad="prendas" filas={resumen.rankingModelos} activo={modelo} onElegir={setModelo} />
            </div>

            {/* ================= PEDIDOS (plegado) ================= */}
            {filtrados.length > 0 && (
              <section className="card" style={{ padding: 20 }}>
                <button className="btn" onClick={() => setVerPedidos(!verPedidos)} style={{ fontSize: 13, padding: '8px 14px' }}>
                  {verPedidos ? 'Ocultar pedidos' : `Ver los ${filtrados.length} pedidos`}
                </button>
                {verPedidos && (
                  <div style={{ overflowX: 'auto', marginTop: 14 }}>
                    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-soft)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 500 }}>Pedido</th>
                          <th style={{ padding: '8px 10px', fontWeight: 500 }}>Fecha</th>
                          <th style={{ padding: '8px 10px', fontWeight: 500 }}>Cliente</th>
                          <th style={{ padding: '8px 10px', fontWeight: 500 }}>Ciudad</th>
                          <th style={{ padding: '8px 10px', fontWeight: 500 }}>Prendas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrados.map((f) => (
                          <tr key={f.id} onClick={() => router.push(`/pedido/${encodeURIComponent(f.id)}`)}
                            style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                            <td style={{ padding: '10px' }} className="mono">{f.id}</td>
                            <td style={{ padding: '10px', color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>{fmtDate(f.fecha)}</td>
                            <td style={{ padding: '10px' }}>{f.cliente}</td>
                            <td style={{ padding: '10px', color: 'var(--text-soft)' }}>{f.ciudad}</td>
                            <td style={{ padding: '10px', color: 'var(--text-soft)' }}>
                              {f.prendas.map((p) => `${p.modelo} ${p.talla} ${titulo(p.color)}${p.cantidad > 1 ? ` ×${p.cantidad}` : ''}`).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
