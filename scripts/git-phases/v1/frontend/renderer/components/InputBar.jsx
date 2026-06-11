import { useCallback, useEffect, useRef, useState } from "react";

const MIN_HEIGHT = 88;
const MAX_HEIGHT = 220;

export default function InputBar({ onSend, isLoading, disabled }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  const blocked = disabled || isLoading;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  useEffect(() => {
    if (!blocked) {
      textareaRef.current?.focus();
    }
  }, [blocked]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || blocked) return;
    onSend(trimmed);
    setText("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;
        textareaRef.current.focus();
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="input-bar">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mensagem… Shift+Enter quebra linha"
            rows={3}
            style={{ minHeight: MIN_HEIGHT, height: MIN_HEIGHT }}
            autoFocus
          />
        </div>
        <div className="composer-footer">
          <span className="composer-hint">Enter envia · Shift+Enter quebra linha</span>
          <button
            type="button"
            className="btn-send"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSubmit}
            disabled={blocked || !text.trim()}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
