'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import Navbar from '@/components/Navbar';

const COLOR_CATALOG: Record<string, string> = {
  'Expresso': '#4B4443',
  'Royal Blue': '#305CDE',
  'Black': '#1A1814',
  'Wine': '#722F37',
  'Moss': '#4F564E',
  'Ceil Blue': '#92A8D1',
  'Navy': '#1B2845',
  'Burgundy': '#800020',
  'White': '#F5F5F0',
  'ButterYellow': '#F2E5B5',
  'Forest Green': '#005E53',
  'Wild Iris': '#C299D1',
  'Rapid Response Pink': '#FF47B1',
};

export default function ColoresPage() {
  const router = useRouter();

  useEffect(() => {
    if (!auth.getUser()) router.replace('/login');
  }, [router]);

  return (
    <>
      <Navbar />
      <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <span className="number-tag">REFERENCIA · CATÁLOGO</span>
          <h1 className="display" style={{ fontSize: 48, fontWeight: 300, margin: '6px 0 0', lineHeight: 1 }}>
            Colores FIGS<em style={{ color: 'var(--gold)' }}>.</em>
          </h1>
          <p style={{ color: 'var(--text-soft)', fontSize: 14, margin: '12px 0 0', maxWidth: 480 }}>
            Guía visual para identificar cada color al preparar los pedidos.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {Object.entries(COLOR_CATALOG).map(([name, hex]) => (
            <div key={name} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 120, background: hex }} />
              <div style={{ padding: 16 }}>
                <div className="display" style={{ fontSize: 16, fontWeight: 400, marginBottom: 4 }}>{name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
