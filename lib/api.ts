// lib/api.ts — Cliente para comunicarse con tu Apps Script

import { Pedido, Usuario, Estado } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

if (!API_URL) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL no está configurada en .env.local');
}

// ============ GET helpers ============

async function apiGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido');
  return json.data as T;
}

async function apiPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    // Apps Script no acepta CORS headers personalizados, así que mandamos text/plain
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido');
  return json.data as T;
}

// ============ Endpoints ============

export const api = {
  async ping() {
    return apiGet<{ message: string }>('ping');
  },

  async getPedidos(): Promise<Pedido[]> {
    return apiGet<Pedido[]>('getPedidos');
  },

  async getPedido(id: string): Promise<Pedido> {
    return apiGet<Pedido>('getPedido', { id });
  },

  async login(usuario: string, password: string): Promise<Usuario> {
    return apiPost<Usuario>({ action: 'login', usuario, password });
  },

  async cambiarEstado(ordenId: string, nuevoEstado: Estado, usuario: string) {
    return apiPost({
      action: 'cambiarEstado',
      ordenId,
      nuevoEstado,
      usuario,
    });
  },
};
