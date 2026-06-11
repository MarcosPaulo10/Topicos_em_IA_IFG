import ReactMarkdown from "react-markdown";

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({ role, content, created_at }) {
  const isUser = role === "user";

  return (
    <div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
      {!isUser && <div className="avatar">IA</div>}
      <div className="bubble-content">
        {isUser ? (
          <p>{content}</p>
        ) : (
          <ReactMarkdown>{content}</ReactMarkdown>
        )}
        <span className="message-time">{formatTime(created_at)}</span>
      </div>
    </div>
  );
}
