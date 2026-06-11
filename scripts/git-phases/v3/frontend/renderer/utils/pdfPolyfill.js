/**
 * PDF.js v5+ usa Uint8Array.prototype.toHex — ainda não disponível em todos os Chromium/Electron.
 * Deve ser importado antes de pdfjs-dist.
 */
if (typeof Uint8Array.prototype.toHex !== "function") {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    value() {
      return Array.from(this, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    writable: true,
    configurable: true,
  });
}

if (typeof Uint8Array.fromBase64 !== "function") {
  Uint8Array.fromBase64 = (str) => {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };
}
