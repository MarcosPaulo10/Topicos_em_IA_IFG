import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../api.js";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED = [".mp3", ".mp4"];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useAudioAttachment({ onTranscribed, onRemove, disabled }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const isBusy = status === "transcribing";
  const hasSelection = Boolean(selectedFile);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setSelectedFile(null);
    setStatus("idle");
    setElapsed(0);
    setError(null);
    onRemove?.();
  }, [clearTimer, onRemove]);

  const selectFile = useCallback(
    (file) => {
      if (!file || disabled) return;

      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!ALLOWED.includes(ext)) {
        setError("Formato não suportado. Use .mp3 ou .mp4");
        setStatus("error");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Arquivo muito grande. Máximo de 100 MB.");
        setStatus("error");
        return;
      }

      setError(null);
      setSelectedFile({ file, sizeLabel: formatSize(file.size) });
      setStatus("selected");
    },
    [disabled],
  );

  const transcribe = useCallback(async () => {
    if (!selectedFile?.file || isBusy) return;

    setError(null);
    setStatus("transcribing");
    setElapsed(0);
    clearTimer();
    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    try {
      const result = await transcribeAudio(selectedFile.file);
      setStatus("ready");
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
      setError(err.message || "Erro ao transcrever áudio");
      setStatus("error");
    } finally {
      clearTimer();
    }
  }, [selectedFile, isBusy, clearTimer, onTranscribed]);

  const clearError = useCallback(() => {
    setError(null);
    setStatus(selectedFile ? "selected" : "idle");
  }, [selectedFile]);

  return {
    selectFile,
    transcribe,
    reset,
    clearError,
    selectedFile,
    status,
    elapsed,
    error,
    isBusy,
    hasSelection,
  };
}
