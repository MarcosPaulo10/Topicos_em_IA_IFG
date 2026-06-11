# Assistente de IA Local

**Fase atual:** v2.0 — Chat com PDF

Aplicativo desktop para conversar com Phi-3 / LLaMA 3 localmente, com memória persistente e suporte a PDF.

---

## Pré-requisitos

Python 3.11+, Node.js 20+, Ollama, Git.

```powershell
ollama pull phi3
ollama pull llama3
```

---

## Instalação

```powershell
cd backend
py -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env

cd ..\frontend
npm install
```

---

## Executar

```powershell
cd frontend
npm run dev
```

---

## Funcionalidades — Fase 1

- Chat local, memória SQLite, sidebar, seletor de modelo, 3 temas

## Funcionalidades — Fase 2

- Upload de PDF (extração local com PDF.js)
- Badge com páginas e palavras
- Limite de 10 páginas + truncamento
- Contexto do PDF no prompt da IA
- Ícone de PDF na sidebar

### Fluxo PDF

1. Clipe ou arraste um PDF
2. Aguarde a extração
3. Envie uma pergunta sobre o documento

---

## Tags

```powershell
git tag v2.0
git push origin --tags
```
