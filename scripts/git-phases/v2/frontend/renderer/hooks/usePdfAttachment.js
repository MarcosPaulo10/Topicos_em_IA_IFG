import { useCallback, useState } from "react";
import { extractTextFromPdf } from "../utils/pdfExtractor.js";

export function usePdfAttachment({ onExtracted, onRemove, onProgress }) {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  const isBusy = status === "reading" || status === "extracting";

  const processFile = useCallback(
    async (file) => {
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Apenas arquivos .pdf são suportados nesta fase.");
        setStatus("error");
        return;
      }

      setError(null);
      setStatus("reading");
      onProgress?.("Lendo arquivo PDF...");

      try {
        const result = await extractTextFromPdf(file, (p) => {
          if (p.status === "reading") {
            setStatus("reading");
            onProgress?.("Lendo arquivo PDF...");
          } else if (p.status === "extracting") {
            setStatus("extracting");
            setProgress({ current: p.current, total: p.total });
            onProgress?.(`Extraindo texto — página ${p.current} de ${p.total}...`);
          }
        });

        setStatus("done");
        onProgress?.(`Documento anexado — ${result.wordCount.toLocaleString("pt-BR")} palavras`);
        onExtracted?.({
          text: result.text,
          filename: file.name,
          pageCount: result.pageCount,
          totalPages: result.totalPages,
          wordCount: result.wordCount,
          warning: result.warning,
        });
      } catch (err) {
        setError(err.message || "Erro ao processar PDF");
        setStatus("error");
        onProgress?.(null);
      }
    },
    [onExtracted, onProgress],
  );

  const clearError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setProgress({ current: 0, total: 0 });
    onProgress?.(null);
    onRemove?.();
  }, [onRemove, onProgress]);

  return {
    processFile,
    reset,
    clearError,
    isBusy,
    status,
    progress,
    error,
  };
}
