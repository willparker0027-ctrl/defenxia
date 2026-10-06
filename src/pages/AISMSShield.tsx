import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IconShieldCheck, IconArrow, IconBack } from "@/components/mockup/icons";
import { invokeEdgeFunction } from "@/lib/supabase-client";
import { getPersonalKnowledgeAnswer } from "@/lib/personal-knowledge";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface SMSScanResult {
  text: string;
  isFraud: boolean;
  keywords: string[];
  severity: 'safe' | 'warning' | 'critical';
  analysis: string;
}

const FRAUD_KEYWORDS = [
  'kyc', 'otp', 'verify your account', 'link expired', 'update kyc',
  'your account will be blocked', 'share otp', 'click here immediately',
  'pan card', 'aadhar', 'bank account suspended', 'urgent action',
  'lottery', 'prize', 'won', 'claim now', 'act now', 'limited time',
  'pin number', 'cvv', 'card number', 'transfer money', 'upi pin',
  'send money', 'loan approved', 'credit card blocked', 'atm blocked',
  'debit card', 'account deactivated', 'reactivate', 'expire today'
];

export function analyzeIncomingSMS(smsText: string): SMSScanResult {
  const lowerText = smsText.toLowerCase();
  const foundKeywords = FRAUD_KEYWORDS.filter(kw => lowerText.includes(kw));
  const isFraud = foundKeywords.length > 0;

  let severity: 'safe' | 'warning' | 'critical' = 'safe';
  if (foundKeywords.length >= 3) severity = 'critical';
  else if (foundKeywords.length >= 1) severity = 'warning';

  let analysis = '';
  if (severity === 'critical') {
    analysis = 'CRITICAL SCAM DETECTED! This message contains multiple fraud indicators targeting your banking credentials. DO NOT respond or click any links.';
  } else if (severity === 'warning') {
    analysis = 'Suspicious message detected. This may be a phishing attempt. Verify with your bank directly before taking any action.';
  } else {
    analysis = 'Message appears safe. No known fraud patterns detected.';
  }

  return { text: smsText, isFraud, keywords: foundKeywords, severity, analysis };
}

// Offline fallback: rule-based security guidance used when the AI edge
// function is unreachable or returns no response.
function getIntelligentSecurityAdvice(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('sms') || q.includes('message') || q.includes('text')) {
    return "Never click links in SMS claiming your bank account or electricity is blocked. Official banks will never send short URLs (like bit.ly) or ask for personal details via SMS. You can report spam SMS to 1909 or call 1930 for financial cyber fraud.";
  }
  if (q.includes('upi') || q.includes('qr') || q.includes('pin')) {
    return "Remember: Your UPI PIN is only entered to SEND money, never to RECEIVE money. Do not scan QR codes or approve collect requests from unknown buyers/sellers.";
  }
  if (q.includes('kyc') || q.includes('pan') || q.includes('bank')) {
    return "Banks never ask for OTPs, passwords, or CVV to update your KYC over phone calls or SMS. If in doubt, visit your official branch or use your authentic mobile banking app.";
  }
  return "For any cyber fraud or suspicious banking activity, immediately call the National Cyber Crime Helpline at 1930 (Toll-Free 24/7) or lodge a report on cybercrime.gov.in.";
}

const AISMSShield = () => {
  const navigate = useNavigate();
  // AI Chatbot state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI security analyst for rural banking. I can help you with cybersecurity questions, SMS fraud detection, and banking security best practices. How can I assist you today?',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Full-screen chat mode: hide the bottom nav and lock body scroll while
  // the chatbot is open; always clean up on unmount.
  useEffect(() => {
    document.body.classList.add('chat-open');
    return () => {
      document.body.classList.remove('chat-open');
    };
  }, []);

  // Auto-scroll the conversation pane to the newest message
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  // Back from the chatbot always returns to the home page.
  const closeChat = () => navigate("/");

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    const currentText = inputMessage;
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Personal knowledge first — instant answer, no AI call needed
    const personalAnswer = getPersonalKnowledgeAnswer(currentText);
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
      const { data, error } = await invokeEdgeFunction<{ response?: string }>('ai-analysis', {
        message: currentText
      });

      let aiResponse = data?.response;
      if (!aiResponse || error) {
        aiResponse = getIntelligentSecurityAdvice(currentText);
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch {
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: getIntelligentSecurityAdvice(currentText),
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

  // ---- Full-screen ChatGPT-style chatbot ----
  return (
    <div className="chat-full">
      <header className="chat-header">
        <button type="button" onClick={closeChat} className="circle-btn" aria-label="Close chat">
          <IconBack />
        </button>
        <div className="chat-title">
          <span className="eyebrow">AI SMS Shield</span>
          <h1 className="serif">AI Analyst.</h1>
        </div>
        <div className="ticon chat-head-avatar" aria-hidden="true">
          <IconShieldCheck />
        </div>
      </header>

      <div ref={listRef} className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`chat-row ${message.sender}`}>
            {message.sender === 'ai' && (
              <div className="ticon chat-avatar" aria-hidden="true">
                <IconShieldCheck />
              </div>
            )}
            <div className="chat-bubble">
              <p>{message.content}</p>
              <span className="chat-time">{message.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-row ai">
            <div className="ticon chat-avatar" aria-hidden="true">
              <IconShieldCheck />
            </div>
            <div className="chat-bubble chat-typing" aria-label="AI is typing">
              {[0, 1, 2].map((d) => (
                <span key={d} className="dot animate-pulse-aurora" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="glass chat-inputbar">
        <input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about banking security, SMS fraud..."
          disabled={isLoading}
          className="field chat-field"
          aria-label="Message the AI analyst"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          aria-label="Send message"
          className="cta chat-send"
          style={{ opacity: (!inputMessage.trim() || isLoading) ? 0.5 : 1 }}
        >
          <span className="cta-arrow"><IconArrow /></span>
        </button>
      </div>
    </div>
  );
};

export default AISMSShield;
