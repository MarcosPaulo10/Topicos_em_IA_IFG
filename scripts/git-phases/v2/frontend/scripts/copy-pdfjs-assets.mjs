import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dest = path.join(root, "renderer", "public", "pdfjs");

const copies = [
  ["node_modules/pdfjs-dist/cmaps", "cmaps"],
  ["node_modules/pdfjs-dist/standard_fonts", "standard_fonts"],
];

for (const [srcRel, destSub] of copies) {
  const src = path.join(root, srcRel);
  const target = path.join(dest, destSub);
  if (!fs.existsSync(src)) {
    console.warn(`Aviso: ${src} não encontrado. Rode npm install.`);
    continue;
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(src, target, { recursive: true });
  console.log(`Copiado: ${destSub}`);
}

console.log("Assets PDF.js prontos em renderer/public/pdfjs/");
