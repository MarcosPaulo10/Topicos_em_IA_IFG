# Assistente de IA Local

**Fase atual:** v3.0 — Chat com PDF + Áudio

---

## Pré-requisitos

Python 3.11+, Node.js 20+, Ollama, **FFmpeg**, Git.

```powershell
ollama pull phi3
ollama pull llama3
winget install Gyan.FFmpeg
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

## Funcionalidades — Fases 1–3

- Fase 1: chat local, memória SQLite, sidebar, modelos Phi-3 / LLaMA 3
- Fase 2: upload de PDF (PDF.js no frontend)
- Fase 3: upload de áudio `.mp3` / `.mp4`, transcrição Whisper no backend

### Fluxo áudio

1. Ícone de microfone ou arraste `.mp3` / `.mp4`
2. **Transcrever** → aguarde (CPU pode demorar)
3. Envie a pergunta sobre a transcrição

---

## Tags

```powershell
git tag v3.0
git push origin --tags
```
