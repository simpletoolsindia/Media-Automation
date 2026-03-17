"use client";

import { useState, useRef, useEffect } from "react";
import { Send, RotateCcw, Bot, User } from "lucide-react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your AI media assistant powered by Claude. Tell me what you want to download, organize, or manage. For example:\n\n• \"Download Interstellar\"\n• \"Search for Breaking Bad\"\n• \"Organize my downloads\"\n• \"Scan my Jellyfin library\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      await api.sendChatMessage(userMsg.content, (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + chunk }
              : m
          )
        );
      });
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Error: Could not connect to AI agent. Please check your configuration." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = async () => {
    await api.resetChat();
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Conversation reset. How can I help you?",
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === "assistant" ? "bg-accent-500" : "bg-dark-600"
            }`}>
              {msg.role === "assistant" ? (
                <Bot size={16} className="text-white" />
              ) : (
                <User size={16} className="text-white" />
              )}
            </div>
            <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : ""}`}>
              <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "assistant"
                  ? "bg-dark-700 text-slate-200"
                  : "bg-accent-500 text-white"
              }`}>
                {msg.content || (
                  <span className="animate-pulse text-slate-400">Thinking...</span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-dark-700">
        <div className="flex gap-2">
          <button
            onClick={resetChat}
            className="p-2.5 text-slate-500 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            title="Reset conversation"
          >
            <RotateCcw size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask me to download, search, or organize media..."
            className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-500 transition-colors"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
