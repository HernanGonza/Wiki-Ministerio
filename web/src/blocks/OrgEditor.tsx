import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, CornerDownRight, IndentDecrease, IndentIncrease, Link2, ListTree, MoreVertical, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/ui/cn';
import { toast } from '@/ui/feedback';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import type { OrgNodo } from './types';
import { normalizarHref } from './convert';
import { actualizar, agregarHermano, contar, desangrar, mover, nuevoNodo, profundidad, quitar, sangrar } from './orgTree';

const MAX_NIVELES = 8;
const MAX_NODOS = 500;

interface Props { nodos: OrgNodo[]; onChange: (n: OrgNodo[]) => void; onFocus: () => void }

/** Edita el organigrama como un esquema con sangría. El diagrama se ve en la vista previa. */
export function OrgEditor({ nodos, onChange, onFocus }: Props) {
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());
  const [conEnlace, setConEnlace] = useState<Set<string>>(new Set());
  const [foco, setFoco] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLInputElement>());

  const total = contar(nodos);
  const alternar = (set: Set<string>, id: string) => { const s = new Set(set); if (s.has(id)) s.delete(id); else s.add(id); return s; };
  const enfocar = (id: string) => { setFoco(id); setTimeout(() => refs.current.get(id)?.focus(), 30); };

  function agregarHijo(id: string) {
    if (total >= MAX_NODOS) return void toast.error(`Máximo ${MAX_NODOS} cuadros`);
    const nuevo = nuevoNodo();
    onChange(actualizar(nodos, id, (n) => ({ ...n, hijos: [...n.hijos, nuevo] })));
    setCerrados((s) => { const c = new Set(s); c.delete(id); return c; });
    enfocar(nuevo.id);
  }
  function agregarDespues(id: string) {
    if (total >= MAX_NODOS) return void toast.error(`Máximo ${MAX_NODOS} cuadros`);
    const nuevo = nuevoNodo();
    onChange(agregarHermano(nodos, id, nuevo));
    enfocar(nuevo.id);
  }
  function indentar(id: string) {
    const r = sangrar(nodos, id);
    if (profundidad(r) > MAX_NIVELES) return void toast.error(`Máximo ${MAX_NIVELES} niveles`);
    onChange(r);
  }

  const mini = 'grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

  // Función de render (no componente): así los inputs no se recrean en cada tecla y no pierden el foco.
  function fila(n: OrgNodo, nivel: number, primero: boolean, ultimo: boolean): React.ReactNode {
    const cerrado = cerrados.has(n.id);
    return (
      <li key={n.id}>
        <div className={cn('group/org flex items-center gap-0.5 rounded-xl py-0.5 pr-1 transition focus-within:bg-secondary/50 hover:bg-secondary/30', foco === n.id && 'bg-secondary/50')} style={{ paddingLeft: nivel * 18 }}>
          <button type="button" className={cn(mini, !n.hijos.length && 'invisible')} onClick={() => setCerrados(alternar(cerrados, n.id))} aria-expanded={!cerrado} aria-label={cerrado ? 'Expandir' : 'Contraer'}>
            <ChevronRight className={cn('size-4 transition-transform', !cerrado && 'rotate-90')} />
          </button>
          <input
            ref={(el) => { if (el) refs.current.set(n.id, el); else refs.current.delete(n.id); }}
            value={n.t}
            maxLength={200}
            placeholder={nivel === 0 ? 'Nombre del cuadro' : 'Cuadro'}
            aria-label={`Texto del cuadro, nivel ${nivel + 1}`}
            onFocus={() => { setFoco(n.id); onFocus(); }}
            onChange={(e) => onChange(actualizar(nodos, n.id, (x) => ({ ...x, t: e.target.value })))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (e.ctrlKey || e.metaKey) agregarHijo(n.id); else agregarDespues(n.id); }
              else if (e.key === 'Tab') { e.preventDefault(); if (e.shiftKey) onChange(desangrar(nodos, n.id)); else indentar(n.id); setTimeout(() => refs.current.get(n.id)?.focus(), 30); }
              else if (e.key === 'Backspace' && !n.t && !n.hijos.length && total > 1) { e.preventDefault(); onChange(quitar(nodos, n.id)); }
            }}
            className={cn('h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm outline-none focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/15', n.estilo === 'destacado' && 'font-bold text-primary')}
          />
          <button type="button" className={mini} title="Agregar un cuadro adentro de este" aria-label="Agregar cuadro hijo" onClick={() => agregarHijo(n.id)}><Plus className="size-4" /></button>
          <Dropdown>
            <DropdownTrigger asChild><button type="button" className={mini} title="Más opciones" aria-label="Más opciones del cuadro"><MoreVertical className="size-4" /></button></DropdownTrigger>
            <DropdownContent align="end" className="w-64">
              <DropdownItem onSelect={() => onChange(actualizar(nodos, n.id, (x) => ({ ...x, estilo: x.estilo ? undefined : 'destacado' })))}><Star />{n.estilo === 'destacado' ? 'Quitar destacado' : 'Destacar (color de marca)'}</DropdownItem>
              <DropdownItem onSelect={() => setConEnlace(alternar(conEnlace, n.id))}><Link2 />{n.href ? 'Editar enlace' : 'Agregar enlace'}</DropdownItem>
              {n.hijos.length > 0 && (
                <DropdownItem onSelect={() => onChange(actualizar(nodos, n.id, (x) => ({ ...x, vertical: x.vertical ? undefined : true })))}><ListTree />{n.vertical ? 'Mostrar sus cuadros en fila' : 'Apilar sus cuadros en columna'}</DropdownItem>
              )}
              <DropdownSeparator />
              <DropdownItem disabled={primero} onSelect={() => onChange(mover(nodos, n.id, -1))}><ArrowUp />Subir</DropdownItem>
              <DropdownItem disabled={ultimo} onSelect={() => onChange(mover(nodos, n.id, 1))}><ArrowDown />Bajar</DropdownItem>
              <DropdownItem disabled={nivel === 0} onSelect={() => onChange(desangrar(nodos, n.id))}><IndentDecrease />Sacar un nivel (Shift+Tab)</DropdownItem>
              <DropdownItem disabled={primero} onSelect={() => indentar(n.id)}><IndentIncrease />Meter en el de arriba (Tab)</DropdownItem>
              <DropdownSeparator />
              <DropdownItem disabled={total <= 1} onSelect={() => onChange(quitar(nodos, n.id))} className="text-destructive data-[highlighted]:bg-destructive/10 [&_svg]:text-destructive"><Trash2 />Eliminar con lo que contiene</DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
        {(conEnlace.has(n.id) || false) && (
          <div className="flex items-center gap-2 pb-1" style={{ paddingLeft: nivel * 18 + 36 }}>
            <CornerDownRight className="size-3.5 text-muted-foreground" />
            <input
              defaultValue={n.href ?? ''}
              placeholder="Enlace (por ejemplo /ecologia-desarrollo-sustentable o https://…). Vacío = sin enlace"
              aria-label="Enlace del cuadro"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!v) return onChange(actualizar(nodos, n.id, (x) => ({ ...x, href: undefined })));
                const h = normalizarHref(v);
                if (!h) { toast.error('Ese enlace no es válido'); e.target.value = n.href ?? ''; return; }
                onChange(actualizar(nodos, n.id, (x) => ({ ...x, href: h })));
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
            />
          </div>
        )}
        {!cerrado && n.hijos.length > 0 && (
          <ul>{n.hijos.map((h, i) => fila(h, nivel + 1, i === 0, i === n.hijos.length - 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <div className="grid min-w-0 gap-2 rounded-2xl border bg-muted/30 p-3" onFocus={onFocus}>
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">Un cuadro por línea. <b>Enter</b>: otro al mismo nivel · <b>Ctrl+Enter</b>: uno adentro · <b>Tab / Shift+Tab</b>: cambiar de nivel. El diagrama se arma en la vista previa.</p>
      <ul className="min-w-0">{nodos.map((n, i) => fila(n, 0, i === 0, i === nodos.length - 1))}</ul>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { if (total >= MAX_NODOS) return void toast.error(`Máximo ${MAX_NODOS} cuadros`); const n = nuevoNodo(); onChange([...nodos, n]); enfocar(n.id); }}><Plus />Agregar cuadro principal</Button>
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? 'cuadro' : 'cuadros'}</span>
      </div>
    </div>
  );
}
