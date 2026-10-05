import { useParams, useNavigate } from "react-router-dom";
import type { ComponentType, CSSProperties } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Info,
  Phone,
  ShieldAlert,
  BadgeDollarSign,
} from "lucide-react";
import {
  IconBack,
  IconBank,
  IconKeyRound,
  IconPhoneShield,
  IconQr,
  IconShieldCheck,
  IconSms,
} from "@/components/mockup/icons";

/**
 * ScamGuide — every guide and every data field from the IoT version
 * preserved (what-is-it, warning signs, prevention, immediate action,
 * reporting channels incl. tel: call links), re-skinned in the Aurora
 * visual language: serif headings, glass cards, pill badges, trow rows.
 */

type GuideIcon = ComponentType<{ style?: CSSProperties; className?: string }>;

type ScamGuideType = {
  title: string;
  icon: GuideIcon;
  whatIsIt: string;
  symptoms: string[];
  prevention: string[];
  immediateAction: string[];
  reporting: { name: string; action: string; url?: string }[];
};

const SCAM_GUIDES: Record<string, ScamGuideType> = {
  "upi-fraud": {
    title: "UPI Fraud",
    icon: IconBank,
    whatIsIt: "Scammers send fake UPI collect requests or share malicious payment links. Victims approve payments thinking they are receiving money.",
    symptoms: [
      "Unexpected collect requests",
      "Pressure to approve quickly",
      "Unknown sender IDs",
      "Requests for small 'verification' amounts"
    ],
    prevention: [
      "Never approve unknown collect requests",
      "Verify sender before paying",
      "Use UPI PIN only to send money never to receive",
      "Enable transaction notifications"
    ],
    immediateAction: [
      "Report to bank within 24 hours",
      "Call 1930 helpline",
      "File complaint on cybercrime.gov.in",
      "Note transaction ID and screenshot"
    ],
    reporting: [
      { name: "National Helpline", action: "Call 1930", url: "tel:1930" },
      { name: "Cyber Crime Portal", action: "Visit cybercrime.gov.in", url: "https://cybercrime.gov.in" },
      { name: "Bank Support", action: "Contact Customer Care" },
      { name: "RBI Sachet", action: "Visit Portal", url: "https://sachet.rbi.org.in" }
    ]
  },
  "qr-scam": {
    title: "QR Code Scam",
    icon: IconQr,
    whatIsIt: "Fraudsters share QR codes claiming you will receive money, but scanning and entering PIN actually debits your account.",
    symptoms: [
      "Stranger shares QR code for receiving money",
      "Asks you to enter PIN after scanning",
      "QR received via WhatsApp from unknown",
      "Pressure to scan quickly"
    ],
    prevention: [
      "QR codes are ONLY for paying not receiving",
      "Never enter PIN to receive money",
      "Verify QR source",
      "Use only official app QR scanners"
    ],
    immediateAction: [
      "Do not enter PIN",
      "Block sender",
      "Report to bank",
      "Call 1930",
      "Screenshot the QR and chat"
    ],
    reporting: [
      { name: "National Helpline", action: "Call 1930", url: "tel:1930" },
      { name: "Cyber Crime Portal", action: "Visit cybercrime.gov.in", url: "https://cybercrime.gov.in" },
      { name: "Bank Support", action: "Call Bank Helpline" }
    ]
  },
  "otp-scam": {
    title: "OTP Scam",
    icon: IconKeyRound,
    whatIsIt: "Scammers pose as bank officials, delivery agents, or customer support and trick victims into sharing OTPs to access their accounts.",
    symptoms: [
      "Calls claiming to be from bank asking for OTP",
      "SMS with links asking to verify OTP",
      "Urgency about account being blocked",
      "Requests to install remote access apps"
    ],
    prevention: [
      "Banks never ask for OTP over phone",
      "Never share OTP with anyone",
      "Enable OTP alerts",
      "Verify caller by calling bank directly"
    ],
    immediateAction: [
      "Change passwords immediately",
      "Call bank to freeze account",
      "Report to 1930",
      "Check for unauthorized transactions"
    ],
    reporting: [
      { name: "National Helpline", action: "Call 1930", url: "tel:1930" },
      { name: "Bank Fraud Dept", action: "Contact Bank" },
      { name: "Cyber Crime Portal", action: "Visit cybercrime.gov.in", url: "https://cybercrime.gov.in" }
    ]
  },
  "sim-swap": {
    title: "SIM Swap",
    icon: IconPhoneShield,
    whatIsIt: "Fraudsters convince your telecom provider to transfer your number to a new SIM, gaining access to all OTPs and banking notifications.",
    symptoms: [
      "Sudden loss of network signal",
      "Unable to make calls",
      "Unexpected SIM deactivation SMS",
      "Unrecognized bank transactions"
    ],
    prevention: [
      "Set SIM lock PIN",
      "Register for SIM swap alerts",
      "Use app-based 2FA instead of SMS",
      "Keep telecom customer ID private"
    ],
    immediateAction: [
      "Contact telecom provider immediately",
      "Freeze bank accounts",
      "Change all passwords",
      "File FIR at police station"
    ],
    reporting: [
      { name: "Telecom Provider", action: "Contact Support" },
      { name: "National Helpline", action: "Call 1930", url: "tel:1930" },
      { name: "Police", action: "File FIR" },
      { name: "Cyber Crime Portal", action: "Visit cybercrime.gov.in", url: "https://cybercrime.gov.in" }
    ]
  },
  "fake-loan-apps": {
    title: "Fake Loan Apps",
    icon: BadgeDollarSign,
    whatIsIt: "Predatory apps offer instant loans but charge hidden fees, access your contacts, and harass borrowers with threatening calls to contacts.",
    symptoms: [
      "Unsolicited loan offers via SMS",
      "Apps requesting access to contacts and photos",
      "Extremely high interest rates",
      "Harassment calls to contacts"
    ],
    prevention: [
      "Only use RBI-registered NBFCs",
      "Check app reviews",
      "Never grant contact/gallery permissions to loan apps",
      "Verify lender on RBI website"
    ],
    immediateAction: [
      "Uninstall the app",
      "Report to cybercrime.gov.in",
      "File complaint with RBI",
      "Document all harassment evidence"
    ],
    reporting: [
      { name: "RBI Complaints", action: "File Complaint", url: "https://cms.rbi.org.in" },
      { name: "Cyber Crime Portal", action: "Visit cybercrime.gov.in", url: "https://cybercrime.gov.in" },
      { name: "National Helpline", action: "Call 1930", url: "tel:1930" },
      { name: "Local Police", action: "File Complaint" }
    ]
  },
  "whatsapp-scam": {
    title: "WhatsApp Banking Scam",
    icon: IconSms,
    whatIsIt: "Scammers impersonate bank officials on WhatsApp, sending fake KYC update links or account verification messages to steal credentials.",
    symptoms: [
      "WhatsApp messages from unknown numbers with bank logos",
      "Links to update KYC",
      "Threats of account closure",
      "Requests to share card details"
    ],
    prevention: [
      "Banks never contact via WhatsApp for KYC",
      "Never click links in WhatsApp messages",
      "Verify by calling bank directly",
      "Report and block sender"
    ],
    immediateAction: [
      "Do not click any links",
      "Block and report sender",
      "Change banking passwords",
      "Inform bank about impersonation"
    ],
    reporting: [
      { name: "WhatsApp", action: "In-app Report" },
      { name: "National Helpline", action: "Call 1930", url: "tel:1930" },
      { name: "Cyber Crime Portal", action: "Visit cybercrime.gov.in", url: "https://cybercrime.gov.in" },
      { name: "Bank Fraud Dept", action: "Contact Bank" }
    ]
  }
};

const SectionHead = ({
  icon: Icon,
  label,
  sub,
}: {
  icon: GuideIcon;
  label: string;
  sub: string;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
    <div className="ticon" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}>
      <Icon style={{ width: 24, height: 24 }} />
    </div>
    <div>
      <p className="clabel" style={{ margin: 0, color: "var(--lav)" }}>{label}</p>
      <p style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>{sub}</p>
    </div>
  </div>
);

export default function ScamGuide() {
  const { scamType } = useParams<{ scamType: string }>();
  const navigate = useNavigate();

  const guide = scamType ? SCAM_GUIDES[scamType] : null;

  if (!guide) {
    return (
      <div className="tpage">
        <div className="glass tcard animate-fade-in" style={{ textAlign: "center", padding: "52px 24px", marginTop: 40 }}>
          <div className="ticon" style={{ margin: "0 auto 22px" }}>
            <AlertTriangle style={{ width: 30, height: 30, color: "#f5a524" }} />
          </div>
          <h1 className="serif" style={{ fontSize: 42, marginBottom: 12, color: "var(--ink)" }}>
            Guide not found.
          </h1>
          <p className="tsub" style={{ margin: "0 auto 26px" }}>
            We couldn't find a guide for that scam type.
          </p>
          <button className="btn-ghost" onClick={() => navigate("/cyber-help")} style={{ margin: "0 auto" }}>
            <IconBack style={{ width: 18, height: 18 }} />
            Back to Cyber Help
          </button>
        </div>
      </div>
    );
  }

  const GuideIcon = guide.icon;

  return (
    <div className="tpage">
      <button className="btn-ghost" style={{ marginBottom: 22 }} onClick={() => navigate("/cyber-help")}>
        <IconBack style={{ width: 18, height: 18 }} />
        Back to Cyber Help
      </button>

      <span className="eyebrow">SCAM GUIDE</span>
      <h1 className="serif">{guide.title}.</h1>
      <p className="tsub">How to spot it, stop it, and where to report it.</p>

      {/* Overview / what is it */}
      <div className="glass tcard animate-fade-in">
        <SectionHead icon={Info} label="OVERVIEW" sub="What this scam is" />
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", marginTop: 18 }}>
          <div className="ticon" style={{ width: 72, height: 72, borderRadius: 22, flexShrink: 0 }}>
            <GuideIcon style={{ width: 34, height: 34 }} />
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--muted)", margin: 0 }}>
            {guide.whatIsIt}
          </p>
        </div>
      </div>

      {/* Warning signs */}
      <div className="glass tcard">
        <SectionHead icon={AlertTriangle} label="WARNING SIGNS" sub="Red flags to watch for" />
        {guide.symptoms.map((symptom) => (
          <div className="trow" key={symptom}>
            <span
              style={{
                width: 9, height: 9, borderRadius: "50%", background: "#f5a524",
                boxShadow: "0 0 10px rgba(245,165,36,.7)", flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 15, color: "var(--ink)" }}>{symptom}</span>
          </div>
        ))}
      </div>

      {/* Prevention */}
      <div className="glass tcard">
        <SectionHead icon={IconShieldCheck} label="PREVENTION" sub="How to stay safe" />
        {guide.prevention.map((item) => (
          <div className="trow" key={item}>
            <IconShieldCheck style={{ width: 24, height: 24, color: "#8fd0a8", flexShrink: 0 }} />
            <span style={{ fontSize: 15, color: "var(--ink)" }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Immediate action */}
      <div className="glass tcard">
        <SectionHead icon={ShieldAlert} label="IMMEDIATE ACTION" sub="What to do right now" />
        {guide.immediateAction.map((action, idx) => (
          <div className="trow" key={action}>
            <span
              className="chip"
              style={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,.4)", padding: "8px 13px", flexShrink: 0 }}
            >
              {idx + 1}
            </span>
            <span style={{ fontSize: 15, color: "var(--ink)" }}>{action}</span>
          </div>
        ))}
      </div>

      {/* Reporting channels */}
      <div className="tools-head">
        <h2 className="serif">Reporting channels</h2>
        <p>Official helplines</p>
      </div>
      <div className="grid">
        {guide.reporting.map((channel) => {
          const url = channel.url;
          const isTel = !!url && url.startsWith("tel:");
          return (
            <div
              key={channel.name}
              className="glass animate-fade-in"
              style={{ borderRadius: 24, padding: 18, display: "flex", flexDirection: "column" }}
            >
              <b style={{ fontSize: 16, color: "var(--ink)", display: "block" }}>{channel.name}</b>
              <small style={{ fontSize: 13, color: "var(--muted)", display: "block", marginTop: 6 }}>
                {channel.action}
              </small>
              {url && (
                <button
                  className="btn-ghost"
                  style={{ width: "100%", marginTop: 14, minHeight: 46, fontSize: 13.5, padding: "10px 16px" }}
                  onClick={() => window.open(url, isTel ? "_self" : "_blank")}
                >
                  {isTel ? <Phone size={15} /> : <ExternalLink size={15} />}
                  {isTel ? "Call Now" : "Visit Website"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Standing helpline pill */}
      <div className="glass tcard" style={{ textAlign: "center", marginTop: 22 }}>
        <p className="clabel" style={{ margin: "0 0 10px" }}>NATIONAL CYBER HELPLINE</p>
        <a
          href="tel:1930"
          className="serif"
          style={{ fontSize: 44, color: "var(--ink)", textDecoration: "none" }}
        >
          1930
        </a>
        <p style={{ fontSize: 14, marginTop: 10 }}>
          Call within the golden hour to freeze fraudulent transactions.
        </p>
      </div>
    </div>
  );
}
