import ReactMarkdown from "react-markdown";

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function MessageAttachment({ attachment }) {
  if (!attachment || attachment.type !== "pdf") return null;
  return (
    <div className="message-attachment">
      <span className="message-attachment-icon">PDF</span>
      <div className="message-attachment-info">
        <span className="message-attachment-name">{attachment.filename}</span>
        <span className="message-attachment-meta">
          {attachment.pageCount != null && `${attachment.pageCount} páginas`}
          {attachment.wordCount != null &&
            ` · ${attachment.wordCount.toLocaleString("pt-BR")} palavras`}
        </span>
      </div>
    </div>
  );
}

export default function MessageBubble({ role, content, created_at, attachment }) {
  const isUser = role === "user";

  return (
    <div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
      {!isUser && <div className="avatar">IA</div>}
      <div className="bubble-content">
        {attachment && <MessageAttachment attachment={attachment} />}
        {isUser ? <p>{content}</p> : <ReactMarkdown>{content}</ReactMarkdown>}
        <span className="message-time">{formatTime(created_at)}</span>
      </div>
    </div>
  );
}
