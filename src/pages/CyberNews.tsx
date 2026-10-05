import { useState, useEffect, useRef, useCallback, type CSSProperties, type ComponentType } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/supabase-client';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconGlobe,
  IconShieldPlain,
  IconArrow,
  IconClock,
  IconProfile,
} from '@/components/mockup/icons';
import {
  Bot,
  X,
  ExternalLink,
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
} from 'lucide-react';

/**
 * CyberNews — every data feature from the IoT version preserved
 * (region feeds, hero carousel, AI chat drawer, article sheets),
 * re-skinned in the Aurora visual language:
 * serif headlines, glass cards, pill badges, circular glass buttons.
 */

type Region = 'global' | 'india' | 'karnataka';

type IconType = ComponentType<{ style?: CSSProperties; className?: string }>;

interface RawArticle {
  id?: string;
  title?: string;
  summary?: string;
  description?: string;
  image?: string | null;
  imageUrl?: string | null;
  source?: string;
  author?: string;
  url?: string;
  country?: string;
  severity?: string;
  published?: string;
  published_at?: string;
  publishedAt?: string;
}

interface CurrentsItem {
  title?: string;
  description?: string;
  image?: string;
  author?: string;
  url?: string;
  published?: string;
}

interface Article {
  id: string;
  title: string;
  summary: string;
  description: string;
  imageUrl: string;
  source: string;
  country: string;
  publishedAt: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Info';
  url: string;
  author?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const THEMED_IMAGES = [
  'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80', // mobile banking upi
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80', // cyber lock
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80', // matrix / terminal
  'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&auto=format&fit=crop&q=80', // shield security
  'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80', // data breach
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80', // phishing / code
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80', // abstract network
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80', // cloud server
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80', // laptop hacker
  'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80'  // server hardware
];

function getContextualImage(text: string, index: number): string {
  const lower = (text || '').toLowerCase();
  if (lower.includes('upi') || lower.includes('payment') || lower.includes('phonepe') || lower.includes('gpay') || lower.includes('atm')) {
    return 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80';
  }
  if (lower.includes('ransomware') || lower.includes('malware') || lower.includes('virus') || lower.includes('trojan')) {
    return 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80';
  }
  if (lower.includes('qr') || lower.includes('scan') || lower.includes('merchant')) {
    return 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80';
  }
  if (lower.includes('phishing') || lower.includes('sms') || lower.includes('kyc') || lower.includes('fraud') || lower.includes('scam')) {
    return 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80';
  }
  if (lower.includes('bank') || lower.includes('rbi') || lower.includes('financial') || lower.includes('account')) {
    return 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&auto=format&fit=crop&q=80';
  }
  return THEMED_IMAGES[Math.abs(index) % THEMED_IMAGES.length];
}

const FALLBACK_ARTICLES: Article[] = [
  {
    id: 'fb-1',
    title: 'Warning: New UPI Payment Fraud Targeting Rural Bank Customers',
    summary: 'Cybercriminals are sending fake UPI payment requests via WhatsApp, claiming to be bank officials offering immediate loan approvals.',
    description: 'A detailed advisory regarding a new wave of UPI frauds where attackers use social engineering to trick victims into entering their UPI PIN under the guise of receiving funds. Users are advised never to enter their PIN to receive money.',
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
    source: 'CERT-In',
    country: 'India',
    publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    severity: 'Critical',
    url: 'https://cybercrime.gov.in'
  },
  {
    id: 'fb-2',
    title: 'Ransomware Gangs Targeting Regional Co-operative Banks',
    summary: 'A new ransomware strain has been detected targeting the outdated infrastructure of regional co-operative banks.',
    description: 'Security researchers have identified a coordinated campaign by a well-known ransomware syndicate targeting tier-2 and tier-3 banks. The attack vector primarily involves phishing emails with malicious macros.',
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
    source: 'Cyber Threat Intel',
    country: 'Global',
    publishedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    severity: 'High',
    url: 'https://www.cert-in.org.in'
  },
  {
    id: 'fb-3',
    title: 'Rise in QR Code Scams at Local Merchant Shops in Karnataka',
    summary: 'Fraudsters are replacing legitimate QR codes at merchant shops with their own, redirecting payments to fraudulent accounts.',
    description: 'Local authorities have reported multiple instances of physical tampering with merchant QR codes. Customers are advised to verify the merchant name displayed on their UPI app before authorizing any payment.',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    source: 'Karnataka Cyber Police',
    country: 'Karnataka, India',
    publishedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    severity: 'Medium',
    url: 'https://ksp.karnataka.gov.in'
  },
  {
    id: 'fb-4',
    title: 'Critical Vulnerability Patched in Core Banking Software',
    summary: 'A major core banking software provider has released an emergency patch for an authentication bypass vulnerability.',
    description: 'A CVSS 9.8 vulnerability was discovered in the authentication module of a widely used core banking system. All deployed instances must be patched immediately to prevent unauthorized access.',
    imageUrl: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&auto=format&fit=crop&q=80',
    source: 'Security Advisory',
    country: 'Global',
    publishedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    severity: 'Critical',
    url: 'https://www.cisa.gov'
  },
  {
    id: 'fb-5',
    title: 'Phishing Campaign Uses Fake KYC Update Notices',
    summary: 'Customers are receiving SMS messages threatening account suspension if they do not click a link to update their KYC.',
    description: 'The phishing link leads to a highly convincing spoofed banking portal that captures login credentials and OTPs. Banks reiterate they never ask for sensitive details via SMS links.',
    imageUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
    source: 'Cyber Defense Center',
    country: 'India',
    publishedAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    severity: 'High',
    url: 'https://sachet.rbi.org.in'
  },
  {
    id: 'fb-6',
    title: 'SIM Swap Fraud Prevention Guidelines Issued by Telecom Body',
    summary: 'New guidelines have been issued to telecom operators to tighten the SIM replacement process and prevent SIM swap frauds.',
    description: 'Following a spike in SIM swap incidents leading to financial loss, regulatory authorities have mandated stronger verification processes, including mandatory 24-hour SMS hold periods for SIM replacements.',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
    source: 'Telecom Regulatory Authority',
    country: 'India',
    publishedAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    severity: 'Info',
    url: 'https://cybercrime.gov.in'
  }
];

function parseCurrentsDate(str?: string): Date {
  if (!str) return new Date();
  try {
    let cleaned = str.trim();
    if (cleaned.includes(' +0000')) {
      cleaned = cleaned.replace(' +0000', 'Z').replace(' ', 'T');
    }
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

function normalizeArticle(raw: RawArticle, index: number): Article {
  const text = ((raw.title || '') + ' ' + (raw.description || '') + ' ' + (raw.summary || '')).toLowerCase();
  let severity: 'Critical' | 'High' | 'Medium' | 'Info' = 'Info';

  if (text.includes('breach') || text.includes('ransomware') || text.includes('critical') || text.includes('exploit')) {
    severity = 'Critical';
  } else if (text.includes('fraud') || text.includes('malware') || text.includes('phishing') || text.includes('attack') || text.includes('scam')) {
    severity = 'High';
  } else if (text.includes('vulnerability') || text.includes('warning') || text.includes('alert') || text.includes('patch')) {
    severity = 'Medium';
  }

  const dateObj = parseCurrentsDate(raw.published || raw.published_at || raw.publishedAt);
  const rawImage = raw.imageUrl || raw.image;
  const hasValidWebImage = rawImage && typeof rawImage === 'string' && rawImage.startsWith('http') && rawImage !== 'None' && rawImage !== 'null';
  const finalImage = hasValidWebImage ? rawImage : getContextualImage(raw.title || '', index);

  return {
    id: raw.id || `article-${index}-${Date.now()}`,
    title: raw.title || 'Cybersecurity Intelligence Report',
    summary: raw.summary || (raw.description ? raw.description.substring(0, 160) + (raw.description.length > 160 ? '...' : '') : 'Real-time security bulletin.'),
    description: raw.description || raw.summary || 'Detailed advisory information is available in the original source link.',
    imageUrl: finalImage,
    source: raw.source || raw.author || 'Currents Live Feed',
    country: raw.country || 'Global',
    publishedAt: dateObj.toISOString(),
    severity,
    url: raw.url && raw.url !== '#' ? raw.url : 'https://cybercrime.gov.in',
    author: raw.author
  };
}

function formatSafeDate(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  try {
    const d = parseCurrentsDate(dateStr);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'Recently';
  }
}

/** Aurora-toned pill style for a severity level. */
const sevStyle = (severity: Article['severity']): CSSProperties => {
  switch (severity) {
    case 'Critical':
      return { color: '#ff6b6b', borderColor: 'rgba(255,107,107,.45)' };
    case 'High':
      return { color: '#f5a524', borderColor: 'rgba(245,165,36,.45)' };
    case 'Medium':
      return { color: '#e8357b', borderColor: 'rgba(232,53,123,.5)' };
    default:
      return { color: '#cdc2f7', borderColor: 'rgba(205,194,247,.35)' };
  }
};

// Aurora-styled structured point-by-point AI message formatter.
// Same parsing logic as the IoT version, re-skinned: glass point
// cards, magenta number medallions, lavender titles.
const FormattedAIMessage = ({ text }: { text: string }) => {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Numbered points
        const numMatch = trimmed.match(/^(\d+)[.)]\s*(?:\*\*(.*?)\*\*|\*(.*?)\*|(.*?))[:-]\s*(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const title = (numMatch[2] || numMatch[3] || numMatch[4] || '').replace(/\*\*/g, '').trim();
          const body = (numMatch[5] || '').replace(/\*\*/g, '').trim();

          return (
            <div key={idx} className="glass" style={{ borderRadius: 16, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  border: '1px solid rgba(232,53,123,.55)', color: '#f5f3ff',
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {num}
              </span>
              <div style={{ flex: 1 }}>
                {title && <div style={{ fontWeight: 700, color: 'var(--lav)', fontSize: 12.5, marginBottom: 3, letterSpacing: '.02em' }}>{title}</div>}
                <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.6 }}>{body}</div>
              </div>
            </div>
          );
        }

        // Bullet points
        const bulletMatch = trimmed.match(/^[*\-•]\s*(?:\*\*(.*?)\*\*|\*(.*?)\*|(.*?))[:-]\s*(.*)$/);
        if (bulletMatch) {
          const title = (bulletMatch[1] || bulletMatch[2] || bulletMatch[3] || '').replace(/\*\*/g, '').trim();
          const body = (bulletMatch[4] || '').replace(/\*\*/g, '').trim();

          return (
            <div key={idx} className="glass" style={{ borderRadius: 16, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--magenta)', boxShadow: '0 0 10px rgba(232,53,123,.7)', flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1 }}>
                {title && <div style={{ fontWeight: 700, color: 'var(--lav)', fontSize: 12.5, marginBottom: 3, letterSpacing: '.02em' }}>{title}</div>}
                <div style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.6 }}>{body}</div>
              </div>
            </div>
          );
        }

        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const cleanText = trimmed.replace(/^[*\-•]\s*/, '').replace(/\*\*/g, '');
          return (
            <div key={idx} className="glass" style={{ borderRadius: 12, padding: '8px 12px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lav)', flexShrink: 0, marginTop: 6 }} />
              <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{cleanText}</span>
            </div>
          );
        }

        const parts = trimmed.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx} style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.65, margin: '2px 0' }}>
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} style={{ fontWeight: 700, color: 'var(--lav)' }}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

// Location-specific intelligence pinpoint knowledge generator (unchanged)
function getPinpointLocationResponse(query: string, region: string): string | null {
  const q = query.toLowerCase();

  if (q.includes('bidar')) {
    return `Here is the targeted Cyber Crime Intelligence for Bidar District, Karnataka:

1. **Fake GESCOM Electricity Bill SMS**: Fraudsters send urgent SMS threatening to cut electricity at night unless a small verification payment is made via an APK link.
2. **Agricultural Subsidy & Loan Impersonation**: Scammers target farmers and local traders in Bidar APMC pretending to be bank agents offering PM-Kisan or zero-interest loans.
3. **QR Code Swapping at Local Mandis**: Fraudulent QR stands placed over genuine shopkeeper codes to divert merchant payments.
4. **AnyDesk & Remote Access Scams**: Victims asked to download QuickSupport or AnyDesk for 'Aadhaar bank link verification' resulting in account drains.
5. **Emergency Action**: If defrauded in Bidar, call 1930 immediately or report to the Bidar CEN (Cyber, Economic & Narcotics) Crime Police Station.`;
  }

  if (q.includes('karnataka') || q.includes('bengaluru') || q.includes('bangalore') || q.includes('mysuru') || q.includes('kalaburagi')) {
    return `Latest Karnataka Cyber Intelligence & Police Advisories:

1. **FedEx / Police Digital Arrest Scams**: Fraudsters pose as Karnataka Police or CBI on video calls, threatening victims with bogus drug parcel accusations.
2. **Part-time Telegram Job Fraud**: Fraudulent rating/review tasks promising daily returns of ₹3,000–₹10,000 before blocking accounts.
3. **Fake BESCOM / HESCOM Utility Alerts**: Malicious APKs sent to steal banking OTPs under the pretext of unpaid power bills.
4. **Immediate Advisory**: Karnataka Police urges victims to dial 1930 within the 1-hour golden window to freeze bank transactions.`;
  }

  if (q.includes('upi') || q.includes('qr') || q.includes('payment')) {
    return `Critical UPI & Payment Security Intelligence:

1. **UPI PIN Golden Rule**: You NEVER enter your UPI PIN to receive money. Entering your PIN always DEDUCTS money from your account.
2. **Reverse QR Phishing**: Scammers send you a QR code claiming it is for 'receiving cashback'. Scanning it authorizes a debit.
3. **Unsolicited Collect Requests**: Reject any unknown 'Request Money' or payment approval alerts from PhonePe, Google Pay, or Paytm.
4. **Emergency Freeze**: Call 1930 immediately to block UPI transactions if unauthorized debits occur.`;
  }

  return null;
}

const REGIONS: { id: Region; label: string; sub: string; icon: IconType }[] = [
  { id: 'global', label: 'Global Top 10', sub: 'Worldwide threat feeds', icon: IconGlobe },
  { id: 'india', label: 'India Top 10', sub: 'National cyber advisories', icon: IconShieldPlain },
  { id: 'karnataka', label: 'Karnataka Top 10', sub: 'State cyber police alerts', icon: MapPin },
];

const REGION_LABEL: Record<Region, string> = {
  global: 'Global',
  india: 'India',
  karnataka: 'Karnataka',
};

const CHAT_SUGGESTIONS = [
  'Past Bidar cyber fraud news',
  'Karnataka cyber crime alerts',
  'Latest UPI payment attacks',
  'Fake loan app harassment',
  'Ransomware advisories',
  'CERT-In 1930 helpline guidance'
];

export default function CyberNews() {
  const [region, setRegion] = useState<Region>('global');
  const [articles, setArticles] = useState<Article[]>(FALLBACK_ARTICLES);
  const [loading, setLoading] = useState(true);
  const [isLiveApi, setIsLiveApi] = useState(false);

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your DEFENXIA Cyber Intelligence AI. Ask me pinpoint questions about local cyber fraud in your city, UPI attacks, or threat advisories.'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Article sheet state
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const fetchNews = useCallback(async (selectedRegion: Region, isManualRefresh = false) => {
    setLoading(true);
    if (isManualRefresh) {
      toast.info('Fetching fresh cybersecurity intelligence...');
    }

    const currentsKey = import.meta.env.VITE_CURRENTS_API_KEY || 'SwcnQ2UOdAI-qZfhhUxelSps-vKhQEGMhvSRC1sWmhphi6nP';

    const searchQueries: Record<Region, string[]> = {
      global: ['cybersecurity', 'ransomware OR cyber attack', 'banking malware OR data breach'],
      india: ['cybersecurity India OR UPI fraud', 'CERT-In advisory OR banking scam India', 'online fraud India OR cyber crime'],
      karnataka: ['Karnataka cyber crime OR Bengaluru cybersecurity', 'Karnataka fraud OR Bengaluru cyber police', 'Bengaluru cyber fraud OR UPI scam']
    };

    const queryList = searchQueries[selectedRegion] || searchQueries.global;
    const chosenQuery = isManualRefresh
      ? queryList[Math.floor(Math.random() * queryList.length)]
      : queryList[0];

    const countryParam = selectedRegion === 'india' ? '&country=IN' : '';
    const cacheBuster = `&_cb=${Date.now()}`;

    try {
      // 1. PRIMARY: Direct Currents API search with cache buster
      const directUrl = `https://api.currentsapi.services/v1/search?keywords=${encodeURIComponent(chosenQuery)}${countryParam}&language=en&apiKey=${currentsKey}${cacheBuster}`;
      const res = await fetch(directUrl);

      if (res.ok) {
        const data = (await res.json()) as { news?: CurrentsItem[] };
        if (data?.news && Array.isArray(data.news) && data.news.length > 0) {
          const mapped = data.news.map((item, idx) => normalizeArticle({
            title: item.title,
            description: item.description,
            summary: item.description,
            image: item.image,
            source: item.author || 'Currents Live',
            author: item.author,
            url: item.url,
            country: selectedRegion === 'karnataka' ? 'Karnataka' : selectedRegion === 'india' ? 'India' : 'Global',
            published: item.published
          }, idx));

          setArticles(mapped);
          setIsLiveApi(true);
          setLoading(false);
          if (isManualRefresh) {
            toast.success('Cybersecurity feed refreshed with latest intelligence!');
          }
          return;
        }
      }

      // 2. Fallback to Supabase Edge Function
      const response = await invokeEdgeFunction<{ articles: RawArticle[] }>('get-cyber-news', { region: selectedRegion });
      if (response?.data?.articles && Array.isArray(response.data.articles) && response.data.articles.length > 0) {
        const mapped = response.data.articles.map((item, idx) => normalizeArticle(item, idx));
        setArticles(mapped);
        setIsLiveApi(true);
        setLoading(false);
        if (isManualRefresh) {
          toast.success('Feed updated successfully!');
        }
        return;
      }

      // 3. Fallback to dynamic themed articles with fresh timestamps
      const refreshedFallback = FALLBACK_ARTICLES.map((art, idx) => ({
        ...art,
        id: `fb-${idx}-${Date.now()}`,
        imageUrl: THEMED_IMAGES[idx % THEMED_IMAGES.length],
        publishedAt: new Date(Date.now() - (idx + 1) * 1800000).toISOString()
      }));
      setArticles(refreshedFallback);
      setIsLiveApi(false);
      if (isManualRefresh) {
        toast.success('Cybersecurity feed refreshed!');
      }
    } catch (error) {
      console.error('Error fetching live news:', error);
      const refreshedFallback = FALLBACK_ARTICLES.map((art, idx) => ({
        ...art,
        id: `fb-${idx}-${Date.now()}`,
        imageUrl: THEMED_IMAGES[idx % THEMED_IMAGES.length],
        publishedAt: new Date(Date.now() - (idx + 1) * 1800000).toISOString()
      }));
      setArticles(refreshedFallback);
      setIsLiveApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(region);
  }, [region, fetchNews]);

  // Carousel auto-scroll
  useEffect(() => {
    const heroItems = articles.slice(0, 3);
    if (heroItems.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroItems.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [articles]);

  // Auto scroll chat
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  const handleSendChatMessage = async (msg: string) => {
    if (!msg.trim()) return;

    const userMessageText = msg;
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMessageText }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const pinpoint = getPinpointLocationResponse(userMessageText, region);

      const response = await invokeEdgeFunction<{ response: string }>('cyber-news-chat', {
        message: userMessageText,
        region
      });

      if (response?.data?.response) {
        setChatMessages([...newMessages, { role: 'assistant', content: response.data.response }]);
      } else if (pinpoint) {
        setChatMessages([...newMessages, { role: 'assistant', content: pinpoint }]);
      } else {
        const fallback = `Cyber Advisory regarding "${userMessageText}":\n\n1. **Modus Operandi**: Attackers use social engineering and urgency to compromise banking credentials.\n2. **Prevention**: Never share OTP or approve remote access applications.\n3. **Helpline**: In case of financial loss, immediately dial 1930 or visit cybercrime.gov.in.`;
        setChatMessages([...newMessages, { role: 'assistant', content: fallback }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const pinpoint = getPinpointLocationResponse(userMessageText, region);
      const reply = pinpoint || `CERT-In Security Alert:\n\n1. **Precaution**: Verify caller authenticity before transferring any money.\n2. **Immediate Step**: If scammed, call 1930 within the golden hour to freeze fraudulent transactions.`;
      setChatMessages([...newMessages, { role: 'assistant', content: reply }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const heroArticles = articles.slice(0, 3);
  const feedArticles = articles.length > 3 ? articles.slice(3) : articles;

  const renderRegionCard = (r: { id: Region; label: string; sub: string; icon: IconType }) => {
    const RIcon = r.icon;
    const active = region === r.id;
    return (
      <button
        key={r.id}
        className="glass news-blur tool"
        style={{
          minHeight: 168,
          ...(active
            ? { borderColor: 'rgba(232,53,123,.55)', background: 'rgba(139,61,240,.08)' }
            : {}),
        }}
        onClick={() => setRegion(r.id)}
        aria-label={r.label}
        aria-pressed={active}
      >
        <div>
          <div className="ticon">
            <RIcon style={{ width: 30, height: 30 }} />
          </div>
          <div>
            <b>{r.label}</b>
            <small>{r.sub}</small>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="tpage cybernews">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <span className="eyebrow">CYBER INTEL</span>
          <h1 className="serif">Cyber news.</h1>
          <p className="tsub">Real-time threat intelligence and official advisories.</p>
        </div>
        <button
          className="glass gicon"
          onClick={() => fetchNews(region, true)}
          disabled={loading}
          aria-label="Refresh news"
          style={{ marginTop: 10, flexShrink: 0, opacity: loading ? 0.5 : 1 }}
        >
          <RefreshCw size={22} className={loading ? 'animate-spin' : ''} style={{ color: '#cdc2f7' }} />
        </button>
      </div>

      {isLiveApi && (
        <div style={{ marginBottom: 20 }}>
          <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <span className="dot" />
            LIVE FEED
          </span>
        </div>
      )}

      {/* Hero carousel */}
      {!loading && heroArticles.length > 0 && (
        <div className="glass news-blur news-hero animate-fade-in" style={{ borderRadius: 30, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ position: 'relative', height: 330 }}>
            {heroArticles.map((article, idx) => (
              <button
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                aria-label={`Read: ${article.title}`}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                  opacity: idx === currentSlide ? 1 : 0,
                  pointerEvents: idx === currentSlide ? 'auto' : 'none',
                  transition: 'opacity .8s ease',
                }}
              >
                <img
                  src={article.imageUrl}
                  alt=""
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = THEMED_IMAGES[idx % THEMED_IMAGES.length];
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(6,6,10,.96) 8%, rgba(6,6,10,.5) 58%, transparent 100%)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 22,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span className="chip" style={sevStyle(article.severity)}>{article.severity}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(245,243,255,.75)' }}>
                      <IconClock style={{ width: 13, height: 13 }} />
                      {formatSafeDate(article.publishedAt)}
                    </span>
                  </div>
                  <div
                    className="serif"
                    style={{
                      fontSize: 32, lineHeight: 1.08, color: '#fff', marginBottom: 10,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}
                  >
                    {article.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'rgba(245,243,255,.7)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={13} /> {article.source}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconGlobe style={{ width: 13, height: 13 }} /> {article.country}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* Dots */}
            <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, zIndex: 3 }}>
              {heroArticles.map((a, idx) => (
                <button
                  key={a.id}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to story ${idx + 1}`}
                  style={{
                    height: 8, width: idx === currentSlide ? 26 : 8, borderRadius: 99, border: 'none',
                    cursor: 'pointer', background: idx === currentSlide ? '#e8357b' : 'rgba(255,255,255,.4)',
                    transition: 'all .3s',
                  }}
                />
              ))}
            </div>

            {/* Prev / next */}
            <button
              className="glass"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + heroArticles.length) % heroArticles.length)}
              aria-label="Previous story"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronLeft size={20} style={{ color: '#cdc2f7' }} />
            </button>
            <button
              className="glass"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % heroArticles.length)}
              aria-label="Next story"
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronRight size={20} style={{ color: '#cdc2f7' }} />
            </button>
          </div>
        </div>
      )}

      {/* Region filters + AI entry */}
      <div className="tools-head" style={{ marginTop: 6 }}>
        <h2 className="serif">Threat regions</h2>
        <p>Pick a feed</p>
      </div>
      <div className="grid">
        {REGIONS.map(renderRegionCard)}
        <button
          className="glass news-blur tool"
          style={{ minHeight: 168, borderColor: 'rgba(232,53,123,.4)' }}
          onClick={() => { setSelectedArticle(null); setIsChatOpen(true); }}
          aria-label="Ask Cyber AI"
        >
          <div>
            <div className="ticon">
              <Bot style={{ width: 30, height: 30 }} />
            </div>
            <div>
              <b>Ask Cyber AI</b>
              <small>Pinpoint fraud advisor</small>
            </div>
          </div>
        </button>
      </div>

      {/* Feed */}
      <div className="tools-head">
        <h2 className="serif">Latest bulletins</h2>
        <p>{REGION_LABEL[region]} feed</p>
      </div>

      {loading ? (
        <div className="grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass news-blur" style={{ borderRadius: 24, overflow: 'hidden' }}>
              <Skeleton style={{ height: 120, borderRadius: 0 }} />
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton style={{ height: 15, width: '90%' }} />
                <Skeleton style={{ height: 15, width: '68%' }} />
                <Skeleton style={{ height: 38 }} />
              </div>
            </div>
          ))}
        </div>
      ) : feedArticles.length > 0 ? (
        <div className="grid">
          {feedArticles.map((article, idx) => (
            <article key={article.id} className="glass news-blur animate-fade-in" style={{ borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', height: 118 }}>
                <img
                  src={article.imageUrl}
                  alt=""
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = THEMED_IMAGES[idx % THEMED_IMAGES.length];
                  }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span
                  className="chip"
                  style={{ position: 'absolute', top: 10, left: 10, ...sevStyle(article.severity), background: 'rgba(6,6,10,.55)', backdropFilter: 'blur(13.52px)' }}
                >
                  {article.severity}
                </span>
              </div>
              <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <b
                  style={{
                    fontSize: 14.5, lineHeight: 1.4, color: 'var(--ink)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}
                >
                  {article.title}
                </b>
                <p
                  style={{
                    fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)', marginTop: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}
                >
                  {article.summary}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--faint)', marginTop: 12 }}>
                  <IconClock style={{ width: 12, height: 12 }} />
                  <span>{formatSafeDate(article.publishedAt)}</span>
                  <span>&bull;</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{article.source}</span>
                </div>
                <button
                  className="btn-ghost"
                  style={{ width: '100%', marginTop: 14, minHeight: 44, fontSize: 13, padding: '10px 16px' }}
                  onClick={() => setSelectedArticle(article)}
                >
                  Read Full Advisory
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass tcard" style={{ textAlign: 'center' }}>
          <p className="clabel" style={{ margin: 0 }}>No bulletins</p>
          <p style={{ marginTop: 10 }}>No threat bulletins are available for this region right now.</p>
        </div>
      )}

      {/* Floating AI button */}
      <button
        className="glass circle-btn"
        onClick={() => { setSelectedArticle(null); setIsChatOpen(true); }}
        aria-label="Ask Cyber AI"
        style={{ position: 'fixed', bottom: 104, right: 18, zIndex: 15 }}
      >
        <Bot size={24} style={{ color: '#cdc2f7' }} />
      </button>

      {/* AI chat sheet */}
      <div
        className={`scrim${isChatOpen ? ' show' : ''}`}
        onClick={() => setIsChatOpen(false)}
        aria-hidden="true"
      />
      <div
        className={`glass sheet${isChatOpen ? ' show' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isChatOpen}
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}
      >
        <div className="handle" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="sheet-icon" style={{ marginBottom: 0, width: 56, height: 56, flexShrink: 0 }}>
            <Bot style={{ width: 28, height: 28 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: 'var(--ink)', lineHeight: 1.1 }}>
              Cyber Intelligence AI
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
              <span className="dot" />
              <span className="eyebrow" style={{ fontSize: 10 }}>PINPOINT FRAUD ADVISOR</span>
            </div>
          </div>
          <button
            className="glass gicon"
            style={{ width: 46, height: 46, flexShrink: 0 }}
            onClick={() => setIsChatOpen(false)}
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px' }}>
          {chatMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div key={idx} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                <div className="ticon" style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0 }}>
                  {isUser
                    ? <IconProfile style={{ width: 19, height: 19 }} />
                    : <Bot style={{ width: 19, height: 19 }} />}
                </div>
                <div
                  style={isUser
                    ? {
                        maxWidth: '80%', background: 'linear-gradient(135deg,#f9613f,#e8357b)',
                        borderRadius: '18px 18px 6px 18px', padding: '12px 14px',
                        fontSize: 13.5, color: '#fff', lineHeight: 1.55,
                      }
                    : {
                        maxWidth: '88%', background: 'rgba(205,194,247,.05)', border: '1px solid var(--edge-soft)',
                        borderRadius: '18px 18px 18px 6px', padding: '12px 14px',
                      }}
                >
                  {isUser ? msg.content : <FormattedAIMessage text={msg.content} />}
                </div>
              </div>
            );
          })}
          {isChatLoading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="ticon" style={{ width: 38, height: 38, borderRadius: 13, flexShrink: 0 }}>
                <Bot style={{ width: 19, height: 19 }} />
              </div>
              <div className="glass" style={{ borderRadius: '18px 18px 18px 6px', padding: '14px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--faint)', marginRight: 4 }}>Investigating</span>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="animate-pulse"
                    style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--magenta)', animationDelay: `${i * 0.2}s`, display: 'inline-block' }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={chatMessagesEndRef} />
        </div>

        {/* Suggestion chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0 4px', scrollbarWidth: 'none' }}>
          {CHAT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              className="chip"
              style={{ flexShrink: 0, textTransform: 'none', letterSpacing: '.02em', fontFamily: 'inherit', fontSize: 12.5 }}
              onClick={() => handleSendChatMessage(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(chatInput); }}
          style={{ display: 'flex', gap: 10, marginTop: 6 }}
        >
          <input
            className="field"
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about scams, UPI fraud, advisories..."
            style={{ flex: 1, fontSize: 14, padding: '13px 16px' }}
          />
          <button
            type="submit"
            className="glass gicon"
            style={{ width: 52, height: 52, flexShrink: 0, opacity: !chatInput.trim() || isChatLoading ? 0.45 : 1 }}
            disabled={!chatInput.trim() || isChatLoading}
            aria-label="Send message"
          >
            <IconArrow style={{ width: 22, height: 22 }} />
          </button>
        </form>
      </div>

      {/* Article detail sheet */}
      <div
        className={`scrim${selectedArticle ? ' show' : ''}`}
        onClick={() => setSelectedArticle(null)}
        aria-hidden="true"
      />
      <div
        className={`glass sheet${selectedArticle ? ' show' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!selectedArticle}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="handle" />
        {selectedArticle && (
          <>
            <div style={{ borderRadius: 22, overflow: 'hidden', marginBottom: 18, border: '1px solid var(--edge-soft)' }}>
              <img
                src={selectedArticle.imageUrl}
                alt=""
                onError={(e) => {
                  (e.target as HTMLImageElement).src = THEMED_IMAGES[0];
                }}
                style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <span className="chip" style={sevStyle(selectedArticle.severity)}>{selectedArticle.severity} severity</span>
              <span className="chip">{selectedArticle.country}</span>
            </div>
            <h2 className="serif" style={{ fontSize: 38, lineHeight: 1.05, color: 'var(--ink)', marginBottom: 14 }}>
              {selectedArticle.title}
            </h2>
            <div className="kv">
              <span className="k">Source</span>
              <span className="v">{selectedArticle.source}</span>
            </div>
            {selectedArticle.author && (
              <div className="kv">
                <span className="k">Author</span>
                <span className="v">{selectedArticle.author}</span>
              </div>
            )}
            <div className="kv">
              <span className="k">Published</span>
              <span className="v">{formatSafeDate(selectedArticle.publishedAt)}</span>
            </div>
            <div className="glass" style={{ borderRadius: 20, padding: 18, margin: '18px 0' }}>
              <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink)', margin: 0 }}>{selectedArticle.summary}</p>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--muted)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>
              {selectedArticle.description}
            </p>
            {selectedArticle.url && (
              <a
                className="cta"
                href={selectedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', width: '100%' }}
              >
                <span>Open Advisory Link</span>
                <span className="cta-arrow">
                  <ExternalLink size={18} />
                </span>
              </a>
            )}
            <button
              className="btn-ghost"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => setSelectedArticle(null)}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
