const LABELS = {
  pt: "Português",
  en: "Inglês",
  es: "Espanhol",
  fr: "Francês",
  de: "Alemão",
  it: "Italiano",
  ja: "Japonês",
  zh: "Chinês",
};

export function languageLabel(code) {
  if (!code) return "Desconhecido";
  const key = code.toLowerCase().slice(0, 2);
  return LABELS[key] || code.toUpperCase();
}
