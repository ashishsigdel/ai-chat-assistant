"use client";

import { useEffect, useRef, useState } from "react";
import { FaPaperPlane } from "react-icons/fa";
import MarkupRenderer from "@ashish-ui/markup-renderer";

type Message = {
  sender: "user" | "ai";
  content: string;
  timestamp: string;
};

export default function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      content: "Hello! I'm your AI assistant. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || isStreaming) return;

    const userMsg: Message = {
      sender: "user",
      content: message.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setIsStreaming(true);

    const typingIndicator: Message = {
      sender: "ai",
      content: "...",
      timestamp: "",
    };
    setMessages((prev) => [...prev, typingIndicator]);

    const source = new EventSource(
      `/api/generate?prompt=${encodeURIComponent(
        message
      )}&history=${encodeURIComponent(JSON.stringify(history))}`
    );

    let collectedData: string[] = [];

    source.onmessage = (event) => {
      if (event.data === "Stream started") return;
      if (event.data.trim()) {
        collectedData.push(event.data);
        updateLastMessage(collectedData.join(""));
      }
    };

    source.addEventListener("complete", (event) => {
      updateLastMessage(event.data);
    });

    source.addEventListener("end", (event) => {
      try {
        setHistory(JSON.parse(event.data));
      } catch {}
      finalizeLastMessage(collectedData.join(""));
      source.close();
    });

    source.onerror = () => {
      finalizeLastMessage(collectedData.join("") || "[Error occurred]");
      source.close();
    };
  };

  const updateLastMessage = (text: string) => {
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === prev.length - 1 ? { ...msg, content: text, timestamp: "" } : msg
      )
    );
  };

  const finalizeLastMessage = (text: string) => {
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === prev.length - 1
          ? {
              sender: "ai",
              content: text,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : msg
      )
    );
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-950 bg-center bg-no-repeat flex items-center justify-center px-4">
      <div className="w-full max-w-5xl h-[95vh] backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="text-center text-white font-semibold py-4 border-b border-white/10 text-lg">
          AI Assistant
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className="flex flex-col max-w-[90%]">
                <div
                  className={`px-4 py-2 rounded-2xl text-sm break-words max-w-full shadow-sm ${
                    msg.sender === "user"
                      ? "bg-blue-500/40 text-white rounded-br-md"
                      : "bg-white/30 text-white rounded-bl-md"
                  }`}
                >
                  <MarkupRenderer
                    content={msg.content}
                    isDark
                    noMarginInParagraphs
                  />
                </div>
                {msg.timestamp && (
                  <span className="text-[11px] mt-1 text-white/60">
                    {msg.timestamp}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-white/10 backdrop-blur-md">
          <div className="flex items-end gap-3">
            <textarea
              className="flex-1 resize-none rounded-xl px-4 py-3 text-sm bg-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              style={{ maxHeight: 120 }}
            />
            <button
              className={`w-12 h-12 flex items-center justify-center rounded-full text-white transition-all ${
                isStreaming
                  ? "bg-white/30 cursor-not-allowed"
                  : "bg-white/40 hover:bg-white/50"
              }`}
              onClick={handleSend}
              disabled={isStreaming}
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
