import type { OrgNodo } from './types';
import { uid } from './convert';

export const nuevoNodo = (t = ''): OrgNodo => ({ id: uid(), t, hijos: [] });

/** Aplica `fn` al nodo con ese id y devuelve el árbol nuevo (inmutable). */
export function actualizar(ns: OrgNodo[], id: string, fn: (n: OrgNodo) => OrgNodo): OrgNodo[] {
  return ns.map((n) => (n.id === id ? fn(n) : { ...n, hijos: actualizar(n.hijos, id, fn) }));
}

export const quitar = (ns: OrgNodo[], id: string): OrgNodo[] => ns.filter((n) => n.id !== id).map((n) => ({ ...n, hijos: quitar(n.hijos, id) }));

export function mover(ns: OrgNodo[], id: string, d: -1 | 1): OrgNodo[] {
  const i = ns.findIndex((n) => n.id === id);
  if (i >= 0) {
    const j = i + d;
    if (j < 0 || j >= ns.length) return ns;
    const a = [...ns];
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  }
  return ns.map((n) => ({ ...n, hijos: mover(n.hijos, id, d) }));
}

/** Agrega un hermano justo después del nodo `id`. */
export function agregarHermano(ns: OrgNodo[], id: string, nuevo: OrgNodo): OrgNodo[] {
  const i = ns.findIndex((n) => n.id === id);
  if (i >= 0) return [...ns.slice(0, i + 1), nuevo, ...ns.slice(i + 1)];
  return ns.map((n) => ({ ...n, hijos: agregarHermano(n.hijos, id, nuevo) }));
}

/** Convierte al nodo en hijo de su hermano anterior (sangrar). */
export function sangrar(ns: OrgNodo[], id: string): OrgNodo[] {
  const i = ns.findIndex((n) => n.id === id);
  if (i > 0) {
    const prev = ns[i - 1];
    return [...ns.slice(0, i - 1), { ...prev, hijos: [...prev.hijos, ns[i]] }, ...ns.slice(i + 1)];
  }
  if (i === 0) return ns;
  return ns.map((n) => ({ ...n, hijos: sangrar(n.hijos, id) }));
}

/** Saca al nodo de su padre y lo deja como hermano siguiente del padre (desangrar). */
export function desangrar(ns: OrgNodo[], id: string): OrgNodo[] {
  const out: OrgNodo[] = [];
  for (const n of ns) {
    const k = n.hijos.findIndex((h) => h.id === id);
    if (k >= 0) {
      out.push({ ...n, hijos: n.hijos.filter((h) => h.id !== id) }, n.hijos[k]);
    } else {
      out.push({ ...n, hijos: desangrar(n.hijos, id) });
    }
  }
  return out;
}

export const contar = (ns: OrgNodo[]): number => ns.reduce((c, n) => c + 1 + contar(n.hijos), 0);
export const profundidad = (ns: OrgNodo[]): number => (ns.length ? 1 + Math.max(...ns.map((n) => profundidad(n.hijos))) : 0);
