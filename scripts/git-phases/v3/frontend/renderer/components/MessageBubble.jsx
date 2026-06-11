import ReactMarkdown from "react-markdown";
import { formatDuration } from "../utils/formatDuration.js";
import { languageLabel } from "../utils/languageLabels.js";

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function MessageAttachment({ attachment }) {
  if (!attachment) return null;

  const icons = { pdf: "PDF", audio: "ÁUDIO", video: "VÍDEO" };
  const icon = icons[attachment.type];
  if (!icon) return null;

  const isPdf = attachment.type === "pdf";
  const isMedia = attachment.type === "audio" || attachment.type === "video";
  const duration = formatDuration(attachment.durationSeconds);

  return (
    <div className="message-attachment">
      <span className="message-attachment-icon">{icon}</span>
      <div className="message-attachment-info">
        <span className="message-attachment-name">{attachment.filename}</span>
        <span className="message-attachment-meta">
          {isPdf && attachment.pageCount != null && `${attachment.pageCount} páginas`}
          {isMedia && attachment.language && languageLabel(attachment.language)}
          {duration && ` · ${duration}`}
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
