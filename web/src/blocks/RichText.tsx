import { useEffect, useRef, type MutableRefObject } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Document from '@tiptap/extension-document';
import { Placeholder } from '@tiptap/extensions';
import type { Run } from './types';
import { docAItems, docARuns, hrefPermitido, itemsADoc, runsADoc } from './convert';

const DocLinea = Document.extend({ content: 'paragraph' });
const DocLista = Document.extend({ content: '(bulletList|orderedList)' });

// Solo lo que el esquema de bloques admite: negrita, cursiva, código y enlaces (y listas en el modo lista).
const comun = {
  heading: false, blockquote: false, codeBlock: false, horizontalRule: false, strike: false, underline: false,
  hardBreak: false, dropcursor: false, gapcursor: false,
  link: { openOnClick: false, autolink: true, isAllowedUri: (u: string) => hrefPermitido(u), HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
} as const;

export interface RichTextProps {
  blockId: string;
  modo: 'linea' | 'lista';
  runs?: Run[];
  items?: Run[][];
  ordered?: boolean;
  /** Se incrementa cuando el contenido cambia desde afuera (dividir, convertir…) para recargar el editor. */
  syncKey: number;
  placeholder: string;
  className?: string;
  autoFocus?: boolean | 'inicio';
  registro: MutableRefObject<Map<string, Editor>>;
  onRuns?: (r: Run[]) => void;
  onItems?: (i: Run[][]) => void;
  onFocus: (e: Editor) => void;
  onTexto?: (texto: string) => void;
  onDividir?: (antes: Run[], despues: Run[]) => void;
  onVacioBackspace?: () => void;
  onNavegar?: (dir: 'arriba' | 'abajo') => void;
  onSalirDeLista?: (items: Run[][]) => void;
}

export function RichText(props: RichTextProps) {
  const p = useRef(props);
  p.current = props;
  const lista = props.modo === 'lista';

  const editor = useEditor(
    {
      extensions: lista
        ? [StarterKit.configure({ ...comun, document: false }), DocLista, Placeholder.configure({ placeholder: props.placeholder })]
        : [StarterKit.configure({ ...comun, document: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false }), DocLinea, Placeholder.configure({ placeholder: props.placeholder })],
      content: lista ? itemsADoc(props.items ?? [[]], Boolean(props.ordered)) : runsADoc(props.runs ?? []),
      editorProps: {
        attributes: { class: props.className ?? '', 'aria-label': props.placeholder, spellcheck: 'true' },
        handleKeyDown(view, e) {
          const cur = p.current;
          const { state } = view;
          const { from, to, $from } = state.selection;
          const vacio = state.doc.textContent.length === 0;

          if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (cur.modo === 'linea') {
              e.preventDefault();
              cur.onDividir?.(docARuns(state.doc.cut(0, from).toJSON()), docARuns(state.doc.cut(to).toJSON()));
              return true;
            }
            // Lista: Enter en un ítem vacío y último termina la lista.
            const items = docAItems(state.doc.toJSON());
            const esUltimo = $from.index(1) === items.length - 1;
            if ($from.parent.content.size === 0 && esUltimo) {
              e.preventDefault();
              cur.onSalirDeLista?.(items.slice(0, -1));
              return true;
            }
            return false;
          }
          if (e.key === 'Backspace' && vacio && from <= 3) {
            e.preventDefault();
            cur.onVacioBackspace?.();
            return true;
          }
          if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && from === to) {
            const arriba = e.key === 'ArrowUp';
            if (view.endOfTextblock(arriba ? 'up' : 'down')) {
              const enBorde = cur.modo === 'linea' || (arriba ? $from.index(1) === 0 : $from.index(1) === $from.node(1).childCount - 1);
              if (enBorde) {
                e.preventDefault();
                cur.onNavegar?.(arriba ? 'arriba' : 'abajo');
                return true;
              }
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        const cur = p.current;
        const json = ed.getJSON() as Parameters<typeof docARuns>[0];
        if (cur.modo === 'lista') cur.onItems?.(docAItems(json));
        else cur.onRuns?.(docARuns(json));
        cur.onTexto?.(ed.getText());
      },
      onFocus: ({ editor: ed }) => p.current.onFocus(ed),
    },
    [props.modo, props.ordered],
  );

  // Registro para poder enfocar el editor de un bloque desde afuera.
  useEffect(() => {
    if (!editor) return;
    props.registro.current.set(props.blockId, editor);
    return () => { if (props.registro.current.get(props.blockId) === editor) props.registro.current.delete(props.blockId); };
  }, [editor, props.blockId, props.registro]);

  useEffect(() => {
    if (editor && props.autoFocus) editor.commands.focus(props.autoFocus === 'inicio' ? 'start' : 'end');
  }, [editor, props.autoFocus]);

  // Cambios externos (dividir, convertir, salir de lista).
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    if (!editor) return;
    const cur = p.current;
    editor.commands.setContent(cur.modo === 'lista' ? itemsADoc(cur.items ?? [[]], Boolean(cur.ordered)) : runsADoc(cur.runs ?? []), { emitUpdate: false });
  }, [props.syncKey, editor]);

  return <EditorContent editor={editor} />;
}
