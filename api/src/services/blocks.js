// Contenido en bloques. El cliente edita y envía una lista de bloques; el servidor la valida
// con un esquema ESTRICTO (nada de HTML ni campos extra) y deriva una copia en Markdown.
// Como el frontend renderiza los bloques con componentes React (no con HTML crudo), no hay
// superficie de inyección: lo único "peligroso" son los enlaces, que se limitan acá.
import { z } from 'zod';

const id = z.string().min(1).max(40);
const uuid = z.string().uuid();

// Solo http(s), mailto, rutas internas y anclas. Nada de javascript:, data:, etc.
export const href = z
  .string()
  .trim()
  .max(2000)
  .refine((u) => /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(u), 'Enlace no permitido');

/** Tramo de texto con formato: b=negrita, i=cursiva, c=código, u=enlace. */
const run = z
  .object({
    t: z.string().max(5000),
    b: z.literal(true).optional(),
    i: z.literal(true).optional(),
    c: z.literal(true).optional(),
    u: href.optional(),
  })
  .strict();
const runs = z.array(run).max(300);

/** Nodo de organigrama. Se arma por niveles (máx. 8) para no depender de esquemas recursivos. */
const orgNodo = (nivel) =>
  z
    .object({
      id,
      t: z.string().max(200),
      estilo: z.literal('destacado').optional(),
      vertical: z.literal(true).optional(),
      href: href.optional(),
      hijos: nivel > 0 ? z.array(orgNodo(nivel - 1)).max(60) : z.array(z.never()).max(0),
    })
    .strict();
const MAX_NODOS = 500;

const base = { id };
const block = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('paragraph'), runs }).strict(),
  z.object({ ...base, type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3)]), runs }).strict(),
  z.object({ ...base, type: z.literal('list'), ordered: z.boolean(), items: z.array(runs).max(300) }).strict(),
  z.object({ ...base, type: z.literal('callout'), tone: z.enum(['info', 'warn', 'ok', 'danger']), runs }).strict(),
  z.object({ ...base, type: z.literal('quote'), runs }).strict(),
  z.object({ ...base, type: z.literal('code'), text: z.string().max(50_000) }).strict(),
  z.object({ ...base, type: z.literal('divider') }).strict(),
  z.object({ ...base, type: z.literal('image'), fileId: uuid, alt: z.string().max(300), caption: z.string().max(500) }).strict(),
  z.object({ ...base, type: z.literal('file'), fileId: uuid, label: z.string().max(200), vista: z.boolean().optional() }).strict(),
  z.object({ ...base, type: z.literal('orgchart'), nodos: z.array(orgNodo(7)).max(20) }).strict(),
  z
    .object({
      ...base,
      type: z.literal('table'),
      header: z.boolean(),
      rows: z.array(z.array(z.string().max(2000)).max(20)).max(200),
    })
    .strict(),
]);

const contarNodos = (ns) => ns.reduce((n, x) => n + 1 + contarNodos(x.hijos), 0);
export const blocksSchema = z
  .array(block)
  .max(1000)
  .refine((bs) => bs.filter((b) => b.type === 'orgchart').reduce((n, b) => n + contarNodos(b.nodos), 0) <= MAX_NODOS, `Demasiados cuadros en los organigramas (máximo ${MAX_NODOS})`);

const runMd = (rs) =>
  rs
    .map((r) => {
      let t = r.t;
      if (r.c) t = `\`${t}\``;
      if (r.b) t = `**${t}**`;
      if (r.i) t = `*${t}*`;
      if (r.u) t = `[${t}](${r.u})`;
      return t;
    })
    .join('');

/** Markdown derivado (búsqueda, exportación y lectura por clientes viejos). */
export function blocksToMarkdown(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph': out.push(runMd(b.runs)); break;
      case 'heading': out.push(`${'#'.repeat(b.level)} ${runMd(b.runs)}`); break;
      case 'list': out.push(b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${runMd(it)}`).join('\n')); break;
      case 'callout': out.push(`> **${{ info: 'Nota', warn: 'Atención', ok: 'Listo', danger: 'Importante' }[b.tone]}:** ${runMd(b.runs)}`); break;
      case 'quote': out.push(`> ${runMd(b.runs)}`); break;
      case 'code': out.push(`\`\`\`\n${b.text}\n\`\`\``); break;
      case 'divider': out.push('---'); break;
      case 'image': out.push(`![${b.alt}](/api/files/${b.fileId})${b.caption ? `\n*${b.caption}*` : ''}`); break;
      case 'file': out.push(`[${b.label || 'Archivo adjunto'}](/api/files/${b.fileId})`); break;
      case 'orgchart': {
        const lin = (ns, d) => ns.flatMap((x) => [`${'  '.repeat(d)}- ${x.t}`, ...lin(x.hijos, d + 1)]);
        out.push(lin(b.nodos, 0).join('\n'));
        break;
      }
      case 'table': {
        const [head, ...body] = b.header ? b.rows : [b.rows[0]?.map(() => ''), ...b.rows];
        if (!head) break;
        const row = (r) => `| ${r.join(' | ')} |`;
        out.push([row(head), row(head.map(() => '---')), ...body.map(row)].join('\n'));
        break;
      }
    }
  }
  return out.join('\n\n');
}

/** Ids de archivos referenciados por los bloques. */
export const collectFileIds = (blocks) => [...new Set(blocks.filter((b) => b.type === 'image' || b.type === 'file').map((b) => b.fileId))];
