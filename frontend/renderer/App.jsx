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

function enrichMessagesWithContextAttachment(
  messages,
  contextType,
  contextFilename,
  contextText,
  extra = {},
) {
  if (!contextFilename || !messages?.length) return messages;

  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  if (firstUserIdx < 0) return messages;

  const wordCount = contextText
    ? contextText.split(/\s+/).filter(Boolean).length
    : extra.wordCount ?? null;

  return messages.map((m, i) => {
    if (i !== firstUserIdx || m.attachment) return m;
    return {
      ...m,
      attachment: {
        type: contextType,
        filename: contextFilename,
        wordCount,
        language: extra.language,
        durationSeconds: extra.durationSeconds,
      },
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
  const [contextKind, setContextKind] = useState(null);
  const [contextPageCount, setContextPageCount] = useState(null);
  const [contextWordCount, setContextWordCount] = useState(null);
  const [contextLanguage, setContextLanguage] = useState(null);
  const [contextPreviewLines, setContextPreviewLines] = useState([]);
  const [contextDurationSeconds, setContextDurationSeconds] = useState(null);
  const [contextWarning, setContextWarning] = useState(null);
  const [contextStatus, setContextStatus] = useState("idle");
  const [contextCommitted, setContextCommitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const clearDraftAttachment = useCallback(() => {
    setContextFilename("");
    setContextPageCount(null);
    setContextWordCount(null);
    setContextLanguage(null);
    setContextPreviewLines([]);
    setContextDurationSeconds(null);
    setContextWarning(null);
    setContextKind(null);
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
      const data = await getSessions();
      setSessions(data);
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
      if (
        (data.context_type === "pdf" || data.context_type === "audio") &&
        data.context_filename
      ) {
        loadedMessages = enrichMessagesWithContextAttachment(
          data.messages,
          data.context_type,
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
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      await loadSessions();
    } catch (err) {
      setError(err.message);
    }
  };

  const applyContextReady = async ({
    type,
    text,
    filename,
    pageCount,
    wordCount,
    language,
    previewLines,
    warning,
    durationSeconds,
  }) => {
    if (contextCommitted) return;

    setContextText(text);
    setContextFilename(filename);
    setContextKind(type);
    setContextPageCount(pageCount ?? null);
    setContextWordCount(wordCount ?? null);
    setContextLanguage(language ?? null);
    setContextPreviewLines(previewLines ?? []);
    setContextDurationSeconds(durationSeconds ?? null);
    setContextWarning(warning ?? null);
    setContextStatus("ready");

    if (currentSessionId) {
      try {
        await setSessionContext(currentSessionId, {
          contextText: text,
          contextFilename: filename,
          contextType: type,
        });
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handlePdfExtracted = (payload) => {
    applyContextReady({
      type: "pdf",
      text: payload.text,
      filename: payload.filename,
      pageCount: payload.pageCount,
      wordCount: payload.wordCount,
      warning: payload.warning,
    });
  };

  const handleAudioTranscribed = (payload) => {
    applyContextReady({
      type: "audio",
      text: payload.text,
      filename: payload.filename,
      wordCount: payload.wordCount,
      language: payload.language,
      previewLines: payload.previewLines,
      warning: payload.warning,
    });
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
    if (contextStatus === "loading" || contextStatus === "transcribing") {
      return;
    }

    setError(null);

    const hasDraftContext =
      !contextCommitted && contextStatus === "ready" && contextFilename && contextText;

    const attachmentForMessage = hasDraftContext
      ? {
          type: contextKind,
          filename: contextFilename,
          pageCount: contextPageCount,
          wordCount: contextWordCount,
          language: contextLanguage,
          durationSeconds: contextDurationSeconds,
        }
      : null;

    const contextTextForApi = hasDraftContext ? contextText : null;
    const contextFilenameForApi = hasDraftContext ? contextFilename : undefined;
    const contextTypeForApi = hasDraftContext ? contextKind : undefined;

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
      contextTextForApi && isFirstMessage && !currentSessionId ? contextTextForApi : null;

    try {
      const response = await sendChat({
        sessionId: currentSessionId,
        message: text,
        model: selectedModel,
        contextText: pendingContext,
        contextFilename: pendingContext ? contextFilenameForApi : undefined,
        contextType: pendingContext ? contextTypeForApi : undefined,
      });

      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (!currentSessionId) {
        setCurrentSessionId(response.session_id);
      }

      await loadSessions();
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      if (attachmentForMessage) {
        setContextText(contextTextForApi);
        setContextFilename(contextFilenameForApi);
        setContextKind(contextTypeForApi);
        setContextPageCount(attachmentForMessage.pageCount);
        setContextWordCount(attachmentForMessage.wordCount);
        setContextLanguage(attachmentForMessage.language);
        setContextStatus("ready");
        setContextCommitted(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = (model) => {
    if (messages.length > 0 || contextStatus === "ready") {
      if (!window.confirm("Trocar de modelo iniciará uma nova conversa. Continuar?")) {
        return;
      }
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

  const handleAudioProgress = (msg) => {
    if (msg) {
      setContextStatus("transcribing");
      setStatusMessage(msg);
    } else if (contextStatus === "transcribing") {
      setContextStatus("idle");
      setStatusMessage(null);
    }
  };

  const inputDisabled =
    isLoading ||
    contextStatus === "loading" ||
    contextStatus === "transcribing";

  const pendingAttachment =
    !contextCommitted && contextStatus === "ready" && contextFilename
      ? {
          type: contextKind,
          filename: contextFilename,
          pageCount: contextPageCount,
          wordCount: contextWordCount,
          language: contextLanguage,
          previewLines: contextPreviewLines,
          durationSeconds: contextDurationSeconds,
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
            <p>{activeTheme?.hint || "Chat local com Ollama"} · Fase 3: PDF + Áudio</p>
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
          onAudioTranscribed={handleAudioTranscribed}
          onRemoveContext={handleRemoveContext}
          onPdfProgress={handlePdfProgress}
          onAudioProgress={handleAudioProgress}
        />
      </main>
    </div>
  );
}
