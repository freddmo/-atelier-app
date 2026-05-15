// lib/auth.ts — Manejo de sesión del usuario logueado

import { Usuario } from './types';

const STORAGE_KEY = 'atelier_user';

export const auth = {
  getUser(): Usuario | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  },

  setUser(user: Usuario) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  isAdmin(): boolean {
    const u = auth.getUser();
    return u?.rol === 'admin';
  },

  isBodega(): boolean {
    const u = auth.getUser();
    return u?.rol === 'bodega';
  },
};
