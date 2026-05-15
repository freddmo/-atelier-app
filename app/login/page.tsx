'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      const user = await api.login(usuario, password);
      auth.setUser(user);
      router.push('/pedidos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="number-tag">SISTEMA INTERNO · N°01</span>
          <h1 className="display" style={{ fontSize: 56, fontWeight: 300, margin: '8px 0 0', lineHeight: 1 }}>
            Atelier<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '16px 0 0' }}>Ingresa para continuar</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Usuario</label>
            <input
              className="input"
              style={{ marginTop: 6 }}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="bodega, mildred o freddy"
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Contraseña</label>
            <input
              className="input"
              type="password"
              style={{ marginTop: 6 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            />
          </div>
          {error && (
            <div style={{ color: 'var(--rose)', fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogin} disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  );
}
