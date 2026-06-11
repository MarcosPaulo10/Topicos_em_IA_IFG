const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function getSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error("Erro ao carregar sessões");
  return res.json();
}

export async function getSession(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Sessão não encontrada");
  return res.json();
}

export async function deleteSession(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Erro ao deletar sessão");
}

export async function setSessionContext(sessionId, { contextText, contextFilename, contextType = "pdf" }) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context_type: contextType,
      context_text: contextText,
      context_filename: contextFilename,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Erro ao salvar contexto");
  }
  return res.json();
}

export async function clearSessionContext(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/context`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error("Erro ao remover contexto");
}

export async function sendChat({ sessionId, message, model, contextText, contextFilename, contextType }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  const body = { session_id: sessionId, message, model };
  if (contextText) {
    body.context_text = contextText;
    body.context_filename = contextFilename;
    body.context_type = contextType || "pdf";
  }

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Erro ao enviar mensagem");
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Tempo de resposta excedido. Tente novamente.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
