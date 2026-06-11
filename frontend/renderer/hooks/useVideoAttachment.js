import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeVideo } from "../api.js";

const MAX_BYTES = 500 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useVideoAttachment({ onTranscribed, onRemove, disabled }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [phase, setPhase] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const phaseTimerRef = useRef(null);

  const isBusy =
    status === "uploading" || status === "extracting" || status === "transcribing";
  const hasSelection = Boolean(selectedFile);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setSelectedFile(null);
    setStatus("idle");
    setUploadPercent(0);
    setPhase(null);
    setElapsed(0);
    setError(null);
    onRemove?.();
  }, [clearTimers, onRemove]);

  const selectFile = useCallback(
    (file) => {
      if (!file || disabled) return;

      if (!file.name.toLowerCase().endsWith(".mp4")) {
        setError("Formato não suportado. Use .mp4");
        setStatus("error");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Arquivo muito grande. Máximo de 500 MB.");
        setStatus("error");
        return;
      }

      setError(null);
      setSelectedFile({ file, sizeLabel: formatSize(file.size) });
      setStatus("selected");
    },
    [disabled],
  );

  const process = useCallback(async () => {
    if (!selectedFile?.file || isBusy) return;

    setError(null);
    setStatus("uploading");
    setPhase("uploading");
    setUploadPercent(0);
    setElapsed(0);
    clearTimers();

    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    try {
      const result = await transcribeVideo(selectedFile.file, {
        onUploadProgress: (ratio) => {
          const pct = Math.min(100, Math.round(ratio * 100));
          setUploadPercent(pct);
          if (pct >= 100) {
            setStatus("extracting");
            setPhase("extracting");
            phaseTimerRef.current = setTimeout(() => {
              setStatus("transcribing");
              setPhase("transcribing");
            }, 15000);
          }
        },
      });

      setStatus("ready");
      setPhase(null);
      onTranscribed?.({
        text: result.text,
        filename: result.filename,
        language: result.language,
        wordCount: result.word_count,
        durationSeconds: result.duration_seconds,
        warning: result.warning,
        previewLines: result.preview_lines,
      });
    } catch (err) {
      setError(err.message || "Erro ao processar vídeo");
      setStatus("error");
      setPhase(null);
    } finally {
      clearTimers();
    }
  }, [selectedFile, isBusy, clearTimers, onTranscribed]);

  const clearError = useCallback(() => {
    setError(null);
    setStatus(selectedFile ? "selected" : "idle");
  }, [selectedFile]);

  return {
    selectFile,
    process,
    reset,
    clearError,
    selectedFile,
    status,
    phase,
    uploadPercent,
    elapsed,
    error,
    isBusy,
    hasSelection,
  };
}
