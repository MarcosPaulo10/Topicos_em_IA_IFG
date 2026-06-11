# Assistente de IA Local

Aplicativo desktop para conversar com modelos de linguagem locais (Phi-3 e LLaMA 3), com memória persistente de conversas.

**Fase atual:** v1.0 — Chat local

---

## Pré-requisitos

| Software | Versão mínima | Verificação |
|---|---|---|
| Python | 3.11+ | `py --version` |
| Node.js | 20 LTS+ | `node --version` |
| Ollama | latest | `ollama --version` |
| Git | qualquer | `git --version` |

### Hardware recomendado

- 8 GB RAM (16 GB para LLaMA 3)
- ~10 GB de disco livre
- Processador com 4+ núcleos

---

## Instalação

```powershell
git clone <url-do-repositorio>
cd IA_Local

ollama pull phi3
ollama pull llama3

cd backend
py -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env

cd ..\frontend
npm install
```

---

## Como executar

```powershell
cd frontend
npm run dev
```

Ou em dois terminais: backend (`uvicorn main:app --reload --port 8000`) + frontend (`npm run dev`).

Produção: `npm run build` e `npm start`.

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

---

## Estrutura

```
IA_Local/
├── backend/          ← FastAPI + SQLite + Ollama
├── frontend/         ← React + Electron
└── README.md
```

---

## Solução de problemas

| Problema | Solução |
|---|---|
| `Ollama não está acessível` | `ollama list` |
| `Modelo não encontrado` | `ollama pull phi3` ou `ollama pull llama3` |
| Resposta demora | Normal em CPU — aguarde até 120 segundos |

---

## Tags de entrega

```powershell
git tag v1.0
git push origin --tags
```
