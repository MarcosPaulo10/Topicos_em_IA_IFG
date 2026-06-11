# Assistente de IA Local

Aplicativo desktop para conversar com modelos de linguagem locais (Phi-3 e LLaMA 3), com memória persistente de conversas.

**Fase atual:** v4.0 — Chat com PDF + Áudio + Vídeo

---

## Pré-requisitos

Instale uma vez na máquina:

| Software | Versão mínima | Verificação |
|---|---|---|
| Python | 3.11+ | `py --version` |
| Node.js | 20 LTS+ | `node --version` |
| Ollama | latest | `ollama --version` |
| FFmpeg | latest | `ffmpeg -version` |
| Git | qualquer | `git --version` |

### Hardware recomendado

- 8 GB RAM (16 GB para LLaMA 3)
- ~10 GB de disco livre (modelos + dependências)
- Processador com 4+ núcleos

---

## Instalação

### 1. Clonar o repositório

```powershell
git clone <url-do-repositorio>
cd IA_Local
```

### 2. Instalar e baixar modelos Ollama

```powershell
ollama pull phi3
ollama pull llama3
```

Verifique: `ollama list`

### 3. Backend Python

```powershell
cd backend
py -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

O arquivo `.env` já vem com valores padrão. Ajuste se necessário:

```
APP_PORT=8000
DATABASE_URL=sqlite:///./data/chat.db
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=phi3
MAX_HISTORY_MESSAGES=20
MAX_CONTEXT_TOKENS=3000
```

### 4. FFmpeg (obrigatório para áudio — Fase 3)

O Whisper usa o FFmpeg para decodificar áudio. No Windows, instale e adicione ao PATH:

```powershell
winget install Gyan.FFmpeg
```

Reabra o terminal e verifique: `ffmpeg -version`

### 5. Frontend (React + Electron)

```powershell
cd frontend
npm install
```

---

## Como executar

### Modo desenvolvimento (um comando só)

```powershell
cd frontend
npm run dev
```

Isso sobe **backend (8000) + React (5173) + Electron** juntos. Não precisa abrir outro terminal.

### Modo desenvolvimento (dois terminais — opcional)

**Terminal 1 — Backend:**
```powershell
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev:vite
npm run dev:app
```

### Modo produção (app desktop inicia o backend sozinho)

```powershell
cd frontend
npm run build
npm start
```

O app desktop inicia o FastAPI automaticamente e aguarda o endpoint `/health` antes de abrir a janela.

---

## Funcionalidades — Fase 1

- Chat com Phi-3 Mini ou LLaMA 3 via Ollama (100% local)
- Memória persistente de conversas (SQLite)
- Detecção automática do nome do usuário
- Sidebar com histórico de sessões
- Nova conversa, retomar e apagar sessões
- Indicador visual "Pensando..." durante respostas
- Seletor de modelo (fixo por sessão)
- 3 temas visuais (Museum, Glass, Future)

## Funcionalidades — Fase 2

- Upload de PDF na interface (extração local com PDF.js — arquivo não vai ao servidor)
- Badge com nome do arquivo, páginas e palavras extraídas
- Limite de 10 páginas + truncamento de texto longo
- Contexto do PDF injetado no prompt da IA
- Sessões com PDF marcadas com ícone na sidebar
- Remover PDF do contexto antes de enviar mensagens

### Fluxo PDF

1. **Arraste um PDF** na caixa de mensagem ou use o **ícone de clipe** para anexar
2. Aguarde a extração (progresso por página)
3. Envie uma pergunta sobre o documento
4. A IA usa o texto extraído como contexto da sessão

## Funcionalidades — Fase 3

- Upload de áudio `.mp3` ou `.mp4` (transcrição local via Whisper no backend)
- Botão de microfone no composer, separado do PDF
- Fluxo: selecionar arquivo → **Transcrever** → preview das primeiras linhas → enviar pergunta
- Contexto de áudio salvo na sessão (`context_type: audio`)
- Sessões com áudio marcadas com ícone de microfone na sidebar
- Arquivos temporários removidos após transcrição
- Modelo Whisper `small` carregado em background ao iniciar o backend

### Fluxo áudio

1. Clique no ícone de **microfone** ou arraste `.mp3` / `.mp4`
2. Confirme com **Transcrever** (pode levar minutos em CPU)
3. Revise o preview (idioma + palavras)
4. Envie a pergunta — o anexo aparece na sua mensagem; a IA usa a transcrição

### Dependências extras do backend (Fase 3)

Com o venv ativado:

```powershell
cd backend
pip install -r requirements.txt
```

Na primeira execução, o Whisper baixa o modelo `small` (~461 MB) para `~/.cache/whisper/`.

## Funcionalidades — Fase 4

- Upload de vídeo `.mp4` (até 500 MB)
- Extração de áudio com FFmpeg no backend → transcrição com Whisper
- Progresso em duas etapas: envio → extração → transcrição
- Contexto salvo como `context_type: video` na sessão
- Ícone de câmera na sidebar para conversas com vídeo
- Vídeo temporário removido após extração do áudio

### Fluxo vídeo

1. Ícone de **câmera** ou arraste um `.mp4`
2. **Processar vídeo** → aguarde envio, extração e transcrição
3. Revise o preview e envie sua pergunta

Recomendado: vídeos de até **15 minutos** para tempo de processamento razoável em CPU.

---

## Estrutura do projeto

```
IA_Local/
├── backend/          ← FastAPI + SQLite + Ollama
├── frontend/         ← React (interface) + Electron (janela desktop)
└── README.md
```

---

## Solução de problemas

| Problema | Solução |
|---|---|
| `Ollama não está acessível` | Verifique se o Ollama está rodando: `ollama list` |
| `Modelo não encontrado` | Baixe o modelo: `ollama pull phi3` ou `ollama pull llama3` |
| `python` não reconhecido | Use `py` no Windows: `py -m venv venv` |
| Backend não sobe no app | Confirme que `backend/venv/Scripts/python.exe` existe |
| Resposta demora muito | Normal em CPU — aguarde até 120 segundos |
| Transcrição falha | Instale FFmpeg e reinicie o backend |
| `Serviço de transcrição indisponível` | Rode `pip install openai-whisper` no venv do backend |

---

## Próximas fases

| Fase | Tag | Funcionalidade |
|---|---|---|
| 2 | v2.0 | Chat com PDF ✓ |
| 3 | v3.0 | Chat com áudio (Whisper) ✓ |
| 4 | v4.0 | Chat com vídeo (FFmpeg + Whisper) ✓ |

---

## Tags de entrega

```powershell
git tag v1.0
git push origin --tags
```
