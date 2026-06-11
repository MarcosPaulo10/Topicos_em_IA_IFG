import { useCallback, useEffect, useRef, useState } from "react";
import { usePdfAttachment } from "../hooks/usePdfAttachment.js";

const MIN_HEIGHT = 88;
const MAX_HEIGHT = 220;

export default function InputBar({
  onSend,
  isLoading,
  disabled,
  contextCommitted,
  pendingAttachment,
  onPdfExtracted,
  onRemoveContext,
  onPdfProgress,
}) {
  const [text, setText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef(null);
  const pdfInputRef = useRef(null);
  const dragCounter = useRef(0);

  const pdf = usePdfAttachment({
    onExtracted: onPdfExtracted,
    onRemove: onRemoveContext,
    onProgress: onPdfProgress,
  });

  const hasReadyAttachment = Boolean(pendingAttachment?.filename);
  const blocked = disabled || isLoading || pdf.isBusy;
  const attachLocked = disabled || contextCommitted || hasReadyAttachment;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, hasReadyAttachment, resizeTextarea]);

  useEffect(() => {
    if (!blocked) textareaRef.current?.focus();
  }, [blocked]);

  const handlePdfFiles = (files) => {
    if (attachLocked) return;
    const file = files?.[0];
    if (file) pdf.processFile(file);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    if (blocked || attachLocked) return;
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!blocked && !attachLocked) e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (blocked || attachLocked) return;
    handlePdfFiles(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || blocked) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const pdfBusyLabel =
    pdf.status === "reading"
      ? "Lendo PDF..."
      : pdf.status === "extracting"
        ? `Extraindo ${pdf.progress.current}/${pdf.progress.total}...`
        : null;

  return (
    <div className="composer-wrap">
      <div
        className={`composer ${isDragOver ? "composer--drag-over" : ""} ${pdf.isBusy ? "composer--busy" : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="composer-drop-overlay">
            <span>Solte um PDF aqui</span>
          </div>
        )}

        {hasReadyAttachment && (
          <div className="attachment-chip">
            <span className="attachment-chip-icon">PDF</span>
            <div className="attachment-chip-body">
              <span className="attachment-chip-name">{pendingAttachment.filename}</span>
              <span className="attachment-chip-meta">
                {pendingAttachment.pageCount != null && `${pendingAttachment.pageCount} pág.`}
                {pendingAttachment.wordCount != null &&
                  ` · ${pendingAttachment.wordCount.toLocaleString("pt-BR")} palavras`}
              </span>
              {pendingAttachment.warning && (
                <span className="attachment-chip-warn">{pendingAttachment.warning}</span>
              )}
            </div>
            <button
              type="button"
              className="attachment-chip-remove"
              onClick={() => {
                pdf.reset();
                onRemoveContext?.();
              }}
              disabled={blocked}
            >
              ×
            </button>
          </div>
        )}

        {pdf.error && (
          <div className="attachment-error">
            <span>{pdf.error}</span>
            <button type="button" onClick={pdf.clearError}>
              OK
            </button>
          </div>
        )}

        <div className="input-bar">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasReadyAttachment
                ? "Pergunte sobre o documento…"
                : "Mensagem… ou arraste um PDF"
            }
            rows={3}
            style={{ minHeight: MIN_HEIGHT, height: MIN_HEIGHT }}
            autoFocus
          />
        </div>

        <div className="composer-footer">
          <div className="composer-footer-left">
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={(e) => {
                handlePdfFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-attach"
              onClick={() => pdfInputRef.current?.click()}
              disabled={blocked || attachLocked}
              title="Anexar PDF"
            >
              PDF
            </button>
            <span className="composer-hint">
              {pdfBusyLabel || (hasReadyAttachment && "PDF anexado · Enter envia") || "Shift+Enter quebra linha"}
            </span>
          </div>
          <button
            type="button"
            className="btn-send"
            onClick={handleSubmit}
            disabled={blocked || !text.trim()}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
