import { Phone, FileWarning, Globe, ShieldAlert, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  IconSms,
  IconQr,
  IconKeyRound,
  IconPhoneShield,
  IconBank,
  IconArrow,
} from "@/components/mockup/icons";
import type { ComponentType, SVGProps } from "react";

type IconP = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * CyberHelp — Aurora visual language.
 * All functionality preserved: 1930 helpline call, fraud report links,
 * government resource links, and scam guide navigation.
 */
export default function CyberHelp() {
  const navigate = useNavigate();

  const openUrl = (url: string) => {
    window.open(url, "_blank");
  };

  const callHelpline = () => {
    window.open("tel:1930");
  };

  const scamGuides: { id: string; title: string; icon: IconP; description: string }[] = [
    {
      id: "upi-fraud",
      title: "UPI Fraud",
      icon: IconBank,
      description: "Fake UPI requests and payment link scams",
    },
    {
      id: "qr-scam",
      title: "QR Code Scam",
      icon: IconQr,
      description: "Malicious QR codes that steal money",
    },
    {
      id: "otp-scam",
      title: "OTP Scam",
      icon: IconKeyRound,
      description: "Social engineering to steal one-time passwords",
    },
    {
      id: "sim-swap",
      title: "SIM Swap",
      icon: IconPhoneShield,
      description: "Fraudsters duplicate your SIM card",
    },
    {
      id: "fake-loan-apps",
      title: "Fake Loan Apps",
      icon: IconBank,
      description: "Predatory loan apps with hidden charges",
    },
    {
      id: "whatsapp-scam",
      title: "WhatsApp Banking Scam",
      icon: IconSms,
      description: "Fake banking messages on WhatsApp",
    },
  ];

  const govResources = [
    {
      title: "RBI Banking Safety (Sachet)",
      url: "https://sachet.rbi.org.in",
      description: "RBI customer awareness and complaint platform",
    },
    {
      title: "CERT-In",
      url: "https://www.cert-in.org.in",
      description: "Indian Computer Emergency Response Team",
    },
    {
      title: "National Cyber Crime Portal",
      url: "https://cybercrime.gov.in",
      description: "Report all categories of cyber crime",
    },
    {
      title: "Digital Payment Safety (NPCI)",
      url: "https://www.npci.org.in/what-we-do/upi/dispute-redressal-mechanism",
      description: "UPI dispute redressal",
    },
  ];

  const quickActions = [
    {
      icon: Phone,
      title: "Call 1930",
      sub: "Immediate assistance",
      action: callHelpline,
    },
    {
      icon: FileWarning,
      title: "Report Fraud",
      sub: "File an official complaint",
      action: () => openUrl("https://cybercrime.gov.in"),
    },
    {
      icon: Globe,
      title: "Cyber Crime Portal",
      sub: "National reporting platform",
      action: () => openUrl("https://cybercrime.gov.in"),
    },
    {
      icon: ShieldAlert,
      title: "CERT-In",
      sub: "Cyber incident response",
      action: () => openUrl("https://www.cert-in.org.in"),
    },
  ];

  return (
    <div className="tpage animate-fade-in">
      <span className="eyebrow">CYBER HELP</span>
      <h1 className="serif">Help, right now.</h1>
      <p className="tsub">
        Fraud moves fast. Report it within the golden hour for the best chance of
        recovering your money.
      </p>

      {/* Emergency — national cyber helpline */}
      <div className="glass tcard danger" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <span className="chip" style={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,.4)" }}>
            <span className="dot" style={{ background: "#ff6b6b", boxShadow: "0 0 14px rgba(255,107,107,.7)" }} />
            24/7 EMERGENCY
          </span>
        </div>
        <div className="ticon" style={{ width: 84, height: 84, borderRadius: 26, margin: "0 auto 18px" }}>
          <IconPhoneShield style={{ width: 40, height: 40 }} />
        </div>
        <h3 className="serif" style={{ fontSize: 40, lineHeight: 1.05 }}>
          National Cyber
          <br />
          Helpline 1930.
        </h3>
        <p style={{ marginTop: 10, marginBottom: 22 }}>
          Call the moment you suspect fraud — every minute counts.
        </p>
        <button
          type="button"
          className="cta"
          style={{
            width: "100%",
            background: "linear-gradient(135deg,#e8357b 0%,#b3123f 70%,#8b0f33 100%)",
          }}
          onClick={callHelpline}
        >
          <span>Call 1930</span>
          <span className="cta-arrow">
            <Phone style={{ width: 22, height: 22 }} />
          </span>
        </button>
      </div>

      {/* Quick actions */}
      <div className="glass signals" style={{ marginTop: 0 }}>
        <div className="signals-head">
          <h3>Quick actions</h3>
          <div className="avail">
            <div className="dot" />
            AVAILABLE
          </div>
        </div>
        {quickActions.map((a) => {
          const AIcon = a.icon;
          return (
            <button key={a.title} className="signal-row" onClick={a.action}>
              <div className="sicon">
                <AIcon style={{ width: 26, height: 26 }} />
              </div>
              <div>
                <b>{a.title}</b>
                <small>{a.sub}</small>
              </div>
              <div className="ready">GO</div>
            </button>
          );
        })}
      </div>

      {/* Government resources */}
      <div className="tools-head">
        <h2 className="serif">Official resources</h2>
        <p>Government of India</p>
      </div>
      <div className="glass tcard">
        {govResources.map((resource) => (
          <button
            key={resource.title}
            className="trow"
            style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
            onClick={() => openUrl(resource.url)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
                {resource.title}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 6 }}>
                {resource.description}
              </div>
            </div>
            <ExternalLink style={{ width: 18, height: 18, color: "var(--faint)", flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* Scam protection guides */}
      <div className="tools-head">
        <h2 className="serif">Know your scams</h2>
        <p>Tap a guide to read</p>
      </div>
      <div className="grid">
        {scamGuides.map((guide) => {
          const GIcon = guide.icon;
          return (
            <button
              key={guide.id}
              className="glass tool"
              onClick={() => navigate(`/cyber-help/guide/${guide.id}`)}
              aria-label={guide.title}
            >
              <div>
                <div className="ticon">
                  <GIcon />
                </div>
                <div>
                  <b>{guide.title}</b>
                  <small>{guide.description}</small>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <IconArrow style={{ width: 20, height: 20, color: "var(--faint)" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
