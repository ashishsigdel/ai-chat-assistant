"use client";

import { useEffect, useRef, useState } from "react";
import { FaPaperPlane, FaPlus, FaRobot } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

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
      timestamp: "", // don't generate time here
    },
  ]);
  const [message, setMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add timestamp on client after mount
  useEffect(() => {
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === 0 && msg.timestamp === ""
          ? {
              ...msg,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : msg
      )
    );
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

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

    // Add typing indicator
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
      } catch {
        // fail silently
      }
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

  const startNewChat = () => {
    setMessages([
      {
        sender: "ai",
        content: "Hello! I'm your AI assistant. How can I help you today?",
        timestamp: "", // don't include timestamp initially
      },
    ]);
    setHistory([]);
    setMessage("");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-72 bg-[#1a1a2e] text-white p-5 flex flex-col">
        <div className="flex items-center mb-6 border-b border-white/20 pb-4">
          <div className="bg-white text-[#4361ee] rounded-full w-10 h-10 flex items-center justify-center text-xl">
            <FaRobot />
          </div>
          <h1 className="text-lg font-semibold ml-3">AI Assistant</h1>
        </div>
        <button
          onClick={startNewChat}
          className="bg-[#4361ee] hover:bg-[#4895ef] transition-all rounded-md px-4 py-2 flex items-center justify-center space-x-2 text-white font-medium"
        >
          <FaPlus />
          <span>New Chat</span>
        </button>
      </div>

      {/* Chat area */}
      <div className="flex flex-col flex-1 bg-white">
        <div className="border-b px-6 py-4 text-lg font-semibold text-gray-700 bg-white">
          AI Assistant
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`px-4 py-2 rounded-lg shadow-sm max-w-[80%] whitespace-pre-wrap ${
                  msg.sender === "user"
                    ? "bg-blue-100 text-gray-800 rounded-br-sm"
                    : "bg-white text-gray-800 rounded-bl-sm"
                }`}
              >
                <ReactMarkdown
                  rehypePlugins={[rehypeSanitize]}
                  children={msg.content}
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} className="text-blue-500 underline" />
                    ),
                  }}
                />
              </div>
              {msg.timestamp && (
                <span className="text-xs text-gray-500 mt-1">
                  {msg.timestamp}
                </span>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t p-4 bg-white flex">
          <textarea
            className="flex-1 resize-none border rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-[#4361ee] transition-all text-sm text-gray-600"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ maxHeight: 120 }}
          />
          <button
            className={`ml-3 w-12 h-12 flex items-center justify-center rounded-full transition-all ${
              isStreaming
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#4361ee] hover:bg-[#4895ef]"
            } text-white`}
            onClick={handleSend}
            disabled={isStreaming}
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
}
