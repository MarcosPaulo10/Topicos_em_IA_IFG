import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioAttachment } from "../hooks/useAudioAttachment.js";
import { usePdfAttachment } from "../hooks/usePdfAttachment.js";
import { useVideoAttachment } from "../hooks/useVideoAttachment.js";
import { formatDuration } from "../utils/formatDuration.js";
import { languageLabel } from "../utils/languageLabels.js";

const MIN_HEIGHT = 88;
const MAX_HEIGHT = 220;

const CONTEXT_LABELS = {
  pdf: "documento anexado",
  audio: "áudio transcrito",
  video: "vídeo transcrito",
};

const CHIP_ICONS = {
  pdf: "PDF",
  audio: "ÁUDIO",
  video: "VÍDEO",
};

export default function InputBar({
  onSend,
  isLoading,
  disabled,
  contextCommitted,
  pendingAttachment,
  onPdfExtracted,
  onAudioTranscribed,
  onVideoTranscribed,
  onRemoveContext,
  onPdfProgress,
  onAudioProgress,
  onVideoProgress,
}) {
  const [text, setText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef(null);
  const pdfInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const dragCounter = useRef(0);

  const audio = useAudioAttachment({
    onTranscribed: onAudioTranscribed,
    onRemove: onRemoveContext,
    disabled: disabled || contextCommitted,
  });

  const video = useVideoAttachment({
    onTranscribed: onVideoTranscribed,
    onRemove: onRemoveContext,
    disabled: disabled || contextCommitted,
  });

  const pdf = usePdfAttachment({
    onExtracted: onPdfExtracted,
    onRemove: onRemoveContext,
    onProgress: onPdfProgress,
  });

  const hasReadyAttachment = Boolean(pendingAttachment?.filename);
  const hasMediaDraft =
    (audio.hasSelection && audio.status !== "ready") ||
    (video.hasSelection && video.status !== "ready");
  const hasAudioDraft = audio.hasSelection && audio.status !== "ready" && !hasReadyAttachment;
  const hasVideoDraft = video.hasSelection && video.status !== "ready" && !hasReadyAttachment;

  const isPdfBusy = pdf.isBusy;
  const isAudioBusy = audio.isBusy;
  const isVideoBusy = video.isBusy;

  const attachLocked = disabled || contextCommitted || hasReadyAttachment || hasMediaDraft;
  const blocked = disabled || isLoading || isPdfBusy || isAudioBusy || isVideoBusy;

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
    if (!isLoading && !blocked) {
      textareaRef.current?.focus();
    }
  }, [isLoading, blocked]);

  useEffect(() => {
    if (audio.status === "transcribing") {
      onAudioProgress?.(
        audio.elapsed > 0
          ? `Transcrevendo… ${audio.elapsed}s (pode levar alguns minutos)`
          : "Transcrevendo… isso pode levar alguns minutos",
      );
    } else if (!isVideoBusy) {
      onAudioProgress?.(null);
    }
  }, [audio.status, audio.elapsed, onAudioProgress, isVideoBusy]);

  useEffect(() => {
    if (!isVideoBusy) {
      onVideoProgress?.(null);
      return;
    }
    if (video.phase === "uploading") {
      onVideoProgress?.(`Enviando vídeo… ${video.uploadPercent}%`);
    } else if (video.phase === "extracting") {
      onVideoProgress?.("Etapa 1/2: Extraindo áudio do vídeo…");
    } else if (video.phase === "transcribing") {
      onVideoProgress?.(
        video.elapsed > 0
          ? `Etapa 2/2: Transcrevendo… ${video.elapsed}s`
          : "Etapa 2/2: Transcrevendo…",
      );
    }
  }, [isVideoBusy, video.phase, video.uploadPercent, video.elapsed, onVideoProgress]);

  const handlePdfFiles = (files) => {
    if (attachLocked || audio.hasSelection || video.hasSelection) return;
    const file = files?.[0];
    if (file) pdf.processFile(file);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (blocked || attachLocked || audio.hasSelection || video.hasSelection) return;
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!blocked && !attachLocked) e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (blocked || attachLocked) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".mp3")) {
      audio.selectFile(file);
    } else if (name.endsWith(".mp4")) {
      video.selectFile(file);
    } else {
      handlePdfFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || blocked || hasAudioDraft || hasVideoDraft) return;
    onSend(trimmed);
    setText("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;
        textareaRef.current.focus();
      }
    });
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

  const contextLabel = CONTEXT_LABELS[pendingAttachment?.type] || "conteúdo anexado";
  const chipIcon = CHIP_ICONS[pendingAttachment?.type] || "ANEXO";

  const videoBusyLabel =
    video.phase === "uploading"
      ? `Enviando… ${video.uploadPercent}%`
      : video.phase === "extracting"
        ? "Extraindo áudio…"
        : video.phase === "transcribing"
          ? `Transcrevendo… ${video.elapsed}s`
          : null;

  return (
    <div className="composer-wrap">
      <div
        className={`composer ${isDragOver ? "composer--drag-over" : ""} ${isPdfBusy || isAudioBusy || isVideoBusy ? "composer--busy" : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="composer-drop-overlay">
            <span>Solte PDF, áudio (.mp3) ou vídeo (.mp4)</span>
          </div>
        )}

        {hasVideoDraft && video.selectedFile && (
          <div className="attachment-chip attachment-chip--draft">
            <span className="attachment-chip-icon">VÍDEO</span>
            <div className="attachment-chip-body">
              <span className="attachment-chip-name">{video.selectedFile.file.name}</span>
              <span className="attachment-chip-meta">{video.selectedFile.sizeLabel}</span>
              {video.phase === "uploading" && (
                <div className="upload-progress">
                  <div
                    className="upload-progress-bar"
                    style={{ width: `${video.uploadPercent}%` }}
                  />
                </div>
              )}
            </div>
            {video.status === "selected" && (
              <button
                type="button"
                className="btn-transcribe"
                onClick={video.process}
                disabled={blocked}
              >
                Processar vídeo
              </button>
            )}
            {isVideoBusy && video.status !== "selected" && (
              <span className="attachment-chip-busy">{videoBusyLabel}</span>
            )}
            <button
              type="button"
              className="attachment-chip-remove"
              onClick={video.reset}
              disabled={isVideoBusy}
              title="Cancelar"
            >
              ×
            </button>
          </div>
        )}

        {hasAudioDraft && audio.selectedFile && (
          <div className="attachment-chip attachment-chip--draft">
            <span className="attachment-chip-icon">ÁUDIO</span>
            <div className="attachment-chip-body">
              <span className="attachment-chip-name">{audio.selectedFile.file.name}</span>
              <span className="attachment-chip-meta">{audio.selectedFile.sizeLabel}</span>
            </div>
            {audio.status === "selected" && (
              <button
                type="button"
                className="btn-transcribe"
                onClick={audio.transcribe}
                disabled={blocked}
              >
                Transcrever
              </button>
            )}
            {audio.status === "transcribing" && (
              <span className="attachment-chip-busy">
                Transcrevendo… {audio.elapsed}s
              </span>
            )}
            <button
              type="button"
              className="attachment-chip-remove"
              onClick={audio.reset}
              disabled={isAudioBusy}
              title="Cancelar"
            >
              ×
            </button>
          </div>
        )}

        {hasReadyAttachment && (
          <div className="attachment-chip">
            <span className="attachment-chip-icon">{chipIcon}</span>
            <div className="attachment-chip-body">
              <span className="attachment-chip-name" title={pendingAttachment.filename}>
                {pendingAttachment.filename}
              </span>
              <span className="attachment-chip-meta">
                {pendingAttachment.type === "pdf" && pendingAttachment.pageCount != null &&
                  `${pendingAttachment.pageCount} pág.`}
                {(pendingAttachment.type === "audio" || pendingAttachment.type === "video") &&
                  pendingAttachment.language &&
                  languageLabel(pendingAttachment.language)}
                {pendingAttachment.durationSeconds != null &&
                  formatDuration(pendingAttachment.durationSeconds) &&
                  ` · ${formatDuration(pendingAttachment.durationSeconds)}`}
                {pendingAttachment.wordCount != null &&
                  ` · ${pendingAttachment.wordCount.toLocaleString("pt-BR")} palavras`}
              </span>
              {pendingAttachment.previewLines?.length > 0 && (
                <p className="attachment-chip-preview">
                  {pendingAttachment.previewLines.join("\n")}
                </p>
              )}
              {pendingAttachment.warning && (
                <span className="attachment-chip-warn">{pendingAttachment.warning}</span>
              )}
            </div>
            <button
              type="button"
              className="attachment-chip-remove"
              onClick={() => {
                pdf.reset();
                audio.reset();
                video.reset();
                onRemoveContext?.();
              }}
              disabled={blocked}
              title="Remover anexo"
            >
              ×
            </button>
          </div>
        )}

        {(pdf.error || audio.error || video.error) && (
          <div className="attachment-error">
            <span>{pdf.error || audio.error || video.error}</span>
            <button
              type="button"
              onClick={() => {
                if (pdf.error) pdf.clearError();
                if (audio.error) audio.clearError();
                if (video.error) video.clearError();
              }}
            >
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
                ? `Pergunte sobre o ${contextLabel}…`
                : hasAudioDraft || hasVideoDraft
                  ? "Confirme o processamento antes de enviar…"
                  : "Mensagem… PDF, áudio (.mp3) ou vídeo (.mp4)"
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
            <input
              ref={audioInputRef}
              type="file"
              accept=".mp3,.mp4,audio/mpeg"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) audio.selectFile(file);
                e.target.value = "";
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept=".mp4,video/mp4"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) video.selectFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-attach"
              onClick={() => pdfInputRef.current?.click()}
              disabled={blocked || attachLocked || audio.hasSelection || video.hasSelection}
              title="Anexar PDF"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="btn-attach btn-attach-audio"
              onClick={() => audioInputRef.current?.click()}
              disabled={blocked || attachLocked || isPdfBusy || video.hasSelection}
              title="Carregar áudio (.mp3 / .mp4)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="btn-attach btn-attach-video"
              onClick={() => videoInputRef.current?.click()}
              disabled={blocked || attachLocked || isPdfBusy || audio.hasSelection}
              title="Carregar vídeo (.mp4)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className="composer-hint">
              {pdfBusyLabel ||
                videoBusyLabel ||
                (isAudioBusy && `Transcrevendo áudio… ${audio.elapsed}s`) ||
                (hasReadyAttachment && `${contextLabel} · Enter envia`) ||
                "Shift+Enter quebra linha · PDF, áudio ou vídeo"}
            </span>
          </div>
          <button
            type="button"
            className="btn-send"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSubmit}
            disabled={isLoading || blocked || hasAudioDraft || hasVideoDraft || !text.trim()}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
