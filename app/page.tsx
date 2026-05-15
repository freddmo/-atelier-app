'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = auth.getUser();
    if (user) {
      router.replace('/pedidos');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-soft)' }}>Cargando…</p>
    </div>
  );
}
