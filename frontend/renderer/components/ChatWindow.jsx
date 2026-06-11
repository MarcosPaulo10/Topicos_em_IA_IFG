import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import StatusBar from "./StatusBar.jsx";

const SUGGESTIONS = [
  "Olá! Como você pode me ajudar?",
  "Me chame de João e diga oi.",
  "Explique o que é inteligência artificial.",
];

export default function ChatWindow({
  messages,
  isLoading,
  onSuggestionClick,
  suggestionDisabled,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="chat-window">
      <div className="chat-window-inner">
        {messages.length === 0 && !isLoading && (
          <div className="welcome">
            <div className="welcome-card">
              <h2>Bem-vindo</h2>
              <p>
                Converse com LLaMA 3 ou Phi-3 localmente. Suas conversas ficam salvas
                no SQLite desta máquina.
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
