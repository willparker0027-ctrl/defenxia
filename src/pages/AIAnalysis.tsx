import { useState } from "react";
import { Send, Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { invokeEdgeFunction } from "@/lib/supabase-client";
import { getPersonalKnowledgeAnswer } from "@/lib/personal-knowledge";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const AIAnalysis = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI security analyst. I can help you with cybersecurity questions, threat analysis, and security best practices. How can I assist you today?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Personal knowledge first — instant answer, no AI call needed
    const personalAnswer = getPersonalKnowledgeAnswer(inputMessage);
    if (personalAnswer) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: personalAnswer,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await invokeEdgeFunction('ai-analysis', {
        message: inputMessage
      });

      if (error) {
        throw new Error(error.message || 'Failed to get AI response');
      }

      const aiResponse = data?.response || 'I apologize, but I encountered an error processing your request.';

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      // Fallback response when API is not available
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but the AI service is currently unavailable. Please ensure the Gemini API key is configured properly.',
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackMessage]);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendDisabled = !inputMessage.trim() || isLoading;

  return (
    <div className="tpage animate-fade-in">
      <span className="eyebrow">DEFENXIA · AI</span>
      <h1 className="serif">AI Security Analysis.</h1>
      <p className="tsub">Get intelligent insights on cybersecurity threats and best practices</p>

      <div className="glass tcard" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "22px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p className="clabel" style={{ margin: 0 }}>Security analyst</p>
          <span className="chip"><span className="dot" />AI · Online</span>
        </div>

        <ScrollArea style={{ height: "54vh", minHeight: 320 }}>
          <div style={{ padding: "4px 22px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{ display: "flex", justifyContent: message.sender === 'user' ? "flex-end" : "flex-start" }}
              >
                <div style={{
                  display: "flex",
                  gap: 12,
                  maxWidth: "85%",
                  flexDirection: message.sender === 'user' ? "row-reverse" : "row"
                }}>
                  <div className="glass glass-pill w-9 h-9 shrink-0 flex items-center justify-center">
                    {message.sender === 'ai' ? (
                      <Bot size={16} className="text-lav" />
                    ) : (
                      <User size={16} className="text-lav" />
                    )}
                  </div>
                  <div
                    className={
                      message.sender === 'ai'
                        ? 'glass glass-tool px-5 py-4'
                        : 'bg-magenta/15 border border-magenta/30 rounded-3xl px-5 py-4'
                    }
                  >
                    <p className="text-sm whitespace-pre-wrap text-ink">{message.content}</p>
                    <p className="text-xs text-faint mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-start" }}>
                <div className="glass glass-pill w-9 h-9 shrink-0 flex items-center justify-center">
                  <Bot size={16} className="text-lav" />
                </div>
                <div className="glass glass-tool px-5 py-4">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-lav rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-lav rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-lav rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div style={{
          borderTop: "1px solid rgba(205,194,247,.08)",
          padding: "16px 18px",
          display: "flex",
          gap: 12,
          alignItems: "center"
        }}>
          <div style={{ flex: 1 }}>
            <input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about security threats, best practices, or get a vulnerability analysis..."
              disabled={isLoading}
              className="field"
              aria-label="Message the AI security analyst"
            />
          </div>
          <button
            type="button"
            onClick={sendMessage}
            disabled={sendDisabled}
            aria-label="Send message"
            className="glass glass-pill shrink-0 flex items-center justify-center"
            style={{ width: 54, height: 54, opacity: sendDisabled ? 0.4 : 1 }}
          >
            <Send size={18} className="text-lav" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysis;
