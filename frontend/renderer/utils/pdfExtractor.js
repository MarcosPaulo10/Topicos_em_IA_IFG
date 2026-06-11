import "./pdfPolyfill.js";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MAX_PAGES = 10;
const MAX_CONTEXT_CHARS = 12000;

const PDF_ASSETS_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

function cleanText(text) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\ufeff/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Monta texto preservando quebras de linha do layout PDF */
function itemsToText(items) {
  if (!items?.length) return "";

  const chunks = [];
  let lastY = null;
  let line = "";

  for (const item of items) {
    if (!item || typeof item.str !== "string") continue;

    const str = item.str;
    if (!str) continue;

    if (Array.isArray(item.transform) && item.transform.length >= 6) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 8) {
        if (line.trim()) chunks.push(line.trim());
        line = "";
      }
      lastY = y;
    }

    line += str;

    if (item.hasEOL) {
      if (line.trim()) chunks.push(line.trim());
      line = "";
      lastY = null;
    } else {
      line += " ";
    }
  }

  if (line.trim()) chunks.push(line.trim());

  return chunks.join("\n");
}

async function loadPdfDocument(data) {
  return pdfjsLib
    .getDocument({
      data,
      useSystemFonts: true,
      isEvalSupported: false,
      cMapUrl: `${PDF_ASSETS_BASE}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDF_ASSETS_BASE}standard_fonts/`,
    })
    .promise;
}

async function extractPagesText(pdf, pagesToRead, onProgress) {
  const parts = [];

  for (let i = 1; i <= pagesToRead; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });
    parts.push(itemsToText(content.items));
    onProgress?.({ status: "extracting", current: i, total: pagesToRead });
  }

  return parts;
}

/**
 * Extrai texto de um PDF no browser (PDF.js).
 */
export async function extractTextFromPdf(file, onProgress) {
  onProgress?.({ status: "reading" });

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  let pdf;
  try {
    pdf = await loadPdfDocument(data);
  } catch (err) {
    throw new Error(
      err?.message?.includes("password")
        ? "PDF protegido por senha. Remova a senha e tente novamente."
        : `Não foi possível abrir o PDF: ${err?.message || "arquivo inválido"}`,
    );
  }

  const totalPages = pdf.numPages;
  if (!totalPages) {
    await pdf.destroy();
    throw new Error("O PDF não possui páginas.");
  }

  const pagesToRead = Math.min(totalPages, MAX_PAGES);
  onProgress?.({ status: "extracting", current: 0, total: pagesToRead });

  const parts = await extractPagesText(pdf, pagesToRead, onProgress);
  await pdf.destroy();

  let text = cleanText(parts.join("\n\n"));
  let truncated = false;
  let warning = null;

  if (totalPages > MAX_PAGES) {
    warning = `Este PDF tem ${totalPages} páginas. Apenas as primeiras ${MAX_PAGES} foram carregadas.`;
  }

  const charCount = text.replace(/\s/g, "").length;

  if (!charCount) {
    throw new Error(
      "Não há texto selecionável neste PDF. Provável scan ou imagem sem OCR — " +
        "use um PDF exportado do Word/Google Docs ou aplique OCR no arquivo antes de anexar.",
    );
  }

  if (charCount < 30 && pagesToRead > 0) {
    warning =
      (warning ? `${warning} ` : "") +
      "Pouco texto detectado; o documento pode ser predominantemente imagem.";
  }

  if (text.length > MAX_CONTEXT_CHARS) {
    text =
      text.slice(0, MAX_CONTEXT_CHARS) + "\n[Conteúdo truncado — arquivo muito longo]";
    truncated = true;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    text,
    pageCount: pagesToRead,
    pagesRead: pagesToRead,
    totalPages,
    wordCount,
    truncated,
    warning,
  };
}
