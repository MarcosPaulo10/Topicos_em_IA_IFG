import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioAttachment } from "../hooks/useAudioAttachment.js";
import { usePdfAttachment } from "../hooks/usePdfAttachment.js";
import { formatDuration } from "../utils/formatDuration.js";
import { languageLabel } from "../utils/languageLabels.js";

const MIN_HEIGHT = 88;
const MAX_HEIGHT = 220;

export default function InputBar({
  onSend,
  isLoading,
  disabled,
  contextCommitted,
  pendingAttachment,
  onPdfExtracted,
  onAudioTranscribed,
  onRemoveContext,
  onPdfProgress,
  onAudioProgress,
}) {
  const [text, setText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef(null);
  const pdfInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const dragCounter = useRef(0);

  const audio = useAudioAttachment({
    onTranscribed: onAudioTranscribed,
    onRemove: onRemoveContext,
    disabled: disabled || contextCommitted,
  });

  const pdf = usePdfAttachment({
    onExtracted: onPdfExtracted,
    onRemove: onRemoveContext,
    onProgress: onPdfProgress,
  });

  const hasReadyAttachment = Boolean(pendingAttachment?.filename);
  const hasAudioDraft = audio.hasSelection && audio.status !== "ready" && !hasReadyAttachment;
  const blocked = disabled || isLoading || pdf.isBusy || audio.isBusy;
  const attachLocked =
    disabled || contextCommitted || hasReadyAttachment || (audio.hasSelection && audio.status !== "ready");

  useEffect(() => {
    if (audio.status === "transcribing") {
      onAudioProgress?.(
        audio.elapsed > 0
          ? `Transcrevendo… ${audio.elapsed}s (pode levar alguns minutos)`
          : "Transcrevendo… isso pode levar alguns minutos",
      );
    } else {
      onAudioProgress?.(null);
    }
  }, [audio.status, audio.elapsed, onAudioProgress]);

  const handlePdfFiles = (files) => {
    if (attachLocked || audio.hasSelection) return;
    const file = files?.[0];
    if (file) pdf.processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (blocked || attachLocked) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".mp3") || name.endsWith(".mp4")) {
      audio.selectFile(file);
    } else {
      handlePdfFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || blocked || hasAudioDraft) return;
    onSend(trimmed);
    setText("");
  };

  const chipIcon = pendingAttachment?.type === "audio" ? "ÁUDIO" : "PDF";

  return (
    <div className="composer-wrap">
      <div className={`composer ${pdf.isBusy || audio.isBusy ? "composer--busy" : ""}`} onDrop={handleDrop}>
        {hasAudioDraft && audio.selectedFile && (
          <div className="attachment-chip attachment-chip--draft">
            <span className="attachment-chip-icon">ÁUDIO</span>
            <div className="attachment-chip-body">
              <span className="attachment-chip-name">{audio.selectedFile.file.name}</span>
              <span className="attachment-chip-meta">{audio.selectedFile.sizeLabel}</span>
            </div>
            {audio.status === "selected" && (
              <button type="button" className="btn-transcribe" onClick={audio.transcribe} disabled={blocked}>
                Transcrever
              </button>
            )}
            {audio.status === "transcribing" && (
              <span className="attachment-chip-busy">Transcrevendo… {audio.elapsed}s</span>
            )}
            <button type="button" className="attachment-chip-remove" onClick={audio.reset} disabled={audio.isBusy}>
              ×
            </button>
          </div>
        )}

        {hasReadyAttachment && (
          <div className="attachment-chip">
            <span className="attachment-chip-icon">{chipIcon}</span>
            <div className="attachment-chip-body">
              <span className="attachment-chip-name">{pendingAttachment.filename}</span>
              <span className="attachment-chip-meta">
                {pendingAttachment.type === "pdf" && pendingAttachment.pageCount != null && `${pendingAttachment.pageCount} pág.`}
                {pendingAttachment.type === "audio" && pendingAttachment.language && languageLabel(pendingAttachment.language)}
                {pendingAttachment.durationSeconds != null && formatDuration(pendingAttachment.durationSeconds) &&
                  ` · ${formatDuration(pendingAttachment.durationSeconds)}`}
                {pendingAttachment.wordCount != null &&
                  ` · ${pendingAttachment.wordCount.toLocaleString("pt-BR")} palavras`}
              </span>
              {pendingAttachment.previewLines?.length > 0 && (
                <p className="attachment-chip-preview">{pendingAttachment.previewLines.join("\n")}</p>
              )}
            </div>
            <button
              type="button"
              className="attachment-chip-remove"
              onClick={() => {
                pdf.reset();
                audio.reset();
                onRemoveContext?.();
              }}
              disabled={blocked}
            >
              ×
            </button>
          </div>
        )}

        <div className="input-bar">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Mensagem… PDF ou áudio (.mp3 / .mp4)"
            rows={3}
            style={{ minHeight: MIN_HEIGHT, height: MIN_HEIGHT }}
          />
        </div>

        <div className="composer-footer">
          <div className="composer-footer-left">
            <input ref={pdfInputRef} type="file" accept=".pdf" hidden onChange={(e) => { handlePdfFiles(e.target.files); e.target.value = ""; }} />
            <input ref={audioInputRef} type="file" accept=".mp3,.mp4" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) audio.selectFile(f); e.target.value = ""; }} />
            <button type="button" className="btn-attach" onClick={() => pdfInputRef.current?.click()} disabled={blocked || attachLocked || audio.hasSelection}>PDF</button>
            <button type="button" className="btn-attach" onClick={() => audioInputRef.current?.click()} disabled={blocked || attachLocked || pdf.isBusy}>Áudio</button>
          </div>
          <button type="button" className="btn-send" onClick={handleSubmit} disabled={blocked || hasAudioDraft || !text.trim()}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
