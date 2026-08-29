'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, LoteStock, LoteEnCamino, Courier, Combo } from '@/lib/api';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';


type Material = {
  ID: string;
  NOMBRE: string;
  CATEGORIA: string;
  STOCK: number;
  STOCK_MINIMO: number;
  COSTO: number;
};

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(d: string) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function fmtEta(eta: { fechaMin: string; fechaMax: string } | null) {
  if (!eta || (!eta.fechaMin && !eta.fechaMax)) return null;
  return `${fmtShort(eta.fechaMin)} – ${fmtShort(eta.fechaMax)}`;
}

function estadoColor(e: string) {
  const k = (e || '').toUpperCase();
  if (k === 'EN TRANSITO A FL') return 'var(--amber)';
  if (k === 'EN BODEGA FL') return '#6b8cce';
  if (k === 'EN CAMINO A EC') return 'var(--gold)';
  return 'var(--text-soft)';
}

// ===== RECUADRO DE COLOR + EDITOR (solo admin edita) =====
function ColorSwatch({
  color, hex, isAdmin, onSave
}: {
  color: string;
  hex: string;
  isAdmin: boolean;
  onSave: (color: string, hex: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(hex || '#CCCCCC');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setVal(hex || '#CCCCCC'); }, [hex]);

  const tiene = !!hex;
  const fondo = tiene ? hex : 'transparent';

  async function guardar() {
    if (!/^#[0-9A-Fa-f]{6}$/.test(val)) { alert('Hex inválido (usa #RRGGBB)'); return; }
    setSaving(true);
    try {
      await onSave(color, val.toUpperCase());
      setOpen(false);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onClick={(e) => { if (isAdmin) { e.stopPropagation(); setOpen(o => !o); } }}
        title={isAdmin ? 'Editar color' : color}
        style={{
          width: 14, height: 14, borderRadius: 4, flexShrink: 0,
          background: fondo,
          border: tiene ? '1px solid rgba(0,0,0,0.2)' : '1px dashed var(--text-faint)',
          cursor: isAdmin ? 'pointer' : 'default',
          backgroundImage: tiene ? 'none' : 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 6px)',
        }}
      />
      {open && isAdmin && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="print-hide"
          style={{
            position: 'absolute', top: 20, left: 0, zIndex: 50,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            width: 200,
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-soft)', marginBottom: 8, fontWeight: 500 }}>
            Color de <strong>{color}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              type="color"
              value={val}
              onChange={e => setVal(e.target.value)}
              style={{ width: 40, height: 36, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none' }}
            />
            <input
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder="#RRGGBB"
              className="input"
              style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => setOpen(false)} disabled={saving} style={{ flex: 1, justifyContent: 'center', padding: '5px 8px', fontSize: 12 }}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={guardar} disabled={saving} style={{ flex: 1, justifyContent: 'center', padding: '5px 8px', fontSize: 12 }}>
              {saving ? '…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

// ===== CHECKLIST DE AUDITORÍA =====
function ChecklistAuditoria({ lotes }: { lotes: LoteStock[] }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [iniciado, setIniciado] = useState(false);

  function iniciar() {
    const init: Record<string, boolean> = {};
    lotes.forEach(l => { init[l.LOTE_ID] = false; });
    setChecks(init);
    setIniciado(true);
  }

  function reset() {
    setChecks({});
    setIniciado(false);
  }

  function toggle(loteId: string) {
    setChecks(prev => ({ ...prev, [loteId]: !prev[loteId] }));
  }

  const encontrados = Object.values(checks).filter(Boolean).length;
  const total = lotes.length;
  const faltantes = lotes.filter(l => !checks[l.LOTE_ID]);

  function copiarReporte() {
    const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    let txt = `📦 CHEQUEO DE BODEGA · ${hoy}\n`;
    txt += `✅ Encontrados: ${encontrados}/${total}\n`;
    if (faltantes.length > 0) {
      txt += `\n❌ NO encontrados (${faltantes.length}):\n`;
      faltantes.forEach(l => {
        txt += `· ${l.NOMBRE_PRODUCTO} · ${l.TALLA} · ${l.LONGITUD} · ${l.COLOR} · ${l.LOTE_ID}\n`;
      });
    } else {
      txt += `\n✅ Todo encontrado. Inventario completo.`;
    }
    navigator.clipboard.writeText(txt).then(() => alert('Reporte copiado al portapapeles ✓'));
  }

  if (!iniciado) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
        <div className="display" style={{ fontSize: 22, fontWeight: 300, marginBottom: 8 }}>
          Chequeo de bodega
        </div>
        <p style={{ color: 'var(--text-soft)', fontSize: 13, maxWidth: 360, margin: '0 auto 24px' }}>
          Se cargarán los {total} lote{total !== 1 ? 's' : ''} que el sistema marca como disponibles en bodega.
          Revisa físicamente cada uno y desmarca los que no encuentres.
        </p>
        <button className="btn btn-primary" onClick={iniciar} disabled={total === 0}>
          Iniciar chequeo
        </button>
        {total === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 12 }}>No hay lotes disponibles en bodega.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Barra de progreso */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>
            <span style={{ color: 'var(--green)', fontWeight: 500 }}>{encontrados}</span> / {total} encontrados
          </span>
          {faltantes.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--rose)', fontWeight: 500 }}>
              {faltantes.length} faltante{faltantes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(encontrados / total) * 100}%`,
            background: faltantes.length > 0 ? 'var(--amber)' : 'var(--green)',
            borderRadius: 3,
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Lista de lotes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {lotes.map(l => {
          const ok = checks[l.LOTE_ID] !== false;
          return (
            <div
              key={l.LOTE_ID}
              onClick={() => toggle(l.LOTE_ID)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                background: ok ? 'var(--surface)' : 'var(--rose-bg)',
                border: `1px solid ${ok ? 'var(--border)' : 'var(--rose)'}`,
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                opacity: ok ? 1 : 0.75,
              }}
            >
              {/* Checkbox visual */}
              <div style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                border: `2px solid ${ok ? 'var(--green)' : 'var(--rose)'}`,
                background: ok ? 'var(--green)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 13,
                color: 'white',
                transition: 'all 0.15s ease',
              }}>
                {ok ? '✓' : ''}
              </div>

              {/* Info del lote */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 14, marginBottom: 2, textDecoration: ok ? 'none' : 'line-through', color: ok ? 'var(--text)' : 'var(--text-soft)' }}>
                  {l.NOMBRE_PRODUCTO}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                  {l.TALLA} · {l.LONGITUD} · {l.COLOR}
                  {l.CANT_DISPONIBLE > 1 && <span style={{ color: 'var(--gold)', fontWeight: 500 }}> · ×{l.CANT_DISPONIBLE}</span>}
                </div>
              </div>

              {/* Tipo y estado */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {l.TIPO_PRENDA || 'Pieza'}
                </div>
                <div style={{ fontSize: 11, marginTop: 2, color: ok ? 'var(--green)' : 'var(--rose)', fontWeight: 500 }}>
                  {ok ? '✓ OK' : '✗ No encontrado'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen de faltantes */}
      {faltantes.length > 0 && (
        <div style={{ padding: 16, background: 'var(--rose-bg)', border: '1px solid var(--rose)', borderRadius: 6, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--rose)', fontWeight: 600, marginBottom: 8 }}>
            ❌ No encontrados ({faltantes.length})
          </div>
          {faltantes.map(l => (
            <div key={l.LOTE_ID} style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4 }}>
              · {l.NOMBRE_PRODUCTO} · {l.TALLA} · {l.COLOR} · <span className="mono" style={{ fontSize: 11 }}>{l.LOTE_ID}</span>
            </div>
          ))}
        </div>
      )}

      {encontrados === total && (
        <div style={{ padding: 16, background: 'rgba(74,163,110,0.08)', border: '1px solid var(--green)', borderRadius: 6, marginBottom: 16, fontSize: 13, color: 'var(--green)', textAlign: 'center' }}>
          ✅ Todo encontrado — inventario completo
        </div>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" onClick={reset} style={{ flex: 1, justifyContent: 'center' }}>
          Reiniciar chequeo
        </button>
        <button className="btn btn-primary" onClick={copiarReporte} style={{ flex: 1, justifyContent: 'center' }}>
          📋 Copiar reporte para Freddy
        </button>
      </div>
    </div>
  );
}

function FilaMaterial({
  item, tabla, saving, onSave
}: {
  item: Material;
  tabla: 'empaque' | 'regalos';
  saving: boolean;
  onSave: (tabla: 'empaque' | 'regalos', id: string, cantidad: number) => void;
}) {
  const [local, setLocal] = useState(String(item.STOCK));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(String(item.STOCK)); }, [item.STOCK]);

  function commit() {
    const n = Number(local);
    if (!isNaN(n) && n >= 0 && n !== item.STOCK) onSave(tabla, item.ID, n);
  }

  const bajo = item.STOCK <= item.STOCK_MINIMO;
  const agotado = item.STOCK === 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: agotado ? 'var(--rose-bg)' : bajo ? 'rgba(245,158,11,0.06)' : 'var(--surface)',
      border: `1px solid ${agotado ? 'var(--rose)' : bajo ? 'var(--amber)' : 'var(--border)'}`,
      borderRadius: 6,
    }}>
      {/* Alerta */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: agotado ? 'var(--rose)' : bajo ? 'var(--amber)' : 'var(--green)' }} />

      {/* Nombre */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: agotado ? 500 : 400 }}>
          {item.NOMBRE}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
          {item.ID} · mín {item.STOCK_MINIMO}
          {agotado && <span style={{ color: 'var(--rose)', fontWeight: 600 }}> · AGOTADO</span>}
          {!agotado && bajo && <span style={{ color: 'var(--amber)', fontWeight: 500 }}> · stock bajo</span>}
        </div>
      </div>

      {/* Campo de stock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Stock:</span>
        <input
          ref={ref}
          type="number"
          min={0}
          value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { commit(); ref.current?.blur(); } }}
          disabled={saving}
          style={{
            width: 60,
            padding: '4px 8px',
            fontSize: 13,
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: saving ? 'var(--surface)' : 'var(--bg)',
            color: 'var(--text)',
            textAlign: 'center',
            opacity: saving ? 0.5 : 1,
          }}
        />
      </div>
    </div>
  );
}

// ===== FOTO TEMPORAL (solo en memoria, nunca se guarda) =====
// Al elegir un archivo, se crea una URL local (URL.createObjectURL) que solo
// vive en esta pestaña del navegador. Si recargas la página, se pierde.
function FotoUpload({
  id, url, onChange,
}: {
  id: string;
  url: string | undefined;
  onChange: (id: string, url: string) => void;
}) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(id, URL.createObjectURL(file));
  }

  if (url) {
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={url}
          alt=""
          style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
        />
        <label
          className="print-hide"
          title="Cambiar foto"
          style={{
            position: 'absolute', bottom: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
            background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer',
          }}
        >
          ✎
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      </div>
    );
  }

  return (
    <label
      className="print-hide"
      title="Subir foto (solo para esta sesión, no se guarda)"
      style={{
        width: 96, height: 96, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
        border: '1.5px dashed var(--border)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text-faint)',
      }}
    >
      <span style={{ fontSize: 20 }}>📷</span>
      <span style={{ fontSize: 10 }}>Foto</span>
      <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </label>
  );
}

export default function StockPage() {
  const router = useRouter();
  const [lotes, setLotes] = useState<LoteStock[]>([]);
  const [enCamino, setEnCamino] = useState<LoteEnCamino[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  // Fotos temporales por tarjeta (clave = LOTE_ID o COMBO_ID) — solo viven en
  // memoria del navegador, nunca se guardan. Se pierden si recargas la página.
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [borrarLoteId, setBorrarLoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [materiales, setMateriales] = useState<{ empaque: Material[]; regalos: Material[] }>({ empaque: [], regalos: [] });
  const [savingMaterial, setSavingMaterial] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [mostrarFormPin, setMostrarFormPin] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCategoria, setNuevoCategoria] = useState('General');
  const [nuevaCantidad, setNuevaCantidad] = useState('0');
  const [savingPin, setSavingPin] = useState(false);
  const [tab, setTab] = useState<'inventario' | 'chequeo' | 'materiales'>('inventario');

  // Armador de sets
  const [selSuperior, setSelSuperior] = useState('');
  const [selInferior, setSelInferior] = useState('');
  const [savingCombo, setSavingCombo] = useState(false);
  const [deletingCombo, setDeletingCombo] = useState('');

  // Acciones admin (lotes en camino)
  const [working, setWorking] = useState('');
  const [despacharId, setDespacharId] = useState('');
  const [despCourier, setDespCourier] = useState('');
  const [despFecha, setDespFecha] = useState('');
  const [fechaHoy, setFechaHoy] = useState('');

  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const user = auth.getUser();
    if (!user) { router.replace('/login'); return; }
    setIsAdmin(user.rol === 'admin');
    // Se calcula aquí (solo en el navegador) para evitar un mismatch de
    // hydration entre el servidor (UTC) y el cliente (Ecuador) — se
    // muestra en el header ("...· 11 de agosto de 2026").
    setFechaHoy(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [disp, camino, cours, combs, mats] = await Promise.all([
        api.getStockDisponible(),
        api.getLotesEnCamino(),
        api.getCouriers().catch(() => [] as Courier[]),
        api.getCombos().catch(() => [] as Combo[]),
        api.getMateriales().catch(() => ({ empaque: [], regalos: [] })),
      ]);
      setLotes(disp);
      setEnCamino(camino);
      setCouriers(cours);
      setCombos(combs);
      setMateriales(mats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  async function handleStockMaterial(tabla: 'empaque' | 'regalos', id: string, cantidad: number) {
    const user = auth.getUser();
    if (!user) return;
    setSavingMaterial(id);
    try {
      await api.setStockMaterial(tabla, id, cantidad, user.usuario);
      setMateriales(prev => ({
        ...prev,
        [tabla]: prev[tabla].map(m => m.ID === id ? { ...m, STOCK: cantidad } : m)
      }));
    } catch (err) {
      alert('Error al guardar: ' + (err instanceof Error ? err.message : err));
    } finally {
      setSavingMaterial('');
    }
  }

  async function handleAgregarPin() {
    const user = auth.getUser();
    if (!user) return;
    if (!nuevoNombre.trim()) { alert('Escribe el nombre del pin'); return; }
    setSavingPin(true);
    try {
      const resultado = await api.agregarPin(
        { nombre: nuevoNombre.trim(), categoria: nuevoCategoria, cantidad: Number(nuevaCantidad) || 0 },
        user.usuario
      );
      setMateriales(prev => ({
        ...prev,
        regalos: [...prev.regalos, {
          ID: resultado.id, NOMBRE: resultado.nombre,
          CATEGORIA: resultado.categoria, STOCK: resultado.cantidad,
          STOCK_MINIMO: 1, COSTO: resultado.costo
        }]
      }));
      setNuevoNombre('');
      setNuevaCantidad('0');
      setNuevoCategoria('General');
      setMostrarFormPin(false);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : err));
    } finally {
      setSavingPin(false);
    }
  }

  async function handleSetColor(color: string, hex: string) {
    const user = auth.getUser();
    if (!user) return;
    await api.setColor(color, hex, user.usuario);
    // Refleja el nuevo hex en todos los lotes de ese color, sin recargar
    setLotes(prev => prev.map(l =>
      String(l.COLOR || '').toUpperCase().trim() === color.toUpperCase().trim()
        ? { ...l, COLOR_HEX: hex } : l
    ));
    setEnCamino(prev => prev.map(l =>
      String(l.COLOR || '').toUpperCase().trim() === color.toUpperCase().trim()
        ? { ...l, COLOR_HEX: hex } : l
    ));
  }
  
  const couriersActivos = couriers.filter(c => {
    const a = String(c.ACTIVA).toUpperCase().trim();
    return a !== 'FALSE' && a !== 'NO' && a !== '0';
  });

  const lotesEnCombos = new Set<string>();
  combos.forEach(c => {
    lotesEnCombos.add(c.superior.LOTE_ID);
    lotesEnCombos.add(c.inferior.LOTE_ID);
  });

  const lotesLibres = lotes.filter(l => !lotesEnCombos.has(l.LOTE_ID) && !l.enCamino);
  const caminoLibres = enCamino.filter(l => !lotesEnCombos.has(l.LOTE_ID));

  type OpcionPieza = { LOTE_ID: string; NOMBRE_PRODUCTO: string; TIPO_PRENDA: string; TALLA: string; LONGITUD: string; COLOR: string; enCamino: boolean };
  // OJO: "lotes" (de getStockDisponible) YA incluye tanto lo llegado como lo
  // en camino, cada uno marcado con su bandera .enCamino — por eso NO se
  // combina aquí con el estado "enCamino" (ese es de getLotesEnCamino, una
  // llamada aparte para la sección de despacho). Combinarlos duplicaba cada
  // prenda en camino en este selector.
  const piezasParaArmar: OpcionPieza[] = lotes
    .filter(l => !lotesEnCombos.has(l.LOTE_ID))
    .map(l => ({ LOTE_ID: l.LOTE_ID, NOMBRE_PRODUCTO: l.NOMBRE_PRODUCTO, TIPO_PRENDA: l.TIPO_PRENDA, TALLA: l.TALLA, LONGITUD: l.LONGITUD, COLOR: l.COLOR, enCamino: !!l.enCamino }));

  const superiores = piezasParaArmar.filter(p => ['TOP', 'CAMISA'].includes(String(p.TIPO_PRENDA || '').toUpperCase()));
  const inferiores = piezasParaArmar.filter(p => String(p.TIPO_PRENDA || '').toUpperCase() === 'PANTALON');
  const piezaSup = piezasParaArmar.find(p => p.LOTE_ID === selSuperior);
  const piezaInf = piezasParaArmar.find(p => p.LOTE_ID === selInferior);

  function etiquetaOpcion(p: OpcionPieza) {
    return `${p.NOMBRE_PRODUCTO} · ${p.TALLA} · ${p.COLOR}${p.enCamino ? ' · 🚚 en camino' : ''}`;
  }

  async function guardarCombo() {
    if (!selSuperior || !selInferior) { alert('Elige una pieza superior y una inferior'); return; }
    const user = auth.getUser();
    if (!user) return;
    setSavingCombo(true);
    try {
      await api.crearCombo(selSuperior, selInferior, user.usuario);
      setSelSuperior('');
      setSelInferior('');
      await load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSavingCombo(false);
    }
  }

  async function borrarComboFn(comboId: string) {
    if (!confirm('¿Borrar este conjunto guardado?')) return;
    const user = auth.getUser();
    if (!user) return;
    setDeletingCombo(comboId);
    try {
      await api.borrarCombo(comboId, user.usuario);
      await load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setDeletingCombo('');
    }
  }

  async function doAccion(loteId: string, accion: 'LLEGO_FL' | 'DESPACHAR_EC' | 'LLEGO_EC', courier = '', fechaSalida = '') {
    const user = auth.getUser();
    if (!user) return;
    setWorking(loteId);
    try {
      await api.avanzarLote({ loteId, accion, courier, fechaSalida }, user.usuario);
      setDespacharId('');
      await load();
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setWorking('');
    }
  }

  function openDespachar(loteId: string) {
    setDespacharId(loteId);
    setDespFecha(todayISO);
    setDespCourier(couriersActivos.length > 0 ? couriersActivos[0].COURIER : '');
  }

  function setFoto(id: string, url: string) {
    setFotos(prev => ({ ...prev, [id]: url }));
  }

  async function handleBorrarLote(loteId: string, nombre: string) {
    const user = auth.getUser();
    if (!user) return;
    const ok = confirm(
      `¿Borrar "${nombre}" (${loteId}) del inventario?\n\n` +
      `Esto también revierte (borra) el costo de compra + courier registrado para este lote — ` +
      `como si esa plata nunca se hubiera gastado en los reportes.\n\n` +
      `⚠️ Esto NO mete plata a tu cuenta del banco automáticamente — si de verdad te devolvieron ` +
      `el dinero, regístralo aparte en TablaSaldos.\n\n¿Continuar?`
    );
    if (!ok) return;
    setBorrarLoteId(loteId);
    try {
      const res = await api.borrarLoteStock(loteId, user.usuario);
      alert(`✅ Borrado — se revirtieron $${res.montoRevertido.toFixed(2)} de costos`);
      load();
    } catch (err) {
      alert('Error al borrar: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setBorrarLoteId(null);
    }
  }

  function confirmDespachar(loteId: string) {
    if (!despCourier) { alert('Elige un courier'); return; }
    if (!despFecha) { alert('Elige la fecha de salida'); return; }
    doAccion(loteId, 'DESPACHAR_EC', despCourier, despFecha);
  }

  const totalPiezas = lotesLibres.reduce((s, l) => s + l.CANT_DISPONIBLE, 0);
  const totalCamino = caminoLibres.reduce((s, l) => s + l.CANT_DISPONIBLE, 0);

  return (
    <>
      <Navbar />
      <div className="fade-in stock-container" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        
        {/* HEADER */}
        <div className="stock-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <span className="number-tag">INVENTARIO</span>
            <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
              Stock<em style={{ color: 'var(--gold)' }}>.</em>
            </h1>
            <p style={{ color: 'var(--text-soft)', margin: '8px 0 0', fontSize: 13 }}>
              {totalPiezas} suelto{totalPiezas !== 1 ? 's' : ''} · {totalCamino} en camino · {combos.length} conjunto{combos.length !== 1 ? 's' : ''} · {fechaHoy}
            </p>
          </div>
          <div className="stock-actions" style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={load} disabled={loading}>
              {loading ? 'Cargando…' : '↻ Actualizar'}
            </button>
            {tab === 'inventario' && (
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨️ Imprimir
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: 16, background: 'var(--rose-bg)', color: 'var(--rose)', borderRadius: 6, marginBottom: 24, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* TABS */}
        <div className="print-hide" style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {([
          { key: 'inventario', label: '📦 Inventario' },
          { key: 'chequeo',    label: '✅ Chequeo de bodega' },
          { key: 'materiales', label: '🧴 Materiales' },
        ] as { key: 'inventario' | 'chequeo' | 'materiales'; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                background: 'transparent',
                color: tab === t.key ? 'var(--text)' : 'var(--text-soft)',
                cursor: 'pointer',
                fontWeight: tab === t.key ? 500 : 400,
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-faint)' }}>Cargando inventario…</div>
        ) : (
          <>
            {/* ===== TAB: CHEQUEO ===== */}
            {tab === 'chequeo' && (
              <ChecklistAuditoria lotes={lotes} />
            )}

            {/* ===== TAB: MATERIALES ===== */}
            {tab === 'materiales' && (
              <div>
                {/* Resumen alertas */}
                {(() => {
                  const agotados = [...materiales.empaque, ...materiales.regalos].filter(m => m.STOCK === 0).length;
                  const bajos    = [...materiales.empaque, ...materiales.regalos].filter(m => m.STOCK > 0 && m.STOCK <= m.STOCK_MINIMO).length;
                  if (agotados === 0 && bajos === 0) return null;
                  return (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                      {agotados > 0 && (
                        <div style={{ padding: '10px 16px', background: 'var(--rose-bg)', border: '1px solid var(--rose)', borderRadius: 6, fontSize: 13, color: 'var(--rose)', fontWeight: 500 }}>
                          ❌ {agotados} agotado{agotados !== 1 ? 's' : ''}
                        </div>
                      )}
                      {bajos > 0 && (
                        <div style={{ padding: '10px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid var(--amber)', borderRadius: 6, fontSize: 13, color: 'var(--amber)', fontWeight: 500 }}>
                          ⚠️ {bajos} con stock bajo
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Filtro categoría pines */}
                {materiales.regalos.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filtrar pines:</span>
                    {['todas', ...Array.from(new Set(materiales.regalos.map(r => r.CATEGORIA)))].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFiltroCategoria(cat)}
                        style={{
                          padding: '4px 12px', fontSize: 12, borderRadius: 20,
                          border: `1px solid ${filtroCategoria === cat ? 'var(--gold)' : 'var(--border)'}`,
                          background: filtroCategoria === cat ? 'rgba(184,149,78,0.1)' : 'var(--surface)',
                          color: filtroCategoria === cat ? 'var(--gold)' : 'var(--text-soft)',
                          cursor: 'pointer',
                        }}
                      >
                        {cat === 'todas' ? 'Todas' : cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Materiales de empaque */}
                <h3 style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                  Materiales de empaque · <span className="tabular">{materiales.empaque.length}</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                  {materiales.empaque.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-faint)', fontSize: 13 }}>
                      No hay materiales de empaque registrados.
                    </div>
                  ) : (
                    materiales.empaque.map(m => (
                      <FilaMaterial
                        key={m.ID}
                        item={m}
                        tabla="empaque"
                        saving={savingMaterial === m.ID}
                        onSave={handleStockMaterial}
                      />
                    ))
                  )}
                </div>

                {/* Pines y regalos */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                    Pines y regalos · <span className="tabular">{materiales.regalos.filter(r => filtroCategoria === 'todas' || r.CATEGORIA === filtroCategoria).length}</span>
                  </h3>
                  <button className="btn" onClick={() => setMostrarFormPin(v => !v)} style={{ padding: '4px 12px', fontSize: 12 }}>
                    {mostrarFormPin ? 'Cancelar' : '+ Nuevo pin'}
                  </button>
                </div>

                {mostrarFormPin && (
                  <div style={{ padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', fontWeight: 500 }}>Agregar nuevo pin</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Nombre</label>
                        <input
                          className="input"
                          value={nuevoNombre}
                          onChange={e => setNuevoNombre(e.target.value)}
                          placeholder="Ej: Diente con corazón"
                          style={{ marginTop: 4, fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Categoría</label>
                        <select className="input" value={nuevoCategoria} onChange={e => setNuevoCategoria(e.target.value)} style={{ marginTop: 4, fontSize: 13 }}>
                          {Array.from(new Set(['General', ...materiales.regalos.map(r => r.CATEGORIA)])).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Cantidad</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={nuevaCantidad}
                          onChange={e => setNuevaCantidad(e.target.value)}
                          style={{ marginTop: 4, fontSize: 13 }}
                        />
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={handleAgregarPin} disabled={savingPin || !nuevoNombre.trim()} style={{ alignSelf: 'flex-end', padding: '6px 16px', fontSize: 13 }}>
                      {savingPin ? 'Guardando…' : 'Guardar pin'}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {materiales.regalos
                    .filter(r => filtroCategoria === 'todas' || r.CATEGORIA === filtroCategoria)
                    .map(m => (
                      <FilaMaterial
                        key={m.ID}
                        item={m}
                        tabla="regalos"
                        saving={savingMaterial === m.ID}
                        onSave={handleStockMaterial}
                      />
                    ))
                  }
                </div>

                <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-faint)' }}>
                  Escribe la cantidad real y presiona Enter o haz clic fuera para guardar.
                </div>
              </div>
            )}
            

            {/* ===== TAB: INVENTARIO ===== */}
            {tab === 'inventario' && (
              <>
                {/* ARMADOR DE SETS */}
                {piezasParaArmar.length > 0 && (
                  <div className="card print-hide" style={{ padding: 24, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                      🧩 Armar un set
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 16px' }}>
                      Combina una pieza superior con una inferior y guárdalo. Puedes usar piezas disponibles o en camino.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Pieza superior (top / camisa)</label>
                        <select className="input" value={selSuperior} onChange={(e) => setSelSuperior(e.target.value)} style={{ marginTop: 4 }}>
                          <option value="">— Elegir —</option>
                          {superiores.map(p => (
                            <option key={p.LOTE_ID} value={p.LOTE_ID}>{etiquetaOpcion(p)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Pieza inferior (pantalón)</label>
                        <select className="input" value={selInferior} onChange={(e) => setSelInferior(e.target.value)} style={{ marginTop: 4 }}>
                          <option value="">— Elegir —</option>
                          {inferiores.map(p => (
                            <option key={p.LOTE_ID} value={p.LOTE_ID}>{etiquetaOpcion(p)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(piezaSup || piezaInf) && (
                      <div style={{ marginTop: 16, padding: 16, background: 'linear-gradient(to right, rgba(184,149,78,0.06), transparent)', border: '1px solid var(--gold)', borderRadius: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Conjunto a guardar</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            {piezaSup ? (
                              <>
                                <div className="display" style={{ fontSize: 15 }}>{piezaSup.NOMBRE_PRODUCTO} {piezaSup.enCamino ? '🚚' : ''}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{piezaSup.TALLA} · {piezaSup.LONGITUD} · {piezaSup.COLOR}</div>
                              </>
                            ) : <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>(sin pieza superior)</span>}
                          </div>
                          <div style={{ fontSize: 20, color: 'var(--gold)' }}>+</div>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            {piezaInf ? (
                              <>
                                <div className="display" style={{ fontSize: 15 }}>{piezaInf.NOMBRE_PRODUCTO} {piezaInf.enCamino ? '🚚' : ''}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{piezaInf.TALLA} · {piezaInf.LONGITUD} · {piezaInf.COLOR}</div>
                              </>
                            ) : <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>(sin pieza inferior)</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                          <button className="btn" onClick={() => { setSelSuperior(''); setSelInferior(''); }} disabled={savingCombo} style={{ padding: '6px 12px', fontSize: 12 }}>
                            Limpiar
                          </button>
                          <button className="btn btn-primary" onClick={guardarCombo} disabled={savingCombo || !selSuperior || !selInferior} style={{ padding: '6px 14px', fontSize: 12 }}>
                            {savingCombo ? 'Guardando…' : 'Guardar conjunto'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CONJUNTOS */}
                {combos.length > 0 && (
                  <>
                    <h3 style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                      Conjuntos · <span className="tabular">{combos.length}</span>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 28 }}>
                      {combos.map(c => {
                        const eta = fmtEta(c.eta);
                        const hexSup = c.superior.COLOR_HEX || '';
                        const hexInf = c.inferior.COLOR_HEX || '';
                        const mismoColor = String(c.superior.COLOR || '').toUpperCase().trim() === String(c.inferior.COLOR || '').toUpperCase().trim();
                        return (
                          <div key={c.COMBO_ID} className="card" style={{ padding: 16, position: 'relative', borderColor: c.enCamino ? 'var(--amber)' : undefined }}>
                            <button
                              className="btn print-hide"
                              onClick={() => borrarComboFn(c.COMBO_ID)}
                              disabled={deletingCombo === c.COMBO_ID}
                              title="Borrar conjunto"
                              style={{ position: 'absolute', top: 10, right: 10, padding: '3px 8px', fontSize: 11, color: 'var(--rose)' }}
                            >
                              {deletingCombo === c.COMBO_ID ? '…' : '✕'}
                            </button>

                            {/* Foto (izquierda) + info (derecha) */}
                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                              <FotoUpload id={c.COMBO_ID} url={fotos[c.COMBO_ID]} onChange={setFoto} />
                              <div style={{ flex: 1, minWidth: 0 }}>

                            {/* Cabecera con los colores del conjunto */}
                            <div style={{
                              fontSize: 10,
                              color: c.enCamino ? 'var(--amber)' : 'var(--gold)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              marginBottom: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}>
                              <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
                                <span style={{
                                  width: 12, height: 12, borderRadius: 3, display: 'inline-block',
                                  background: hexSup || '#DDDDD8',
                                  border: '1px solid rgba(0,0,0,0.2)',
                                }} />
                                {!mismoColor && (
                                  <span style={{
                                    width: 12, height: 12, borderRadius: 3, display: 'inline-block',
                                    background: hexInf || '#DDDDD8',
                                    border: '1px solid rgba(0,0,0,0.2)',
                                  }} />
                                )}
                              </span>
                              <span>
                                {c.enCamino ? `🚚 En camino${eta ? ` · llega ${eta}` : ''}` : 'Conjunto · listo'}
                              </span>
                            </div>

                            {[c.superior, c.inferior].map((p, i) => {
                              const estado = String(p.ESTADO_VIAJE || '').toUpperCase();
                              const enDespacho = despacharId === p.LOTE_ID;
                              return (
                                <div key={p.LOTE_ID} style={{ marginBottom: i === 0 ? 8 : 0 }}>
                                  {i === 1 && <div style={{ fontSize: 13, color: c.enCamino ? 'var(--amber)' : 'var(--gold)', margin: '2px 0' }}>+</div>}
                                  <div className="display" style={{ fontSize: 14 }}>{p.NOMBRE_PRODUCTO} {p.enCamino ? '🚚' : ''}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ColorSwatch color={p.COLOR} hex={p.COLOR_HEX || ''} isAdmin={isAdmin} onSave={handleSetColor} />
                                    <span>{p.TALLA} · {p.LONGITUD} · {p.COLOR}</span>
                                  </div>

                                  {p.enCamino && (
                                    <div style={{ marginTop: 6 }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: estadoColor(estado), marginBottom: isAdmin ? 6 : 0 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: estadoColor(estado) }} />
                                        {p.ESTADO_VIAJE}
                                      </span>

                                      {isAdmin && !enDespacho && (
                                        <div className="print-hide">
                                          {estado === 'EN TRANSITO A FL' && (
                                            <button className="btn" onClick={() => doAccion(p.LOTE_ID, 'LLEGO_FL')} disabled={working === p.LOTE_ID} style={{ padding: '4px 10px', fontSize: 11 }}>
                                              {working === p.LOTE_ID ? '…' : 'Llegó a FL'}
                                            </button>
                                          )}
                                          {estado === 'EN BODEGA FL' && (
                                            <button className="btn btn-primary" onClick={() => openDespachar(p.LOTE_ID)} disabled={working === p.LOTE_ID} style={{ padding: '4px 10px', fontSize: 11 }}>
                                              Despachar a EC
                                            </button>
                                          )}
                                          {estado === 'EN CAMINO A EC' && (
                                            <button className="btn" onClick={() => doAccion(p.LOTE_ID, 'LLEGO_EC')} disabled={working === p.LOTE_ID} style={{ padding: '4px 10px', fontSize: 11 }}>
                                              {working === p.LOTE_ID ? '…' : 'Llegó a EC'}
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {isAdmin && enDespacho && (
                                        <div className="print-hide" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, padding: 10, background: 'var(--bg)', borderRadius: 4 }}>
                                          <div>
                                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Courier</label>
                                            <select className="input" value={despCourier} onChange={(e) => setDespCourier(e.target.value)} style={{ marginTop: 2, padding: '5px 8px', fontSize: 12 }}>
                                              {couriersActivos.length === 0 && <option value="">(sin couriers)</option>}
                                              {couriersActivos.map(co => <option key={co.COURIER} value={co.COURIER}>{co.COURIER}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha de salida</label>
                                            <input type="date" className="input" value={despFecha} onChange={(e) => setDespFecha(e.target.value)} style={{ marginTop: 2, padding: '5px 8px', fontSize: 12 }} />
                                          </div>
                                          <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn" onClick={() => setDespacharId('')} disabled={working === p.LOTE_ID} style={{ flex: 1, justifyContent: 'center', padding: '5px 8px', fontSize: 11 }}>
                                              Cancelar
                                            </button>
                                            <button className="btn btn-primary" onClick={() => confirmDespachar(p.LOTE_ID)} disabled={working === p.LOTE_ID} style={{ flex: 1, justifyContent: 'center', padding: '5px 8px', fontSize: 11 }}>
                                              {working === p.LOTE_ID ? '…' : 'Confirmar'}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* DISPONIBLE SUELTO */}
                <h3 style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                  Disponible suelto · <span className="tabular">{totalPiezas}</span>
                </h3>
                {lotesLibres.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)', marginBottom: 28 }}>
                    No hay piezas sueltas disponibles.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 28 }}>
                    {lotesLibres.map(l => (
                      <div key={l.LOTE_ID} className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', borderColor: !l.tieneCourier ? 'var(--amber)' : undefined }}>
                        <FotoUpload id={l.LOTE_ID} url={fotos[l.LOTE_ID]} onChange={setFoto} />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l.TIPO_PRENDA || 'Pieza'}</span>
                            <span className="tabular" style={{ fontSize: 13, fontWeight: 500 }}>
                              {l.CANT_DISPONIBLE > 1 ? `×${l.CANT_DISPONIBLE}` : ''}
                              {!l.tieneCourier && <span title="Sin courier cargado todavía" style={{ marginLeft: 6, color: 'var(--amber)' }}>⚠</span>}
                            </span>
                          </div>
                          <div className="display" style={{ fontSize: 15, marginBottom: 3 }}>{l.NOMBRE_PRODUCTO}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ColorSwatch color={l.COLOR} hex={l.COLOR_HEX || ''} isAdmin={isAdmin} onSave={handleSetColor} />
                            <span><span className="mono">{l.TALLA}</span> · {l.LONGITUD} · {l.COLOR}</span>
                          </div>
                          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
                            <span>{fmtDate(l.FECHA_ENTRADA)}</span>
                            {isAdmin && <span className="mono print-hide">{l.LOTE_ID}</span>}
                          </div>
                          {isAdmin && (
                            <div className="tabular print-hide" style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 4, textAlign: 'right' }}>
                              {fmtMoney(l.COSTO_UNITARIO)}
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            className="print-hide"
                            onClick={() => handleBorrarLote(l.LOTE_ID, l.NOMBRE_PRODUCTO)}
                            disabled={borrarLoteId === l.LOTE_ID}
                            title="Borrar del inventario y revertir su costo (devolución)"
                            style={{
                              flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-faint)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                              opacity: borrarLoteId === l.LOTE_ID ? 0.5 : 1,
                            }}
                          >
                            {borrarLoteId === l.LOTE_ID ? '…' : '✕'}
                          </button>
                        )}
                      </div>

                    ))}
                  </div>
                )}

                {/* EN CAMINO SUELTO */}
                <h3 className="print-hide" style={{ margin: '0 0 12px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }}>
                  🚚 En camino suelto · <span className="tabular">{totalCamino}</span>
                </h3>
                {caminoLibres.length === 0 ? (
                  <div className="card print-hide" style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>
                    Nada suelto en camino por ahora.
                  </div>
                ) : (
                  <div className="print-hide" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    {caminoLibres.map(l => {
                      const estado = String(l.ESTADO_VIAJE || '').toUpperCase();
                      const eta = fmtEta(l.eta);
                      const enDespacho = despacharId === l.LOTE_ID;
                      return (
                        <div key={l.LOTE_ID} className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', borderColor: estadoColor(estado) }}>
                          <FotoUpload id={l.LOTE_ID} url={fotos[l.LOTE_ID]} onChange={setFoto} />
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: estadoColor(estado), textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: estadoColor(estado) }} />
                            🚚 {l.ESTADO_VIAJE}
                          </div>
                          <div className="display" style={{ fontSize: 15, marginBottom: 3 }}>{l.NOMBRE_PRODUCTO}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ColorSwatch color={l.COLOR} hex={(l as any).COLOR_HEX || ''} isAdmin={isAdmin} onSave={handleSetColor} />
                            <span><span className="mono">{l.TALLA}</span> · {l.LONGITUD} · {l.COLOR}{l.CANT_DISPONIBLE > 1 ? ` · ×${l.CANT_DISPONIBLE}` : ''}</span>
                          </div>
                          <div style={{ fontSize: 12, marginBottom: 10 }}>
                            {eta ? (
                              <span className="tabular" style={{ color: 'var(--gold)', fontWeight: 500 }}>Llega {eta}</span>
                            ) : (
                              <span style={{ color: 'var(--text-faint)' }}>Por despachar</span>
                            )}
                          </div>
                          {isAdmin && (
                            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>
                              <span className="mono">{l.LOTE_ID}</span>
                              {l.TRACKING ? <> · {l.TRANSPORTE || ''} {l.TRACKING}</> : ''}
                              {' · '}<span className="tabular">{fmtMoney(l.COSTO_UNITARIO)}</span>
                            </div>
                          )}
                          {isAdmin && (
                            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                              {estado === 'EN TRANSITO A FL' && (
                                <button className="btn" onClick={() => doAccion(l.LOTE_ID, 'LLEGO_FL')} disabled={working === l.LOTE_ID} style={{ width: '100%', justifyContent: 'center', padding: '7px 10px', fontSize: 12 }}>
                                  {working === l.LOTE_ID ? '…' : 'Llegó a FL'}
                                </button>
                              )}
                              {estado === 'EN BODEGA FL' && !enDespacho && (
                                <button className="btn btn-primary" onClick={() => openDespachar(l.LOTE_ID)} disabled={working === l.LOTE_ID} style={{ width: '100%', justifyContent: 'center', padding: '7px 10px', fontSize: 12 }}>
                                  Despachar a EC
                                </button>
                              )}
                              {estado === 'EN CAMINO A EC' && (
                                <button className="btn" onClick={() => doAccion(l.LOTE_ID, 'LLEGO_EC')} disabled={working === l.LOTE_ID} style={{ width: '100%', justifyContent: 'center', padding: '7px 10px', fontSize: 12 }}>
                                  {working === l.LOTE_ID ? '…' : 'Llegó a EC'}
                                </button>
                              )}
                              {enDespacho && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                  <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Courier</label>
                                    <select className="input" value={despCourier} onChange={(e) => setDespCourier(e.target.value)} style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }}>
                                      {couriersActivos.length === 0 && <option value="">(sin couriers)</option>}
                                      {couriersActivos.map(c => <option key={c.COURIER} value={c.COURIER}>{c.COURIER}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>Fecha de salida</label>
                                    <input type="date" className="input" value={despFecha} onChange={(e) => setDespFecha(e.target.value)} style={{ marginTop: 2, padding: '6px 10px', fontSize: 13 }} />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn" onClick={() => setDespacharId('')} disabled={working === l.LOTE_ID} style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: 12 }}>
                                      Cancelar
                                    </button>
                                    <button className="btn btn-primary" onClick={() => confirmDespachar(l.LOTE_ID)} disabled={working === l.LOTE_ID} style={{ flex: 1, justifyContent: 'center', padding: '6px 10px', fontSize: 12 }}>
                                      {working === l.LOTE_ID ? '…' : 'Confirmar'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="print-hide" style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)' }}>
          ⚠ = lote disponible sin courier cargado · Las piezas que están en un conjunto no aparecen en las listas sueltas.
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .navbar, header, .print-hide, .stock-actions { display: none !important; }
          .stock-container { max-width: 100% !important; padding: 12px !important; }
          .card { border: 1px solid #ccc !important; box-shadow: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </>
  );
}
