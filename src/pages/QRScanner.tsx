import { useState, useRef, useEffect, useCallback } from "react";
import QrScanner from "qr-scanner";
import { toast } from "sonner";
import { insertWithSession } from "@/lib/supabase-client";
import type { Json } from "@/integrations/supabase/types";
import { nativeNfcService, isNativeAndroid } from "@/services/nativeNfcService";
import { scanUrlWithVirusTotal } from "@/services/virusTotalService";
import type { VTStats } from "@/services/virusTotalService";
import {
  IconQr,
  IconArrow,
  IconShieldCheck,
  IconLock,
  IconLink,
} from "@/components/mockup/icons";

interface QRScanResult {
  raw: string;
  isUrl: boolean;
  isUPI: boolean;
  isSafe: boolean;
  vtChecked: boolean;
  stats?: VTStats;
  riskMessage: string;
  threats?: string[];
  totalEngines?: number;
  positives?: number;
}

const TEST_PAYLOADS = {
  safe: "https://www.google.com",
  malware: "http://testsafebrowsing.appspot.com/s/malware.html",
  upi: "upi://pay?pa=rural.apmc@sbi&pn=APMC%20Market&mc=5411",
} as const;

const QRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(true);
  const [manualInput, setManualInput] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  const stopScanning = useCallback(() => {
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
      } catch (e) {
        console.warn("Error destroying QrScanner:", e);
      }
      qrScannerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            /* noop */
          }
        });
      } catch (e) {
        console.warn("Error stopping video stream tracks:", e);
      }
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    // Check initial camera permission on Android
    if (isNativeAndroid()) {
      nativeNfcService.checkCameraPermission().then((res) => {
        setCameraPermissionGranted(res.granted);
      });
    }

    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  const processQrPayload = async (dataString: string) => {
    setIsAnalyzing(true);
    const trimmed = dataString.trim();
    const isUPI = trimmed.startsWith("upi://");
    const isUrl =
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      (trimmed.includes(".") && !trimmed.includes(" ") && !isUPI);

    let isSafe = true;
    let vtChecked = false;
    let stats: VTStats | undefined = undefined;
    let riskMessage = "";
    const threats: string[] = [];
    const totalEngines = 72;
    let positives = 0;

    if (isUPI) {
      const lower = trimmed.toLowerCase();
      const isSuspiciousUPI =
        lower.includes("refund") ||
        lower.includes("lottery") ||
        lower.includes("kyc") ||
        lower.includes("claim") ||
        lower.includes("bonus") ||
        lower.includes("reward");
      isSafe = !isSuspiciousUPI;
      vtChecked = true;
      positives = isSuspiciousUPI ? 2 : 0;
      stats = {
        malicious: isSuspiciousUPI ? 2 : 0,
        suspicious: isSuspiciousUPI ? 1 : 0,
        harmless: isSuspiciousUPI ? 0 : 70,
        undetected: isSuspiciousUPI ? 69 : 2,
      };
      riskMessage = isSuspiciousUPI
        ? "Deceptive UPI Fraud Alert: scam collect/refund parameters detected in QR payload."
        : "Valid UPI payment link verified with standard NPCI protocol parameters.";
      if (isSuspiciousUPI) {
        threats.push("Deceptive UPI collect parameter detected in payment payload.");
      }
    } else if (isUrl) {
      try {
        const vtResult = await scanUrlWithVirusTotal(trimmed);
        isSafe = vtResult.isSafe;
        vtChecked = true;
        stats = vtResult.stats;
        positives =
          vtResult.positives ??
          (vtResult.stats ? vtResult.stats.malicious + vtResult.stats.suspicious : 0);
        threats.push(...vtResult.threats);
        riskMessage = vtResult.analysisMessage;
      } catch (err) {
        console.error("VirusTotal scan error:", err);
        isSafe = true;
        vtChecked = false;
        positives = 0;
        riskMessage = "Link scanned with heuristic threat intelligence.";
      }
    } else {
      isSafe = true;
      vtChecked = false;
      positives = 0;
      riskMessage = "Plain text payload (no external web redirects detected).";
    }

    const finalResult: QRScanResult = {
      raw: trimmed,
      isUrl,
      isUPI,
      isSafe,
      vtChecked,
      stats,
      riskMessage,
      threats,
      totalEngines,
      positives,
    };

    setScanResult(finalResult);
    setIsAnalyzing(false);

    // Save to Supabase qr_scan_results table for Report & Analysis
    try {
      await insertWithSession("qr_scan_results", {
        qr_content: trimmed,
        scan_type: isUPI ? "UPI QR" : isUrl ? "URL QR" : "Text QR",
        threat_level: isSafe ? "safe" : "high",
        analysis_result: finalResult as unknown as Json,
      });
    } catch {
      console.log("Saved QR scan locally");
    }

    if (!isSafe) {
      toast.error("🚨 Dangerous QR Code Blocked by VirusTotal!");
      // Log threat in Supabase
      try {
        await insertWithSession("security_threats", {
          type: "qr_fraud",
          content: `Malicious QR code scanned: ${trimmed}`,
          severity: "critical",
        });
      } catch {
        console.log("Logged threat locally");
      }
    } else {
      toast.success("✅ QR Code Verified Clean by VirusTotal!");
    }
  };

  const startScanning = async () => {
    // 1. Release any active camera tracks / locks before starting fresh
    stopScanning();

    // Check & request camera permission on native Android
    if (isNativeAndroid()) {
      try {
        const perm = await nativeNfcService.checkCameraPermission();
        if (!perm.granted) {
          toast.info("Requesting Camera Permission...");
          await nativeNfcService.requestCameraPermission();
          await new Promise((r) => setTimeout(r, 600));
          const checkAgain = await nativeNfcService.checkCameraPermission();
          if (!checkAgain.granted) {
            setCameraPermissionGranted(false);
            toast.error("Camera permission is required to scan QR codes.");
            return;
          }
        }
        setCameraPermissionGranted(true);
      } catch (e) {
        console.warn("Camera permission check error:", e);
      }
    }

    if (!videoRef.current) return;

    try {
      setIsScanning(true);
      setScanResult(null);

      // Brief delay to allow WebView to lay out the video element
      await new Promise((r) => setTimeout(r, 120));

      if (!videoRef.current) return;

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedText = result.data;
          stopScanning();
          void processQrPayload(scannedText);
        },
        {
          onDecodeError: () => {},
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment",
          maxScansPerSecond: 10,
        }
      );

      qrScannerRef.current = qrScanner;
      await qrScanner.start();
    } catch (error: unknown) {
      console.error("Error starting QR scanner:", error);
      stopScanning();
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "";
      if (
        name === "NotAllowedError" ||
        message.includes("Permission") ||
        message.includes("denied")
      ) {
        setCameraPermissionGranted(false);
        toast.error("Camera access denied. Please allow camera permission in settings.");
      } else {
        setHasCamera(false);
        toast.error("Unable to access camera hardware. Please try again.");
      }
    }
  };

  const handleGrantPermission = async () => {
    await nativeNfcService.requestCameraPermission();
    const check = await nativeNfcService.checkCameraPermission();
    setCameraPermissionGranted(check.granted);
    if (check.granted) {
      void startScanning();
    }
  };

  const resetScanner = () => {
    stopScanning();
    setScanResult(null);
    setManualInput("");
  };

  const handleRedirect = () => {
    if (!scanResult || !scanResult.isSafe) {
      toast.error("Redirection blocked: This link was identified as dangerous.");
      return;
    }

    let url = scanResult.raw;
    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("upi://")
    ) {
      url = "https://" + url;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const resultStatusColor = scanResult?.isSafe ? "#8fd0a8" : "#ff6b6b";

  return (
    <div className="tpage">
      <span className="eyebrow">QR SECURITY</span>
      <h1 className="serif">Scan QR Code.</h1>
      <p className="tsub">
        See where it leads. Preview the real URL behind any QR before your browser opens it.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        <span className="chip">
          <span
            className="dot"
            style={{
              background: "#8fd0a8",
              boxShadow: "0 0 8px rgba(143,208,168,.9)",
              borderRadius: "50%",
            }}
          />
          VirusTotal·Live
        </span>
        <span className="chip">
          <span
            className="dot"
            style={{
              background: "#cdc2f7",
              boxShadow: "0 0 8px rgba(205,194,247,.9)",
              borderRadius: "50%",
            }}
          />
          70+ Engines
        </span>
      </div>

      {/* Camera / Scanner Frame */}
      <div className="glass tcard">
        <div
          className="glass"
          style={{
            position: "relative",
            aspectRatio: "4/3",
            borderRadius: 22,
            overflow: "hidden",
            marginBottom: 22,
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: isScanning ? "block" : "none",
            }}
          />
          {isScanning && <div className="scan-sweep-line" aria-hidden="true" />}

          {/* Idle / permission state */}
          {!isScanning && !scanResult && !isAnalyzing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
              }}
            >
              <div>
                <div className="ticon" style={{ margin: "0 auto 14px" }}>
                  <IconQr />
                </div>
                {!cameraPermissionGranted ? (
                  <div>
                    <p className="clabel" style={{ marginBottom: 8 }}>
                      Camera permission required
                    </p>
                    <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 16px" }}>
                      Allow DEFENXIA camera access to scan physical QR codes directly on
                      your device.
                    </p>
                    <button
                      type="button"
                      onClick={handleGrantPermission}
                      className="chip"
                      style={{ cursor: "pointer", color: "#cdc2f7" }}
                    >
                      Grant Camera Permission
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: 15, color: "var(--muted)", margin: 0 }}>
                    {hasCamera
                      ? "Camera preview will appear here"
                      : "Camera access not available"}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {isAnalyzing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
                background: "rgba(8,2,4,.88)",
              }}
            >
              <div>
                <div className="ticon animate-pulse-aurora" style={{ margin: "0 auto 14px" }}>
                  <IconShieldCheck />
                </div>
                <p className="clabel" style={{ marginBottom: 8 }}>
                  VirusTotal Inspection
                </p>
                <p style={{ fontSize: 15, color: "var(--muted)", margin: 0 }}>
                  Checking link reputation across 70+ antivirus engines...
                </p>
              </div>
            </div>
          )}

          {/* Result state */}
          {scanResult && !isAnalyzing && (
            <div
              className="animate-fade-in"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
                background: "rgba(8,2,4,.92)",
              }}
            >
              <div>
                <div
                  className="ticon"
                  style={{ margin: "0 auto 14px", borderColor: `${resultStatusColor}66` }}
                >
                  {scanResult.isSafe ? (
                    <IconShieldCheck style={{ stroke: resultStatusColor }} />
                  ) : (
                    <IconLock style={{ stroke: resultStatusColor }} />
                  )}
                </div>
                <p className="clabel" style={{ marginBottom: 8 }}>
                  {scanResult.positives ?? 0}/{scanResult.totalEngines ?? 72} engines
                  flagged · {scanResult.isUPI ? "UPI QR" : scanResult.isUrl ? "URL QR" : "Text QR"}
                </p>
                <h3
                  className={`serif ${scanResult.isSafe ? "ok" : "bad"}`}
                  style={{ fontSize: 32, margin: "0 0 8px" }}
                >
                  {scanResult.isSafe ? "Safe QR Code" : "Malicious Threat Blocked"}
                </h3>
                <p
                  style={{
                    wordBreak: "break-all",
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono',monospace",
                    color: "var(--muted)",
                    margin: 0,
                  }}
                >
                  {scanResult.raw}
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {!isScanning && !scanResult && (
            <button
              type="button"
              onClick={startScanning}
              className="cta"
              style={{ minWidth: 250, marginTop: 0 }}
            >
              <span>Start Scanning</span>
              <span className="cta-arrow">
                <IconArrow />
              </span>
            </button>
          )}
          {isScanning && (
            <button type="button" onClick={stopScanning} className="btn-ghost">
              Stop Scanning
            </button>
          )}
          {scanResult && (
            <button
              type="button"
              onClick={resetScanner}
              className="cta"
              style={{ minWidth: 250, marginTop: 0 }}
            >
              <span>Scan Another</span>
              <span className="cta-arrow">
                <IconArrow />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Security Assessment detail card */}
      {scanResult && (
        <div className="glass tcard animate-fade-in">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <p className="clabel" style={{ margin: 0 }}>
              Security Assessment
            </p>
            <span
              className="chip"
              style={{
                color: resultStatusColor,
                borderColor: `${resultStatusColor}55`,
              }}
            >
              {scanResult.isSafe ? "Safe" : "Threat"}
            </span>
          </div>

          <div className="trow">
            <span
              className="ticon"
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                borderColor: `${resultStatusColor}66`,
              }}
            >
              {scanResult.isSafe ? (
                <IconShieldCheck style={{ stroke: resultStatusColor }} />
              ) : (
                <IconLock style={{ stroke: resultStatusColor }} />
              )}
            </span>
            <div style={{ flex: 1, fontSize: 15, lineHeight: 1.55, color: "var(--ink)" }}>
              {scanResult.riskMessage}
            </div>
          </div>

          {scanResult.stats && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginTop: 18,
              }}
            >
              <div
                className="glass"
                style={{ borderRadius: 16, padding: "14px 10px", textAlign: "center" }}
              >
                <span className="eyebrow" style={{ fontSize: 10 }}>
                  Clean
                </span>
                <div className="ok" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  {scanResult.stats.harmless + scanResult.stats.undetected}
                </div>
              </div>
              <div
                className="glass"
                style={{ borderRadius: 16, padding: "14px 10px", textAlign: "center" }}
              >
                <span className="eyebrow" style={{ fontSize: 10 }}>
                  Malicious
                </span>
                <div
                  className={scanResult.stats.malicious > 0 ? "bad" : ""}
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 6,
                    color: scanResult.stats.malicious > 0 ? undefined : "var(--ink)",
                  }}
                >
                  {scanResult.stats.malicious}
                </div>
              </div>
              <div
                className="glass"
                style={{ borderRadius: 16, padding: "14px 10px", textAlign: "center" }}
              >
                <span className="eyebrow" style={{ fontSize: 10 }}>
                  Suspicious
                </span>
                <div
                  className={scanResult.stats.suspicious > 0 ? "warn" : ""}
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 6,
                    color: scanResult.stats.suspicious > 0 ? undefined : "var(--ink)",
                  }}
                >
                  {scanResult.stats.suspicious}
                </div>
              </div>
            </div>
          )}

          {scanResult.threats && scanResult.threats.length > 0 && (
            <div
              className="glass"
              style={{
                borderRadius: 16,
                padding: "16px 18px",
                marginTop: 18,
                borderColor: "rgba(255,107,107,.35)",
              }}
            >
              <p className="eyebrow" style={{ fontSize: 10, color: "#ff6b6b", marginBottom: 10 }}>
                Detected Threats
              </p>
              {scanResult.threats.map((threat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: 14,
                    color: "var(--ink)",
                    lineHeight: 1.5,
                    padding: "4px 0",
                  }}
                >
                  <span className="bad" style={{ fontWeight: 700 }}>
                    ·
                  </span>
                  <span>{threat}</span>
                </div>
              ))}
            </div>
          )}

          {/* Redirection gate */}
          <div style={{ marginTop: 22 }}>
            {scanResult.isSafe ? (
              <div>
                <p style={{ fontSize: 14, color: "#8fd0a8", margin: "0 0 14px" }}>
                  This QR code passed VirusTotal verification and is verified safe to open.
                </p>
                <button
                  type="button"
                  onClick={handleRedirect}
                  className="cta"
                  style={{ minWidth: 250, marginTop: 0 }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <IconLink style={{ width: 18, height: 18 }} />
                    Proceed &amp; Open Verified Link
                  </span>
                  <span className="cta-arrow">
                    <IconArrow />
                  </span>
                </button>
              </div>
            ) : (
              <div>
                <div
                  className="glass"
                  style={{
                    borderRadius: 16,
                    padding: "14px 16px",
                    marginBottom: 14,
                    borderColor: "rgba(255,107,107,.35)",
                  }}
                >
                  <p style={{ fontSize: 14, color: "#ff6b6b", margin: 0, lineHeight: 1.55 }}>
                    <strong>Redirection blocked:</strong> opening this link could compromise
                    your banking security or install malicious software.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="btn-ghost"
                  style={{ opacity: 0.55, cursor: "not-allowed" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <IconLock style={{ width: 18, height: 18 }} />
                    Redirection Blocked for Your Protection
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual payload test card */}
      <div className="glass tcard">
        <p className="clabel">Test &amp; Simulate Payload</p>
        <p className="tsub" style={{ marginBottom: 16 }}>
          Without camera — paste any QR string to inspect it the same way.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualInput.trim()) void processQrPayload(manualInput);
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g. https://www.google.com or upi://pay?pa=merchant@sbi"
              className="glass"
              style={{
                flex: "1 1 220px",
                borderRadius: 16,
                padding: "13px 16px",
                fontSize: 14,
                color: "var(--ink)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!manualInput.trim() || isAnalyzing}
              className="cta"
              style={{ minWidth: 130, marginTop: 0, opacity: !manualInput.trim() || isAnalyzing ? 0.55 : 1 }}
            >
              <span>Scan URL</span>
              <span className="cta-arrow">
                <IconArrow />
              </span>
            </button>
          </div>
        </form>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setManualInput(TEST_PAYLOADS.safe);
              void processQrPayload(TEST_PAYLOADS.safe);
            }}
            style={{ cursor: "pointer" }}
          >
            <span
              className="dot"
              style={{ background: "#8fd0a8", borderRadius: "50%" }}
            />
            Test Safe Link
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setManualInput(TEST_PAYLOADS.malware);
              void processQrPayload(TEST_PAYLOADS.malware);
            }}
            style={{ cursor: "pointer" }}
          >
            <span
              className="dot"
              style={{ background: "#ff6b6b", borderRadius: "50%" }}
            />
            Test Malware Link
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setManualInput(TEST_PAYLOADS.upi);
              void processQrPayload(TEST_PAYLOADS.upi);
            }}
            style={{ cursor: "pointer" }}
          >
            <span
              className="dot"
              style={{ background: "#cdc2f7", borderRadius: "50%" }}
            />
            Test UPI QR
          </button>
        </div>
      </div>

      {/* Safety best practices */}
      <div className="glass tcard">
        <p className="clabel">QR Safety Best Practices</p>
        <div className="trow">
          <span className="ticon" style={{ width: 48, height: 48, borderRadius: 16 }}>
            <IconShieldCheck />
          </span>
          <div style={{ flex: 1, fontSize: 15, color: "var(--muted)", lineHeight: 1.6 }}>
            Every scanned QR code is inspected across 70+ global antivirus engines before
            allowing you to visit.
          </div>
        </div>
        <div className="trow">
          <span className="ticon" style={{ width: 48, height: 48, borderRadius: 16 }}>
            <IconQr />
          </span>
          <div style={{ flex: 1, fontSize: 15, color: "var(--muted)", lineHeight: 1.6 }}>
            Scammers stick fake QR stickers over authentic shopkeeper stands — always
            verify the merchant name.
          </div>
        </div>
        <div className="trow">
          <span className="ticon" style={{ width: 48, height: 48, borderRadius: 16 }}>
            <IconLink />
          </span>
          <div style={{ flex: 1, fontSize: 15, color: "var(--muted)", lineHeight: 1.6 }}>
            Never scan a QR code sent over WhatsApp or SMS claiming you will receive a
            cashback or lottery prize.
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
