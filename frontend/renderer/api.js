const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Backend indisponível");
  return res.json();
}

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

export async function sendChat({ sessionId, message, model }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        message,
        model,
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = data.detail || "Erro ao enviar mensagem";
      throw new Error(detail);
    }

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
