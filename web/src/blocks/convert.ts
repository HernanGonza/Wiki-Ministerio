import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Block, BlockType, OrgNodo, Run, Tono } from './types';

// ───────── utilidades ─────────
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

/** Solo http(s), mailto, rutas internas y anclas. Mismo criterio que la API. */
const HREF_OK = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;
export const hrefPermitido = (u: string) => HREF_OK.test(u.trim());

/** "misiones.gob.ar" → "https://misiones.gob.ar"; devuelve null si no es un enlace admisible. */
export function normalizarHref(raw: string): string | null {
  const u = raw.trim();
  if (!u) return null;
  if (hrefPermitido(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null; // otro esquema (javascript:, data:…)
  const c = `https://${u}`;
  return hrefPermitido(c) ? c : null;
}

export const textoDeRuns = (runs: Run[]) => runs.map((r) => r.t).join('');

const mismaMarca = (a: Run, b: Run) => a.b === b.b && a.i === b.i && a.c === b.c && a.u === b.u;
export function unirRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.t) continue;
    const last = out[out.length - 1];
    if (last && mismaMarca(last, r)) last.t += r.t;
    else out.push({ ...r });
  }
  return out;
}

// ───────── Run[] ⇄ documento Tiptap ─────────
type PMNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: PMNode[] };

const runANodo = (r: Run): PMNode => {
  const marks: NonNullable<PMNode['marks']> = [];
  if (r.b) marks.push({ type: 'bold' });
  if (r.i) marks.push({ type: 'italic' });
  if (r.c) marks.push({ type: 'code' });
  if (r.u) marks.push({ type: 'link', attrs: { href: r.u } });
  return { type: 'text', text: r.t, ...(marks.length ? { marks } : {}) };
};
const parrafo = (runs: Run[]): PMNode => {
  const content = runs.filter((r) => r.t).map(runANodo);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

export const runsADoc = (runs: Run[]): PMNode => ({ type: 'doc', content: [parrafo(runs)] });

export const itemsADoc = (items: Run[][], ordered: boolean): PMNode => ({
  type: 'doc',
  content: [{ type: ordered ? 'orderedList' : 'bulletList', content: (items.length ? items : [[]]).map((it) => ({ type: 'listItem', content: [parrafo(it)] })) }],
});

function nodoARuns(p: PMNode | undefined): Run[] {
  const out: Run[] = [];
  for (const n of p?.content ?? []) {
    if (n.type !== 'text' || !n.text) continue;
    const r: Run = { t: n.text };
    for (const m of n.marks ?? []) {
      if (m.type === 'bold') r.b = true;
      else if (m.type === 'italic') r.i = true;
      else if (m.type === 'code') r.c = true;
      else if (m.type === 'link' && typeof m.attrs?.href === 'string' && hrefPermitido(m.attrs.href)) r.u = m.attrs.href;
    }
    out.push(r);
  }
  return unirRuns(out);
}
export const docARuns = (doc: PMNode): Run[] => nodoARuns(doc.content?.[0]);
export const docAItems = (doc: PMNode): Run[][] => (doc.content?.[0]?.content ?? []).map((li) => nodoARuns(li.content?.[0]));

// ───────── fábrica de bloques ─────────
export function nuevoBloque(type: BlockType, extra: Partial<{ tono: Tono; level: 2 | 3; ordered: boolean }> = {}): Block {
  const id = uid();
  switch (type) {
    case 'paragraph': return { id, type, runs: [] };
    case 'heading': return { id, type, level: extra.level ?? 2, runs: [] };
    case 'list': return { id, type, ordered: extra.ordered ?? false, items: [[]] };
    case 'callout': return { id, type, tone: extra.tono ?? 'info', runs: [] };
    case 'quote': return { id, type, runs: [] };
    case 'code': return { id, type, text: '' };
    case 'divider': return { id, type };
    case 'image': return { id, type, fileId: '', alt: '', caption: '' };
    case 'file': return { id, type, fileId: '', label: '' };
    case 'table': return { id, type, header: true, rows: [['', ''], ['', '']] };
    case 'orgchart': return { id, type, nodos: [{ id: uid(), t: '', hijos: [] }] };
  }
}

/** Convierte entre bloques de texto conservando el contenido. */
export function convertirBloque(b: Block, a: BlockType, extra: Parameters<typeof nuevoBloque>[1] = {}): Block {
  const runs: Run[] | null = 'runs' in b ? b.runs : b.type === 'list' ? unirRuns(b.items.flatMap((it, i) => (i ? [{ t: ' ' }, ...it] : it))) : null;
  const base = nuevoBloque(a, extra);
  if (!runs) return base;
  if ('runs' in base) return { ...base, id: b.id, runs };
  if (base.type === 'list') return { ...base, id: b.id, items: [runs] };
  return { ...base, id: b.id };
}

/** Quita los cuadros sin texto (con todo lo que cuelga de ellos). */
const podarOrg = (ns: OrgNodo[]): OrgNodo[] => ns.filter((n) => n.t.trim()).map((n) => ({ ...n, t: n.t.trim(), hijos: podarOrg(n.hijos) }));

const vacioRuns = (r: Run[]) => !r.some((x) => x.t.trim());

/** Deja los bloques listos para guardar: sin adjuntos vacíos, sin títulos/listas vacíos ni párrafos finales vacíos. */
export function limpiar(blocks: Block[]): Block[] {
  const out = blocks.filter((b) => {
    if (b.type === 'image' || b.type === 'file') return Boolean(b.fileId);
    if (b.type === 'heading') return !vacioRuns(b.runs);
    if (b.type === 'list') return b.items.some((it) => !vacioRuns(it));
    if (b.type === 'code') return b.text.trim().length > 0;
    if (b.type === 'orgchart') return b.nodos.some((n) => n.t.trim());
    return true;
  }).map((b) => (b.type === 'list' ? { ...b, items: b.items.filter((it) => !vacioRuns(it)) } : b.type === 'orgchart' ? { ...b, nodos: podarOrg(b.nodos) } : b));
  while (out.length && out[out.length - 1].type === 'paragraph' && vacioRuns((out[out.length - 1] as Extract<Block, { type: 'paragraph' }>).runs)) out.pop();
  return out;
}

// ───────── Markdown heredado → bloques ─────────
interface N { type: string; value?: string; depth?: number; ordered?: boolean; url?: string; alt?: string; lang?: string; children?: N[] }

function fraseo(nodes: N[] = [], marks: Partial<Run> = {}): Run[] {
  const out: Run[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'text': out.push({ t: n.value ?? '', ...marks }); break;
      case 'strong': out.push(...fraseo(n.children, { ...marks, b: true })); break;
      case 'emphasis': out.push(...fraseo(n.children, { ...marks, i: true })); break;
      case 'inlineCode': out.push({ t: n.value ?? '', ...marks, c: true }); break;
      case 'link': out.push(...fraseo(n.children, n.url && hrefPermitido(n.url) ? { ...marks, u: n.url } : marks)); break;
      case 'break': out.push({ t: ' ', ...marks }); break;
      case 'image': if (n.alt) out.push({ t: n.alt, ...marks }); break;
      default:
        if (n.children) out.push(...fraseo(n.children, marks));
        else if (n.value) out.push({ t: n.value, ...marks });
    }
  }
  return unirRuns(out);
}

const textoPlano = (n: N): string => (n.value ?? '') + (n.children ?? []).map(textoPlano).join('');

function itemsDeLista(list: N): Run[][] {
  return (list.children ?? []).flatMap((li) => {
    const p = (li.children ?? []).find((c) => c.type === 'paragraph');
    const anidadas = (li.children ?? []).filter((c) => c.type === 'list').flatMap(itemsDeLista);
    return [fraseo(p?.children), ...anidadas];
  });
}

/** Convierte Markdown (páginas anteriores al editor de bloques) en bloques. */
export function mdABloques(md: string): Block[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as N;
  const out: Block[] = [];
  (tree.children ?? []).forEach((n, idx) => {
    switch (n.type) {
      case 'heading':
        if (n.depth === 1 && idx === 0) break; // el título ya es el de la página
        out.push({ id: uid(), type: 'heading', level: (n.depth ?? 2) <= 2 ? 2 : 3, runs: fraseo(n.children) });
        break;
      case 'paragraph': {
        const runs = fraseo(n.children);
        if (/^\[PLACEHOLDER\]/i.test(textoDeRuns(runs))) break; // texto de relleno de los seeds
        out.push({ id: uid(), type: 'paragraph', runs });
        break;
      }
      case 'list': out.push({ id: uid(), type: 'list', ordered: Boolean(n.ordered), items: itemsDeLista(n) }); break;
      case 'blockquote':
        for (const p of (n.children ?? []).filter((c) => c.type === 'paragraph')) out.push({ id: uid(), type: 'quote', runs: fraseo(p.children) });
        break;
      case 'code': out.push({ id: uid(), type: 'code', text: n.value ?? '' }); break;
      case 'thematicBreak': out.push({ id: uid(), type: 'divider' }); break;
      case 'table': out.push({ id: uid(), type: 'table', header: true, rows: (n.children ?? []).map((row) => (row.children ?? []).map(textoPlano)) }); break;
      default: break; // html crudo y otros: no se migran
    }
  });
  return out;
}

/** Bloques de un contenido guardado: los propios o, si es heredado, el Markdown convertido. */
export const bloquesDe = (json: Block[] | null | undefined, md: string): Block[] => (json ? json : mdABloques(md));
