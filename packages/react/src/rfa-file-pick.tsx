"use client";
import { useRef, useState, type DragEvent, type ReactElement, type ReactNode } from "react";

/**
 * A styled file chooser: a real button that opens a hidden file input, never the
 * browser's native file control. With `name`, the chosen file stays on the hidden input
 * so the surrounding form's FormData carries it; otherwise `onFile` receives it at once.
 */
export function RfaFilePick({ name, accept = "application/pdf,.pdf", disabled, onFile, children, className, dropzone = false, label }: {
  name?: string; accept?: string; disabled?: boolean; onFile?: (file: File) => void; children: ReactNode;
  className?: string; /** Also accept a file dropped on the button. */ dropzone?: boolean; /** Accessible name when the content is not enough. */ label?: string;
}): ReactElement {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState(""); const [over, setOver] = useState(false);
  const take = (file: File | undefined) => { if (!file) return; setChosen(file.name); onFile?.(file); };
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault(); setOver(false);
    const file = event.dataTransfer.files[0];
    if (disabled || !file) return;
    if (name && input.current && typeof DataTransfer !== "undefined") { const transfer = new DataTransfer(); transfer.items.add(file); input.current.files = transfer.files; }
    take(file);
  };
  return <>
    <button type="button" className={className} data-over={over ? "true" : undefined} disabled={disabled} aria-label={label} onClick={() => input.current?.click()}
      {...(dropzone ? { onDragOver: (event: DragEvent<HTMLButtonElement>) => { event.preventDefault(); if (!disabled) setOver(true); }, onDragLeave: () => setOver(false), onDrop: drop } : {})}>
      {children}{name && chosen ? <small className="mbrfa-file-chosen">{chosen}</small> : null}
    </button>
    <input ref={input} hidden type="file" name={name} accept={accept} disabled={disabled} tabIndex={-1} aria-hidden="true"
      onChange={event => { const file = event.target.files?.[0]; if (!name) event.target.value = ""; take(file); }} />
  </>;
}
