import { useState } from "react";
import { IconKeyRound, IconShieldCheck, IconArrow } from "@/components/mockup/icons";

/**
 * OTP Security — generate / verify logic preserved,
 * re-skinned in the Aurora mockup's visual language.
 */
const OTPSecurity = () => {
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [enteredOTP, setEnteredOTP] = useState("");
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  const generateOTP = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(otp);
    setVerificationResult(null);
  };

  const verifyOTP = () => {
    if (enteredOTP === generatedOTP) {
      setVerificationResult("success");
    } else {
      setVerificationResult("error");
    }
  };

  return (
    <div className="tpage">
      <span className="eyebrow">OTP SECURITY</span>
      <h1 className="serif">One-time codes.</h1>
      <p className="tsub">Generate and verify one-time passwords for enhanced security.</p>

      <div className="glass tcard">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div className="ticon" style={{ width: 54, height: 54, borderRadius: 17 }}>
            <IconKeyRound />
          </div>
          <h3 style={{ margin: 0 }}>Generate New OTP</h3>
        </div>

        <button type="button" onClick={generateOTP} className="cta" style={{ width: "100%", marginTop: 0 }}>
          <span>Generate New OTP</span>
          <span className="cta-arrow">
            <IconArrow />
          </span>
        </button>

        {generatedOTP && (
          <div
            className="glass animate-fade-in"
            style={{ borderRadius: 20, padding: 22, textAlign: "center", marginTop: 18 }}
          >
            <p className="clabel">Your OTP code</p>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: ".15em",
                color: "var(--ember)",
              }}
            >
              {generatedOTP}
            </div>
            <p style={{ fontSize: 12, marginTop: 10 }}>This code expires in 5 minutes</p>
          </div>
        )}
      </div>

      <div className="glass tcard">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div className="ticon" style={{ width: 54, height: 54, borderRadius: 17 }}>
            <IconShieldCheck />
          </div>
          <h3 style={{ margin: 0 }}>Verify OTP</h3>
        </div>

        <label className="flabel" htmlFor="otp-input">6-digit code</label>
        <input
          id="otp-input"
          type="text"
          placeholder="Enter 6-digit OTP"
          value={enteredOTP}
          onChange={(e) => setEnteredOTP(e.target.value)}
          maxLength={6}
          className="field"
          style={{
            textAlign: "center",
            fontSize: 20,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: ".2em",
          }}
        />
        <button
          type="button"
          onClick={verifyOTP}
          className="cta"
          style={{ width: "100%" }}
          disabled={enteredOTP.length !== 6}
        >
          <span>Verify OTP</span>
          <span className="cta-arrow">
            <IconArrow />
          </span>
        </button>

        {verificationResult && (
          <p
            className="animate-fade-in"
            style={{
              textAlign: "center",
              marginTop: 18,
              fontSize: 15,
              fontWeight: 600,
              color: verificationResult === "success" ? "#8fd0a8" : "#ff6b6b",
            }}
          >
            {verificationResult === "success"
              ? "OTP verified successfully."
              : "Invalid OTP. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
};

export default OTPSecurity;
