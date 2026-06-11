function formatRelativeDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  return date.toLocaleDateString("pt-BR");
}

const MODEL_LABELS = {
  phi3: "Phi-3",
  llama3: "LLaMA 3",
};

const CONTEXT_ICONS = {
  pdf: "📄",
  audio: "🎤",
  video: "🎥",
  chat: "",
};

function contextIcon(type) {
  return CONTEXT_ICONS[type] || "";
}

export default function Sidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>Conversas</h2>
        <p>Histórico local · SQLite</p>
      </div>
      <button type="button" className="btn-new-chat" onClick={onNewChat}>
        + Nova conversa
      </button>
      <div className="session-list">
        {sessions.length === 0 && (
          <p className="empty-sessions">Nenhuma conversa ainda. Comece uma nova acima.</p>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${session.id === currentSessionId ? "active" : ""}`}
          >
            <button
              type="button"
              className="session-button"
              onClick={() => onSelectSession(session.id)}
            >
              <span className="session-title">
                {contextIcon(session.context_type) && (
                  <span className="session-context-icon" title={session.context_type}>
                    {contextIcon(session.context_type)}
                  </span>
                )}
                {session.title}
              </span>
              <span className="session-meta">
                {MODEL_LABELS[session.model] || session.model} ·{" "}
                {formatRelativeDate(session.updated_at)}
              </span>
            </button>
            <button
              type="button"
              className="btn-delete"
              title="Apagar conversa"
              onClick={() => onDeleteSession(session.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
