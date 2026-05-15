'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Usuario } from '@/lib/types';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Usuario | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setUser(auth.getUser());
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

  const initials = user.nombre.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div onClick={() => router.push('/pedidos')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="display" style={{ fontSize: 22, fontWeight: 400 }}>Atelier</span>
            <span className="number-tag hide-mobile">N°01</span>
          </div>
          <nav className="hide-mobile" style={{ display: 'flex', gap: 24 }}>
            <button className={`nav-link ${isActive('/pedidos') ? 'active' : ''}`} onClick={() => router.push('/pedidos')}>Pedidos</button>
            {isAdmin && (
              <button className={`nav-link ${isActive('/reportes') ? 'active' : ''}`} onClick={() => router.push('/reportes')}>Reportes</button>
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
            {isAdmin && (
              <button className={`nav-link ${isActive('/reportes') ? 'active' : ''}`} onClick={() => { router.push('/reportes'); setMobileOpen(false); }}>Reportes</button>
            )}
            <button className={`nav-link ${isActive('/colores') ? 'active' : ''}`} onClick={() => { router.push('/colores'); setMobileOpen(false); }}>Colores</button>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
            <button className="nav-link" onClick={logout} style={{ color: 'var(--rose)' }}>Cerrar sesión</button>
          </div>
        </div>
      )}
    </header>
  );
}
