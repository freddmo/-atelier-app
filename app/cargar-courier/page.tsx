'use client';

import Navbar from '@/components/Navbar';

export default function CargarCourierPage() {
  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 32, fontWeight: 300 }}>Cargar envío courier</h1>
        <p style={{ color: 'var(--text-soft)', marginTop: 12 }}>
          Esta pantalla está en construcción (C3 Parte 3). Disponible pronto.
        </p>
      </div>
    </>
  );
}
