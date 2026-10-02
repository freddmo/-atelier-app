'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, Cliente, SetCatalogo, NuevoPedidoItem, CrearPedidoParams, LoteStock } from '@/lib/api';
import { Producto } from '@/lib/types';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const LONGITUDES = ['Regular', 'Petite', 'Tall'];

function repartirSet(precio: number): { top: number; pant: number } {
  const mitad = precio / 2;
  const top = Math.ceil(mitad * 100) / 100;
  const pant = Math.round((precio - top) * 100) / 100;
  return { top, pant };
}

type LineaProducto = {
  id: number;
  tipo: 'set' | 'suelta' | 'stock';
  setNombre?: string;
  skuTop?: string;
  skuPant?: string;
  tallaTop: string;
  tallaPant: string;
  longitud: string;
  color: string;
  sku?: string;
  talla: string;
  cantidad: number;
  loteId?: string;
  costoLote?: number;
  precioLista: number;
};

export default function NuevoPedidoPage() {
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [sets, setSets] = useState<SetCatalogo[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stockLotes, setStockLotes] = useState<LoteStock[]>([]);
  const [loading, setLoading] = useState(true);

  const [clienteEsNuevo, setClienteEsNuevo] = useState(false);
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '', telefono: '', direccion: '', ciudad: '', cedulaRuc: '', industria: '', email: '',
  });
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [editandoDireccion, setEditandoDireccion] = useState(false);
  const [editFields, setEditFields] = useState({ direccion: '', ciudad: '', telefono: '' });
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [lineas, setLineas] = useState<LineaProducto[]>([]);
  const [precioNegociado, setPrecioNegociado] = useState('');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    if (user.rol !== 'admin') { router.replace('/pedidos'); return; }
    // Se calcula aquí (solo en el navegador) para evitar un mismatch de
    // hydration entre el servidor (UTC) y el cliente (Ecuador) — este
    // campo SÍ se muestra en pantalla (input "Fecha del pedido").
    setFecha(new Date().toISOString().split('T')[0]);
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try {
      const [cls, sts, prods, stk] = await Promise.all([
        api.getClientes(),
        api.getSets(),
        api.getProductos(),
        api.getStockDisponible(),
      ]);
      setClientes(cls);
      setSets(sts);
      setProductos(prods);
      setStockLotes(stk);
    } catch (err) {
      alert('Error al cargar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setLoading(false);
    }
  }

  // ===== CLIENTE =====
  const clientesFiltrados = clienteBusqueda.trim()
    ? clientes.filter(c => String(c.NOMBRE || '').toLowerCase().includes(clienteBusqueda.toLowerCase()))
    : [];

  async function handleGuardarCliente() {
    if (!nuevoCliente.nombre.trim()) { alert('Escribe el nombre del cliente'); return; }
    const user = auth.getUser();
    if (!user) return;
    setGuardandoCliente(true);
    try {
      const creado = await api.crearCliente({ ...nuevoCliente }, fecha, user.usuario);
      setClientes(prev => [...prev, creado]);
      setClienteSel(creado);
      setClienteEsNuevo(false);
      setNuevoCliente({ nombre: '', telefono: '', direccion: '', ciudad: '', cedulaRuc: '', industria: '', email: '' });
      setToast(`✅ Cliente ${creado.CLIENTE_ID} guardado`);
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      alert('Error al guardar cliente: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setGuardandoCliente(false);
    }
  }

  async function handleActualizarCliente() {
    if (!clienteSel) return;
    const user = auth.getUser();
    if (!user) return;
    setGuardandoEdit(true);
    try {
      await api.actualizarCliente(clienteSel.CLIENTE_ID, editFields, user.usuario);
      const actualizado = { ...clienteSel, ...editFields };
      setClienteSel(actualizado);
      setClientes(prev => prev.map(c => c.CLIENTE_ID === clienteSel.CLIENTE_ID ? actualizado : c));
      setEditandoDireccion(false);
      setToast('✅ Datos actualizados');
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setGuardandoEdit(false);
    }
  }

  // ===== PRODUCTOS =====
  function addSet() {
    const primerSet = sets[0];
    setLineas([...lineas, {
      id: Date.now(),
      tipo: 'set',
      setNombre: primerSet ? primerSet.SET_NOMBRE : '',
      skuTop: primerSet ? primerSet.SKU_TOP : '',
      skuPant: primerSet ? primerSet.SKU_PANTALON : '',
      tallaTop: '', tallaPant: '', longitud: 'Regular', color: '',
      talla: '', cantidad: 1,
      precioLista: primerSet ? primerSet.PRECIO_SET : 0,
    }]);
  }

  function addSuelta() {
    const primerProd = productos[0];
    setLineas([...lineas, {
      id: Date.now(),
      tipo: 'suelta',
      sku: primerProd ? primerProd.SKU : '',
      tallaTop: '', tallaPant: '', longitud: 'Regular', color: '',
      talla: '', cantidad: 1,
      precioLista: 0,
    }]);
  }

  function addStock() {
    setLineas([...lineas, {
      id: Date.now(),
      tipo: 'stock',
      tallaTop: '', tallaPant: '', longitud: 'Regular', color: '',
      sku: '', talla: '', cantidad: 1,
      loteId: '', costoLote: 0,
      precioLista: 0,
    }]);
  }

  function updateLinea(id: number, campo: string, valor: string | number) {
    setLineas(lineas.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [campo]: valor };
      if (campo === 'setNombre') {
        const s = sets.find(x => x.SET_NOMBRE === valor);
        if (s) {
          updated.skuTop = s.SKU_TOP;
          updated.skuPant = s.SKU_PANTALON;
          updated.precioLista = s.PRECIO_SET;
        }
      }
      if (campo === 'loteId') {
        const lote = stockLotes.find(x => x.LOTE_ID === valor);
        if (lote) {
          updated.sku = lote.SKU;
          updated.talla = lote.TALLA;
          updated.longitud = lote.LONGITUD;
          updated.color = lote.COLOR;
          updated.costoLote = lote.COSTO_UNITARIO;
        }
      }
      return updated;
    }));
  }

  function removeLinea(id: number) {
    setLineas(lineas.filter(l => l.id !== id));
  }

  // ===== STOCK: disponible por lote descontando lo ya elegido en este pedido =====
  function disponibleLoteParaLinea(lote: LoteStock, lineaId: number) {
    const usadoOtras = lineas
      .filter(l => l.tipo === 'stock' && l.loteId === lote.LOTE_ID && l.id !== lineaId)
      .reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
    return lote.CANT_DISPONIBLE - usadoOtras;
  }

  // ===== CÁLCULOS =====
  const totalLista = lineas.reduce(
    (s, l) => s + (l.precioLista * ((l.tipo === 'suelta' || l.tipo === 'stock') ? l.cantidad : 1)),
    0
  );
  const precioNegNum = Number(precioNegociado) || 0;
  const descuentoMonto = precioNegNum > 0 ? Math.max(0, totalLista - precioNegNum) : 0;
  const totalFinal = totalLista - descuentoMonto;

  // ===== SUBMIT =====
  async function handleSubmit() {
    if (!clienteEsNuevo && !clienteSel) {
      alert('Selecciona un cliente o marca "cliente nuevo"');
      return;
    }
    if (clienteEsNuevo && !nuevoCliente.nombre.trim()) {
      alert('Escribe el nombre del cliente nuevo');
      return;
    }
    if (lineas.length === 0) {
      alert('Agrega al menos un producto');
      return;
    }

    // Validar que no se exceda el stock disponible por lote
    const usoPorLote: Record<string, number> = {};
    for (const l of lineas) {
      if (l.tipo === 'stock' && l.loteId) {
        usoPorLote[l.loteId] = (usoPorLote[l.loteId] || 0) + (Number(l.cantidad) || 0);
      }
    }
    for (const loteId in usoPorLote) {
      const lote = stockLotes.find(x => x.LOTE_ID === loteId);
      if (lote && usoPorLote[loteId] > lote.CANT_DISPONIBLE) {
        alert(`Estás asignando ${usoPorLote[loteId]} de ${lote.SKU} (${loteId}) pero solo hay ${lote.CANT_DISPONIBLE} disponibles.`);
        return;
      }
    }

    const items: NuevoPedidoItem[] = [];
    for (const l of lineas) {
      if (l.tipo === 'set') {
        if (!l.setNombre || !l.tallaTop.trim() || !l.tallaPant.trim() || !l.color.trim()) {
          alert('Hay un set incompleto (falta set, tallas o color)');
          return;
        }
        const { top, pant } = repartirSet(l.precioLista);
        items.push({
          sku: l.skuTop!, talla: l.tallaTop.trim(), longitud: l.longitud,
          color: l.color.trim(), cantidad: 1, precioVenta: top, parteDeSet: l.setNombre!,
          origen: 'PEDIDO',
        });
        items.push({
          sku: l.skuPant!, talla: l.tallaPant.trim(), longitud: l.longitud,
          color: l.color.trim(), cantidad: 1, precioVenta: pant, parteDeSet: l.setNombre!,
          origen: 'PEDIDO',
        });
      } else if (l.tipo === 'suelta') {
        if (!l.sku || !l.talla.trim() || !l.color.trim() || l.cantidad <= 0 || l.precioLista <= 0) {
          alert('Hay una prenda suelta incompleta');
          return;
        }
        items.push({
          sku: l.sku, talla: l.talla.trim(), longitud: l.longitud,
          color: l.color.trim(), cantidad: l.cantidad, precioVenta: l.precioLista, parteDeSet: '',
          origen: 'PEDIDO',
        });
      } else {
        if (!l.loteId || !l.sku || l.cantidad <= 0 || l.precioLista <= 0) {
          alert('Hay una prenda de stock sin lote seleccionado o sin precio');
          return;
        }
        items.push({
          sku: l.sku, talla: l.talla, longitud: l.longitud,
          color: l.color, cantidad: l.cantidad, precioVenta: l.precioLista, parteDeSet: '',
          origen: 'STOCK', loteId: l.loteId,
        });
      }
    }

    const user = auth.getUser();
    if (!user) return;

    const params: CrearPedidoParams = {
      cliente: clienteEsNuevo
        ? { esNuevo: true, ...nuevoCliente }
        : { esNuevo: false, clienteId: clienteSel!.CLIENTE_ID },
      items,
      descuento: { monto: descuentoMonto, nota: descuentoMonto > 0 ? 'Precio negociado por vendedora' : '' },
      estado: 'HACER PEDIDO',
      notas: notas.trim(),
      fecha,
    };

    setSubmitting(true);
    try {
      const res = await api.crearPedido(params, user.usuario);
      setToast(`✅ Pedido ${res.ordenId} creado`);
      setTimeout(() => {
        router.push(`/pedido/${encodeURIComponent(res.ordenId)}`);
      }, 1200);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">PEDIDOS · NUEVO</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Nuevo pedido<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-faint)' }}>Cargando…</div>
        ) : (
          <>
            {/* 1. CLIENTE */}
            <div className="card m-pad" style={{ padding: 28, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>1. Cliente</h3>
                <button
                  className="btn"
                  onClick={() => { setClienteEsNuevo(!clienteEsNuevo); setClienteSel(null); setClienteBusqueda(''); }}
                  style={{ padding: '6px 14px', fontSize: 12 }}
                >
                  {clienteEsNuevo ? '← Buscar existente' : '+ Cliente nuevo'}
                </button>
              </div>

              {!clienteEsNuevo ? (
                <div>
                  {clienteSel ? (
                    <div>
                      <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div className="display" style={{ fontSize: 16 }}>{clienteSel.NOMBRE}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                            {clienteSel.CIUDAD} · {clienteSel.TELEFONO} · {clienteSel.INDUSTRIA}
                          </div>
                          {clienteSel.DIRECCION && (
                            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{clienteSel.DIRECCION}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn"
                            onClick={() => {
                              setEditFields({ direccion: clienteSel.DIRECCION || '', ciudad: clienteSel.CIUDAD || '', telefono: clienteSel.TELEFONO || '' });
                              setEditandoDireccion(true);
                            }}
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            ✏️ Editar
                          </button>
                          <button className="btn" onClick={() => { setClienteSel(null); setEditandoDireccion(false); }} style={{ padding: '4px 10px', fontSize: 12 }}>Cambiar</button>
                        </div>
                      </div>

                      {editandoDireccion && (
                        <div style={{ marginTop: 10, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-soft)', fontWeight: 500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Actualizar datos de {clienteSel.NOMBRE}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Dirección</label>
                              <input className="input" value={editFields.direccion} onChange={e => setEditFields(p => ({ ...p, direccion: e.target.value }))} style={{ marginTop: 4, fontSize: 13 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Ciudad</label>
                              <input className="input" value={editFields.ciudad} onChange={e => setEditFields(p => ({ ...p, ciudad: e.target.value }))} style={{ marginTop: 4, fontSize: 13 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Teléfono</label>
                              <input className="input" value={editFields.telefono} onChange={e => setEditFields(p => ({ ...p, telefono: e.target.value }))} style={{ marginTop: 4, fontSize: 13 }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => setEditandoDireccion(false)} disabled={guardandoEdit} style={{ fontSize: 12 }}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleActualizarCliente} disabled={guardandoEdit} style={{ fontSize: 12 }}>
                              {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        className="input"
                        placeholder="Buscar cliente por nombre…"
                        value={clienteBusqueda}
                        onChange={(e) => setClienteBusqueda(e.target.value)}
                      />
                      {clientesFiltrados.length > 0 && (
                        <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 4, maxHeight: 200, overflowY: 'auto' }}>
                          {clientesFiltrados.map(c => (
                            <div
                              key={c.CLIENTE_ID}
                              onClick={() => { setClienteSel(c); setClienteBusqueda(''); }}
                              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ fontSize: 14 }}>{c.NOMBRE}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{c.CIUDAD} · {c.TELEFONO}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Nombre *</label>
                      <input className="input" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} style={{ marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Teléfono</label>
                      <input className="input" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} style={{ marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Dirección</label>
                      <input className="input" value={nuevoCliente.direccion} onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })} style={{ marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Ciudad</label>
                      <input className="input" value={nuevoCliente.ciudad} onChange={(e) => setNuevoCliente({ ...nuevoCliente, ciudad: e.target.value })} style={{ marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Cédula / RUC</label>
                      <input className="input" value={nuevoCliente.cedulaRuc} onChange={(e) => setNuevoCliente({ ...nuevoCliente, cedulaRuc: e.target.value })} style={{ marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Industria</label>
                      <input className="input" value={nuevoCliente.industria} onChange={(e) => setNuevoCliente({ ...nuevoCliente, industria: e.target.value })} style={{ marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Email</label>
                      <input className="input" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} style={{ marginTop: 4 }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      Puedes guardarlo ahora en la base de clientes, o se creará solo al crear el pedido.
                    </span>
                    <button
                      className="btn btn-primary"
                      onClick={handleGuardarCliente}
                      disabled={guardandoCliente || !nuevoCliente.nombre.trim()}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {guardandoCliente ? 'Guardando…' : 'Guardar cliente'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. PRODUCTOS */}
            <div className="card m-pad" style={{ padding: 28, marginBottom: 20 }}>
              <div className="m-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                  2. Productos · <span className="tabular">{lineas.length}</span>
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={addSet} style={{ padding: '6px 14px', fontSize: 12 }}>+ Set</button>
                  <button className="btn" onClick={addSuelta} style={{ padding: '6px 14px', fontSize: 12 }}>+ Producto suelto</button>
                  <button className="btn" onClick={addStock} style={{ padding: '6px 14px', fontSize: 12, color: 'var(--green)' }}>+ De stock</button>
                </div>
              </div>

              {lineas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', background: 'var(--bg)', borderRadius: 4, fontSize: 13 }}>
                  Sin productos. Agrega un set, una prenda suelta o algo de stock.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {lineas.map(l => (
                    <div key={l.id} style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: l.tipo === 'set' ? 'var(--gold)' : l.tipo === 'stock' ? 'var(--green)' : 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {l.tipo === 'set' ? '◆ Set' : l.tipo === 'stock' ? '▣ De stock' : '○ Producto suelto'}
                        </span>
                        <button className="btn" onClick={() => removeLinea(l.id)} style={{ padding: '4px 10px', fontSize: 12, color: 'var(--rose)' }}>✕</button>
                      </div>

                      {l.tipo === 'set' ? (
                        <div className="m-2col-first" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Set</label>
                            <select className="input" value={l.setNombre} onChange={(e) => updateLinea(l.id, 'setNombre', e.target.value)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }}>
                              {sets.map(s => <option key={s.SET_NOMBRE} value={s.SET_NOMBRE}>{s.SET_NOMBRE} — {fmtMoney(s.PRECIO_SET)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Talla top</label>
                            <input className="input" value={l.tallaTop} onChange={(e) => updateLinea(l.id, 'tallaTop', e.target.value)} placeholder="XS" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Talla pant</label>
                            <input className="input" value={l.tallaPant} onChange={(e) => updateLinea(l.id, 'tallaPant', e.target.value)} placeholder="S" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Longitud</label>
                            <select className="input" value={l.longitud} onChange={(e) => updateLinea(l.id, 'longitud', e.target.value)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }}>
                              {LONGITUDES.map(x => <option key={x} value={x}>{x}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Color</label>
                            <input className="input" value={l.color} onChange={(e) => updateLinea(l.id, 'color', e.target.value)} placeholder="Negro" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                          </div>
                        </div>
                      ) : l.tipo === 'suelta' ? (
                        <div className="m-2col-first" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 1fr 0.6fr 0.9fr', gap: 10, alignItems: 'end' }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Producto</label>
                            <select className="input" value={l.sku} onChange={(e) => updateLinea(l.id, 'sku', e.target.value)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }}>
                              {productos.map(p => <option key={p.SKU} value={p.SKU}>{p.SKU} — {p.NOMBRE}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Talla</label>
                            <input className="input" value={l.talla} onChange={(e) => updateLinea(l.id, 'talla', e.target.value)} placeholder="M" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Longitud</label>
                            <select className="input" value={l.longitud} onChange={(e) => updateLinea(l.id, 'longitud', e.target.value)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }}>
                              {LONGITUDES.map(x => <option key={x} value={x}>{x}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Color</label>
                            <input className="input" value={l.color} onChange={(e) => updateLinea(l.id, 'color', e.target.value)} placeholder="Negro" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Cant</label>
                            <input type="number" className="input" value={l.cantidad} onChange={(e) => updateLinea(l.id, 'cantidad', Number(e.target.value) || 0)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Precio $</label>
                            <input type="number" step="0.01" className="input" value={l.precioLista || ''} onChange={(e) => updateLinea(l.id, 'precioLista', Number(e.target.value) || 0)} placeholder="0.00" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="m-2col-first" style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.6fr 1fr', gap: 10, alignItems: 'end' }}>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Lote en stock</label>
                              <select className="input" value={l.loteId} onChange={(e) => updateLinea(l.id, 'loteId', e.target.value)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }}>
                                <option value="">— Elegir prenda de stock —</option>
                                {stockLotes
                                  .map(lote => ({ lote, restante: disponibleLoteParaLinea(lote, l.id) }))
                                  .filter(({ lote, restante }) => restante > 0 || lote.LOTE_ID === l.loteId)
                                  .map(({ lote, restante }) => {
                                    const eta = lote.eta && (lote.eta.fechaMax || lote.eta.fechaMin)
                                      ? ` ~${lote.eta.fechaMax || lote.eta.fechaMin}` : '';
                                    const etiqueta = lote.enCamino ? `🚚 EN CAMINO/PREVENTA${eta} · ` : '';
                                    return (
                                      <option key={lote.LOTE_ID} value={lote.LOTE_ID}>
                                        {etiqueta}{lote.SKU} {lote.TALLA} {lote.LONGITUD} {lote.COLOR} — {fmtMoney(lote.COSTO_UNITARIO)} ({lote.LOTE_ID}) · quedan {restante}{lote.tieneCourier ? '' : ' ⚠'}
                                      </option>
                                    );
                                  })}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Cant</label>
                              <input type="number" className="input" value={l.cantidad} onChange={(e) => updateLinea(l.id, 'cantidad', Number(e.target.value) || 0)} style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Precio venta $</label>
                              <input type="number" step="0.01" className="input" value={l.precioLista || ''} onChange={(e) => updateLinea(l.id, 'precioLista', Number(e.target.value) || 0)} placeholder="0.00" style={{ marginTop: 2, padding: '6px 8px', fontSize: 12 }} />
                            </div>
                          </div>
                          {l.loteId && (() => {
                            const loteSel = stockLotes.find(x => x.LOTE_ID === l.loteId);
                            return (
                              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
                                {l.sku} · {l.talla} · {l.longitud} · {l.color} · costo {fmtMoney(l.costoLote || 0)}
                                {loteSel?.enCamino && (
                                  <span style={{ color: 'var(--amber)', fontWeight: 600, marginLeft: 8 }}>
                                    🚚 Preventa{loteSel.eta?.fechaMax ? ` · llega ~${loteSel.eta.fechaMax}` : ''}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {l.tipo === 'set' && (
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>
                          Precio lista: {fmtMoney(l.precioLista)} → top {fmtMoney(repartirSet(l.precioLista).top)} + pantalón {fmtMoney(repartirSet(l.precioLista).pant)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. PRECIO Y NOTAS */}
            <div className="card m-pad" style={{ padding: 28, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>3. Precio y notas</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha del pedido</label>
                  <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Precio negociado (opcional)</label>
                  <input type="number" step="0.01" className="input" value={precioNegociado} onChange={(e) => setPrecioNegociado(e.target.value)} placeholder={fmtMoney(totalLista)} style={{ marginTop: 4 }} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Notas</label>
                <input className="input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas del pedido…" style={{ marginTop: 4 }} />
              </div>
            </div>

            {/* 4. RESUMEN */}
            {lineas.length > 0 && (
              <div className="card" style={{ padding: 24, marginBottom: 20, background: 'linear-gradient(to right, rgba(184,149,78,0.04), transparent)', borderColor: 'var(--gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-soft)', marginBottom: 5 }}>
                  <span>Precio lista</span>
                  <span className="tabular">{fmtMoney(totalLista)}</span>
                </div>
                {descuentoMonto > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--green)', marginBottom: 5 }}>
                    <span>Descuento (precio negociado)</span>
                    <span className="tabular">−{fmtMoney(descuentoMonto)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Total del pedido</span>
                  <span className="display tabular" style={{ fontSize: 24 }}>{fmtMoney(totalFinal)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => router.push('/pedidos')} disabled={submitting}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || lineas.length === 0}>
                {submitting ? 'Creando…' : 'Crear pedido'}
              </button>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--surface)', padding: '14px 24px', borderRadius: 4, fontSize: 13, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          {toast}
        </div>
      )}
    </>
  );
}
