'use client';

import { useEffect, useRef } from 'react';

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

/**
 * Minimal dependency-free rich-text editor (contentEditable + toolbar). Syncs
 * its HTML into a hidden input named `name` for normal form submission.
 */
export function RichTextEditor({ name, defaultValue = '' }: { name: string; defaultValue?: string }) {
  const editor = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editor.current) editor.current.innerHTML = defaultValue || '';
    if (hidden.current) hidden.current.value = defaultValue || '';
    // Initialise once from defaultValue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    if (hidden.current && editor.current) hidden.current.value = editor.current.innerHTML;
  };
  const run = (command: string, value?: string) => {
    editor.current?.focus();
    exec(command, value);
    sync();
  };

  const btn = 'rounded px-2 py-1 text-sm text-brand-ink hover:bg-brand-ink/10';
  const noBlur = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="rounded-md border border-brand-ink/20 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-brand-ink/10 p-1">
        <button type="button" onMouseDown={noBlur} onClick={() => run('bold')} className={`${btn} font-bold`}>
          B
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => run('italic')} className={`${btn} italic`}>
          I
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => run('underline')} className={`${btn} underline`}>
          U
        </button>
        <span className="mx-1 h-4 w-px bg-brand-ink/15" />
        <button type="button" onMouseDown={noBlur} onClick={() => run('insertUnorderedList')} className={btn}>
          • List
        </button>
        <button type="button" onMouseDown={noBlur} onClick={() => run('insertOrderedList')} className={btn}>
          1. List
        </button>
        <button
          type="button"
          onMouseDown={noBlur}
          onClick={() => {
            const url = window.prompt('Link URL:');
            if (url) run('createLink', url);
          }}
          className={btn}
        >
          Link
        </button>
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        className="min-h-[10rem] px-3 py-2 text-brand-ink focus:outline-none [&_a]:text-brand-pink [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
      <input ref={hidden} type="hidden" name={name} />
    </div>
  );
}
