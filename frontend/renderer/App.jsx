import { useCallback, useEffect, useState } from "react";
import ChatWindow from "./components/ChatWindow.jsx";
import InputBar from "./components/InputBar.jsx";
import ModelSelector from "./components/ModelSelector.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ThemeSelector from "./components/ThemeSelector.jsx";
import { useTheme } from "./context/ThemeContext.jsx";
import {
  clearSessionContext,
  deleteSession,
  getSession,
  getSessions,
  sendChat,
  setSessionContext,
} from "./api.js";

function enrichMessagesWithPdfAttachment(messages, contextFilename, contextText) {
  if (!contextFilename || !messages?.length) return messages;
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  if (firstUserIdx < 0) return messages;
  const wordCount = contextText
    ? contextText.split(/\s+/).filter(Boolean).length
    : null;
  return messages.map((m, i) => {
    if (i !== firstUserIdx || m.attachment) return m;
    return {
      ...m,
      attachment: { type: "pdf", filename: contextFilename, wordCount },
    };
  });
}

export default function App() {
  const { themes, themeId } = useTheme();
  const activeTheme = themes.find((t) => t.id === themeId);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama3");
  const [error, setError] = useState(null);

  const [contextText, setContextText] = useState("");
  const [contextFilename, setContextFilename] = useState("");
  const [contextPageCount, setContextPageCount] = useState(null);
  const [contextWordCount, setContextWordCount] = useState(null);
  const [contextWarning, setContextWarning] = useState(null);
  const [contextStatus, setContextStatus] = useState("idle");
  const [contextCommitted, setContextCommitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const clearDraftAttachment = useCallback(() => {
    setContextFilename("");
    setContextPageCount(null);
    setContextWordCount(null);
    setContextWarning(null);
    setContextStatus("idle");
  }, []);

  const clearContextState = useCallback(() => {
    setContextText("");
    clearDraftAttachment();
    setContextCommitted(false);
    setStatusMessage(null);
  }, [clearDraftAttachment]);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await getSessions());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setError(null);
    clearContextState();
  };

  const handleSelectSession = async (sessionId) => {
    try {
      setError(null);
      const data = await getSession(sessionId);
      setCurrentSessionId(data.id);
      setSelectedModel(data.model);

      let loadedMessages = data.messages;
      if (data.context_type === "pdf" && data.context_filename) {
        loadedMessages = enrichMessagesWithPdfAttachment(
          data.messages,
          data.context_filename,
          data.context_text,
        );
        setContextText(data.context_text || "");
        setContextCommitted(true);
      } else {
        setContextCommitted(false);
      }

      setMessages(loadedMessages);
      clearDraftAttachment();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Deseja apagar esta conversa?")) return;
    try {
      await deleteSession(sessionId);
      if (currentSessionId === sessionId) handleNewChat();
      await loadSessions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePdfExtracted = async (payload) => {
    if (contextCommitted) return;
    setContextText(payload.text);
    setContextFilename(payload.filename);
    setContextPageCount(payload.pageCount);
    setContextWordCount(payload.wordCount);
    setContextWarning(payload.warning ?? null);
    setContextStatus("ready");

    if (currentSessionId) {
      try {
        await setSessionContext(currentSessionId, {
          contextText: payload.text,
          contextFilename: payload.filename,
          contextType: "pdf",
        });
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleRemoveContext = async () => {
    if (contextCommitted) return;
    if (currentSessionId) {
      try {
        await clearSessionContext(currentSessionId);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setContextText("");
    clearDraftAttachment();
  };

  const handleSendMessage = async (text) => {
    if (contextStatus === "loading") return;
    setError(null);

    const hasDraftContext =
      !contextCommitted && contextStatus === "ready" && contextFilename && contextText;

    const attachmentForMessage = hasDraftContext
      ? {
          type: "pdf",
          filename: contextFilename,
          pageCount: contextPageCount,
          wordCount: contextWordCount,
        }
      : null;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      attachment: attachmentForMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (attachmentForMessage) {
      clearDraftAttachment();
      setContextCommitted(true);
    }
    setIsLoading(true);

    const isFirstMessage = messages.length === 0;
    const pendingContext =
      hasDraftContext && isFirstMessage && !currentSessionId ? contextText : null;

    try {
      const response = await sendChat({
        sessionId: currentSessionId,
        message: text,
        model: selectedModel,
        contextText: pendingContext,
        contextFilename: pendingContext ? contextFilename : undefined,
        contextType: pendingContext ? "pdf" : undefined,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: response.reply,
          created_at: new Date().toISOString(),
        },
      ]);

      if (!currentSessionId) setCurrentSessionId(response.session_id);
      await loadSessions();
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      if (attachmentForMessage) {
        setContextText(contextText);
        setContextFilename(contextFilename);
        setContextPageCount(contextPageCount);
        setContextWordCount(contextWordCount);
        setContextStatus("ready");
        setContextCommitted(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = (model) => {
    if (messages.length > 0 || contextStatus === "ready") {
      if (!window.confirm("Trocar de modelo iniciará uma nova conversa. Continuar?")) return;
      handleNewChat();
    }
    setSelectedModel(model);
  };

  const handlePdfProgress = (msg) => {
    if (msg) {
      setContextStatus("loading");
      setStatusMessage(msg);
    } else {
      setContextStatus((prev) => (prev === "loading" ? "idle" : prev));
      setStatusMessage(null);
    }
  };

  const inputDisabled = isLoading || contextStatus === "loading";

  const pendingAttachment =
    !contextCommitted && contextStatus === "ready" && contextFilename
      ? {
          type: "pdf",
          filename: contextFilename,
          pageCount: contextPageCount,
          wordCount: contextWordCount,
          warning: contextWarning,
        }
      : null;

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />
      <main className="main-area">
        <header className="chat-header">
          <div className="chat-header-left">
            <h1>Assistente IA Local</h1>
            <p>{activeTheme?.hint || "Chat local com Ollama"} · Fase 2: PDF</p>
          </div>
          <div className="header-controls">
            <ThemeSelector />
            <ModelSelector
              selectedModel={selectedModel}
              onChange={handleModelChange}
              disabled={messages.length > 0}
            />
          </div>
        </header>
        {error && <div className="error-banner">{error}</div>}
        <ChatWindow
          messages={messages}
          isLoading={isLoading}
          statusMessage={statusMessage}
          onSuggestionClick={handleSendMessage}
          suggestionDisabled={inputDisabled}
        />
        <InputBar
          onSend={handleSendMessage}
          isLoading={isLoading}
          disabled={inputDisabled}
          contextCommitted={contextCommitted}
          pendingAttachment={pendingAttachment}
          onPdfExtracted={handlePdfExtracted}
          onRemoveContext={handleRemoveContext}
          onPdfProgress={handlePdfProgress}
        />
      </main>
    </div>
  );
}
