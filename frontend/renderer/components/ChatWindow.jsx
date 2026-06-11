import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import StatusBar from "./StatusBar.jsx";

const SUGGESTIONS = [
  "Olá! Como você pode me ajudar?",
  "Qual é o tema principal deste documento?",
  "Resuma o conteúdo em tópicos.",
];

export default function ChatWindow({
  messages,
  isLoading,
  statusMessage,
  onSuggestionClick,
  suggestionDisabled,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, statusMessage]);

  return (
    <div className="chat-window">
      <div className="chat-window-inner">
        {statusMessage && !isLoading && (
          <div className="pdf-status-banner">{statusMessage}</div>
        )}
        {messages.length === 0 && !isLoading && !statusMessage && (
          <div className="welcome">
            <div className="welcome-card">
              <h2>Bem-vindo</h2>
              <p>
                Converse com LLaMA 3 ou Phi-3 localmente. Anexe PDF ou áudio (.mp3)
                para perguntar sobre o conteúdo.
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => onSuggestionClick?.(s)}
                    disabled={suggestionDisabled}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="messages">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} {...msg} />
          ))}
          {isLoading && <StatusBar />}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
