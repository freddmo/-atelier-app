'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Usuario } from '@/lib/types';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Usuario | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [costosOpen, setCostosOpen] = useState(false);
  const costosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(auth.getUser());
  }, []);

  // Cerrar dropdown al click afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (costosRef.current && !costosRef.current.contains(e.target as Node)) {
        setCostosOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;
  const isAdmin = user.rol === 'admin';

  function logout() {
    if (confirm('¿Cerrar sesión?')) {
      auth.clear();
      router.push('/login');
    }
  }

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  const isCostosActive = pathname.startsWith('/cargar-factura') || pathname.startsWith('/cargar-courier') || pathname.startsWith('/asignar-stock');

  const initials = user.nombre.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div onClick={() => router.push('/pedidos')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="display" style={{ fontSize: 22, fontWeight: 400 }}>Atelier</span>
            <span className="number-tag hide-mobile">N°01</span>
          </div>
          <nav className="hide-mobile" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <button className={`nav-link ${isActive('/pedidos') ? 'active' : ''}`} onClick={() => router.push('/pedidos')}>Pedidos</button>
            <button className={`nav-link ${isActive('/stock') ? 'active' : ''}`} onClick={() => router.push('/stock')}>Stock</button>
            {isAdmin && (
              <button className={`nav-link ${isActive('/nuevo-pedido') ? 'active' : ''}`} onClick={() => router.push('/nuevo-pedido')}>Nuevo pedido</button>
            )}
            {isAdmin && (
              <button className={`nav-link ${isActive('/reportes') ? 'active' : ''}`} onClick={() => router.push('/reportes')}>Reportes</button>
            )}
            {isAdmin && (
              <button className={`nav-link ${isActive('/finanzas') ? 'active' : ''}`} onClick={() => router.push('/finanzas')}>Finanzas</button>
            )}
            {isAdmin && (
              <div ref={costosRef} style={{ position: 'relative' }}>
                <button
                  className={`nav-link ${isCostosActive ? 'active' : ''}`}
                  onClick={() => setCostosOpen(!costosOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Costos
                  <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                </button>
                {costosOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 8,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    minWidth: 200,
                    overflow: 'hidden',
                    zIndex: 50,
                  }}>
                    <div
                      onClick={() => { router.push('/cargar-factura'); setCostosOpen(false); }}
                      style={{ padding: '12px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 500 }}>📄 Cargar factura FIGS</span>
                      <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>Distribuir BRUTO + IVA</span>
                    </div>
                    <div
                      onClick={() => { router.push('/cargar-courier'); setCostosOpen(false); }}
                      style={{ padding: '12px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 500 }}>📦 Cargar envío courier</span>
                      <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>Distribuir costo de envío</span>
                    </div>
                    <div
                      onClick={() => { router.push('/asignar-stock'); setCostosOpen(false); }}
                      style={{ padding: '12px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid var(--border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontWeight: 500 }}>📦 Asignar stock</span>
                      <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>Vender desde inventario</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button className={`nav-link ${isActive('/colores') ? 'active' : ''}`} onClick={() => router.push('/colores')}>Colores</button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={logout} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: isAdmin ? 'var(--text)' : 'var(--blue)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500 }}>
              {initials}
            </div>
            <span className="hide-mobile" style={{ fontSize: 13 }}>{user.nombre}</span>
          </div>
          <button className="btn show-mobile" style={{ padding: '6px 10px' }} onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
        </div>
      </div>

      {mobileOpen && (
        <div className="show-mobile" style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button className={`nav-link ${isActive('/pedidos') ? 'active' : ''}`} onClick={() => { router.push('/pedidos'); setMobileOpen(false); }}>Pedidos</button>
            <button className={`nav-link ${isActive('/stock') ? 'active' : ''}`} onClick={() => { router.push('/stock'); setMobileOpen(false); }}>Stock</button>
            {isAdmin && (
              <button className={`nav-link ${isActive('/nuevo-pedido') ? 'active' : ''}`} onClick={() => { router.push('/nuevo-pedido'); setMobileOpen(false); }}>Nuevo pedido</button>
            )}
            {isAdmin && (
              <button className={`nav-link ${isActive('/reportes') ? 'active' : ''}`} onClick={() => { router.push('/reportes'); setMobileOpen(false); }}>Reportes</button>
            )}
            {isAdmin && (
              <button className={`nav-link ${isActive('/finanzas') ? 'active' : ''}`} onClick={() => { router.push('/finanzas'); setMobileOpen(false); }}>Finanzas</button>
            )}
            {isAdmin && (
              <button className={`nav-link ${isActive('/cargar-factura') ? 'active' : ''}`} onClick={() => { router.push('/cargar-factura'); setMobileOpen(false); }}>📄 Cargar factura FIGS</button>
            )}
            {isAdmin && (
              <button className={`nav-link ${isActive('/cargar-courier') ? 'active' : ''}`} onClick={() => { router.push('/cargar-courier'); setMobileOpen(false); }}>📦 Cargar envío courier</button>
            )}
            {isAdmin && (
              <button className={`nav-link ${isActive('/asignar-stock') ? 'active' : ''}`} onClick={() => { router.push('/asignar-stock'); setMobileOpen(false); }}>📦 Asignar stock</button>
            )}
            <button className={`nav-link ${isActive('/colores') ? 'active' : ''}`} onClick={() => { router.push('/colores'); setMobileOpen(false); }}>Catálogo de colores</button>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
            <button className="nav-link" onClick={logout} style={{ color: 'var(--rose)' }}>Cerrar sesión</button>
          </div>
        </div>
      )}
    </header>
  );
}
