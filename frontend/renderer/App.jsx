import { useCallback, useEffect, useState } from "react";
import ChatWindow from "./components/ChatWindow.jsx";
import InputBar from "./components/InputBar.jsx";
import ModelSelector from "./components/ModelSelector.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ThemeSelector from "./components/ThemeSelector.jsx";
import { useTheme } from "./context/ThemeContext.jsx";
import { deleteSession, getSession, getSessions, sendChat } from "./api.js";

export default function App() {
  const { themes, themeId } = useTheme();
  const activeTheme = themes.find((t) => t.id === themeId);

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama3");
  const [error, setError] = useState(null);

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
  };

  const handleSelectSession = async (sessionId) => {
    try {
      setError(null);
      const data = await getSession(sessionId);
      setCurrentSessionId(data.id);
      setSelectedModel(data.model);
      setMessages(data.messages);
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

  const handleSendMessage = async (text) => {
    setError(null);

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendChat({
        sessionId: currentSessionId,
        message: text,
        model: selectedModel,
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelChange = (model) => {
    if (messages.length > 0) {
      if (!window.confirm("Trocar de modelo iniciará uma nova conversa. Continuar?")) {
        return;
      }
      handleNewChat();
    }
    setSelectedModel(model);
  };

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
            <p>{activeTheme?.hint || "Chat local com Ollama"} · Fase 1</p>
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
          onSuggestionClick={handleSendMessage}
          suggestionDisabled={isLoading}
        />
        <InputBar onSend={handleSendMessage} isLoading={isLoading} disabled={isLoading} />
      </main>
    </div>
  );
}
