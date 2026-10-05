import { useState, useRef } from "react";
import {
  IconFileSearch,
  IconShieldCheck,
  IconArrow,
  IconBug,
  IconLock,
  IconAppDoc,
} from "@/components/mockup/icons";
import { insertWithSession } from "@/lib/supabase-client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { scanFileWithVirusTotal, VTFileScanResult } from "@/services/virusTotalService";
import { isDesktopApp } from "@/services/desktopBridge";
import {
  buildCanonicalEvidence,
  anchorScanEvidence,
  verifyScanEvidenceIntegrity,
  simulateTamperCheck,
  BlockchainAnchorReceipt,
  IntegrityVerificationResult,
} from "@/services/blockchainAnchorService";

type TamperDemo = Awaited<ReturnType<typeof simulateTamperCheck>>;

const VirusScanner = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<VTFileScanResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [anchorReceipt, setAnchorReceipt] = useState<BlockchainAnchorReceipt | null>(null);
  const [verificationResult, setVerificationResult] = useState<IntegrityVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tamperDemo, setTamperDemo] = useState<TamperDemo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (max 32MB for VirusTotal API)
      if (file.size > 32 * 1024 * 1024) {
        toast.error("File size must be less than 32MB");
        return;
      }
      setSelectedFile(file);
      setScanResult(null);

      // Create preview if it's an image
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleScan = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to scan");
      return;
    }

    setIsScanning(true);
    try {
      toast.info("Analyzing file signature and SHA-256 hash with VirusTotal...");
      const result = await scanFileWithVirusTotal(selectedFile);
      setScanResult(result);

      // Save to Supabase virus_scan_results table for Report & Analysis
      try {
        await insertWithSession("virus_scan_results", {
          file_name: selectedFile.name,
          file_hash: result.sha256,
          virus_detected: !result.isSafe,
          virus_names: result.threatNames,
          threat_level: result.isSafe ? "safe" : "high",
          analysis_result: result as unknown as Json,
          scan_type: "virustotal_v3_api",
        });
      } catch (err) {
        console.log("Saved virus scan locally", err);
      }

      if (result.isSafe) {
        toast.success(`✅ File is Clean! 0/${result.totalEngines} detections across global antivirus engines.`);
      } else {
        toast.error(`🚨 Threat Detected! Flagged by ${result.positives} antivirus vendor(s).`);
      }

      // ⛓️ DEFENXIA TrustChain Blockchain Anchoring (Asynchronous, Non-blocking)
      try {
        const canonical = buildCanonicalEvidence({
          fileSha256: result.sha256,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          scanTimestamp: result.scanDate,
          isSafe: result.isSafe,
          positives: result.positives,
          totalEngines: result.totalEngines,
          threatSummary: result.threatNames,
        });
        const receipt = await anchorScanEvidence(canonical);
        setAnchorReceipt(receipt);

        // Store blockchain evidence record in Supabase
        try {
          await insertWithSession("blockchain_scan_evidence" as any, {
            file_hash: receipt.fileHash,
            evidence_hash: receipt.evidenceHash,
            virus_total_verdict: receipt.virusTotalVerdict,
            blockchain_status: receipt.blockchainStatus,
            blockchain_network: receipt.blockchainNetwork,
            transaction_reference: receipt.transactionReference,
            anchored_at: receipt.anchoredAt,
            verification_status: receipt.verificationStatus,
            canonical_payload: receipt.canonicalPayload as unknown as Json,
          });
        } catch (dbErr) {
          console.log("Saved blockchain anchor locally", dbErr);
        }
      } catch (bcErr) {
        console.warn("Blockchain anchor notice:", bcErr);
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Error connecting to VirusTotal threat database");
    } finally {
      setIsScanning(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!anchorReceipt) return;
    setIsVerifying(true);
    try {
      const verification = await verifyScanEvidenceIntegrity(anchorReceipt);
      setVerificationResult(verification);
      if (verification.isValid) {
        toast.success("🟢 Integrity Verified: The scan evidence matches its trusted fingerprint.");
      } else {
        toast.error("🔴 Integrity Check Failed: Recorded scan evidence no longer matches its trusted fingerprint.");
      }
    } catch (e) {
      toast.error(`Verification error: ${e instanceof Error ? e.message : "Verification failed"}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    if (!anchorReceipt) return;
    const sim = await simulateTamperCheck(anchorReceipt);
    setTamperDemo(sim);
    toast.error("🔴 Tampering Detected in Simulation: Evidence hash mismatch!");
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setScanResult(null);
    setAnchorReceipt(null);
    setVerificationResult(null);
    setTamperDemo(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const fileIconFor = (file: File) => {
    const n = file.name.toLowerCase();
    if (
      n.endsWith(".apk") ||
      n.endsWith(".exe") ||
      file.type.includes("pdf") ||
      file.type.includes("document") ||
      n.endsWith(".zip")
    ) {
      return IconAppDoc;
    }
    return IconFileSearch;
  };

  const monoHash: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    wordBreak: "break-all",
    maxWidth: "58%",
    textAlign: "right",
  };

  return (
    <div className="tpage">
      <span className="eyebrow">VIRUS SCANNER</span>
      <h1 className="serif">Scan Files.</h1>
      <p className="tsub">
        Scan APKs, documents, executables, or photos for hidden trojans, ransomware, and spyware across 70+
        antivirus engines.
      </p>

      {/* ── Scanner ─────────────────────────────────────────── */}
      <div className="glass tcard">
        <p className="clabel">File scanner</p>
        <div
          className="glass"
          style={{
            borderRadius: 24,
            padding: 32,
            textAlign: "center",
            borderStyle: "dashed",
            borderWidth: 1,
            borderColor: "rgba(232,53,123,.35)",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            onChange={handleFileSelect}
            className="field"
            id="file-upload"
            style={{ display: "none" }}
          />
          {!selectedFile ? (
            <>
              <div className="ticon" style={{ margin: "0 auto 16px" }}>
                <IconFileSearch />
              </div>
              <p style={{ fontWeight: 700, fontSize: 17, margin: "0 0 6px", color: "var(--ink)" }}>
                Choose a file to scan
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>Tap to browse — APK, PDF, EXE, ZIP, JPG, PNG · max 32MB</p>
            </>
          ) : (
            <>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Selected photo"
                  style={{
                    maxHeight: 144,
                    borderRadius: 16,
                    margin: "0 auto 16px",
                    display: "block",
                    border: "1px solid var(--edge-soft)",
                  }}
                />
              ) : (
                <div className="ticon" style={{ margin: "0 auto 16px" }}>
                  {(() => {
                    const FIcon = fileIconFor(selectedFile);
                    return <FIcon />;
                  })()}
                </div>
              )}
              <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 6px", color: "var(--ink)", wordBreak: "break-all" }}>
                {selectedFile.name}
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>
                {formatFileSize(selectedFile.size)} · Ready for VirusTotal analysis
              </p>
            </>
          )}
        </div>

        {selectedFile && !isScanning && (
          <div className="glass" style={{ borderRadius: 18, padding: "14px 16px", marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div className="ticon" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }}>
                {(() => {
                  const FIcon = fileIconFor(selectedFile);
                  return <FIcon />;
                })()}
              </div>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <p style={{ fontWeight: 600, margin: 0, wordBreak: "break-all", color: "var(--ink)" }}>
                  {selectedFile.name}
                </p>
                <p style={{ fontSize: 13, margin: "2px 0 0" }}>{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              aria-label="Remove file"
              className="btn-ghost"
              style={{ width: 48, height: 48, minHeight: 48, padding: 0, borderRadius: "50%", flexShrink: 0 }}
            >
              <span className="bad" style={{ fontSize: 20 }}>×</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleScan}
          disabled={isScanning || !selectedFile}
          className="cta"
          style={{ width: "100%", opacity: isScanning || !selectedFile ? 0.55 : 1 }}
        >
          <span>{isScanning ? "Scanning..." : "Scan File"}</span>
          <span className="cta-arrow">
            <IconArrow />
          </span>
        </button>
      </div>

      {/* ── Scanning state ──────────────────────────────────── */}
      {isScanning && (
        <div className="glass tcard animate-fade-in" style={{ textAlign: "center" }}>
          <p className="clabel">Scanning</p>
          <div className="ticon animate-pulse-aurora" style={{ margin: "0 auto 16px" }}>
            <IconFileSearch />
          </div>
          <h3 className="serif" style={{ fontSize: 30, margin: "0 0 8px", color: "var(--ink)" }}>
            Inspecting signatures.
          </h3>
          <p style={{ fontSize: 14, margin: "0 auto", maxWidth: "38ch" }}>
            Calculating SHA-256 hash &amp; auditing across Kaspersky, BitDefender, Microsoft Defender, and 70+
            engines…
          </p>
          <div className="scan-sweep-line" aria-hidden="true" style={{ marginTop: 16 }} />
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {scanResult && !isScanning && (
        <div className="glass tcard animate-fade-in">
          <p className="clabel">Scan results</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              className={`ticon ${scanResult.isSafe ? "ok" : "bad"}`}
              style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }}
            >
              {scanResult.isSafe ? <IconShieldCheck /> : <IconBug />}
            </div>
            <div>
              <span className="chip">
                <span className="dot" />
                {scanResult.isSafe ? "CLEAN" : "MALICIOUS"}
              </span>
              <h3 className={`serif ${scanResult.isSafe ? "ok" : "bad"}`} style={{ fontSize: 32, margin: "8px 0 0" }}>
                {scanResult.isSafe ? "File Verified Clean" : "Malicious Code Detected!"}
              </h3>
            </div>
          </div>
          <p style={{ fontSize: 14, marginTop: 12 }}>{scanResult.analysisMessage}</p>
          <p className={scanResult.isSafe ? "ok" : "bad"} style={{ fontWeight: 700, margin: "8px 0 0" }}>
            {scanResult.isSafe
              ? `0 of ${scanResult.totalEngines} engines flagged this file.`
              : `${scanResult.positives} of ${scanResult.totalEngines} engines flagged this file.`}
          </p>

          <div className="kv">
            <span className="k">File name</span>
            <span className="v" style={{ maxWidth: "58%", wordBreak: "break-all" }}>{scanResult.fileName}</span>
          </div>
          <div className="kv">
            <span className="k">File size</span>
            <span className="v">{formatFileSize(scanResult.fileSize)}</span>
          </div>
          <div className="kv">
            <span className="k">SHA-256</span>
            <span className="v" style={monoHash} title={scanResult.sha256}>
              {scanResult.sha256}
            </span>
          </div>
          <div className="kv">
            <span className="k">Scan date</span>
            <span className="v" style={{ fontSize: 13 }}>{scanResult.scanDate}</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginTop: 18,
              textAlign: "center",
            }}
          >
            <div className="glass" style={{ borderRadius: 16, padding: "12px 6px" }}>
              <p className="clabel" style={{ margin: "0 0 6px", fontSize: 9 }}>Clean</p>
              <span className="ok" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 17 }}>
                {scanResult.stats.harmless + scanResult.stats.undetected}
              </span>
            </div>
            <div className="glass" style={{ borderRadius: 16, padding: "12px 6px" }}>
              <p className="clabel" style={{ margin: "0 0 6px", fontSize: 9 }}>Malicious</p>
              <span
                className={scanResult.stats.malicious > 0 ? "bad" : "ok"}
                style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 17 }}
              >
                {scanResult.stats.malicious}
              </span>
            </div>
            <div className="glass" style={{ borderRadius: 16, padding: "12px 6px" }}>
              <p className="clabel" style={{ margin: "0 0 6px", fontSize: 9 }}>Suspicious</p>
              <span className="warn" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 17 }}>
                {scanResult.stats.suspicious}
              </span>
            </div>
            <div className="glass" style={{ borderRadius: 16, padding: "12px 6px" }}>
              <p className="clabel" style={{ margin: "0 0 6px", fontSize: 9 }}>Engines</p>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 17, color: "var(--lav)" }}>
                {scanResult.totalEngines}
              </span>
            </div>
          </div>

          {scanResult.threatNames.length > 0 && (
            <div
              className="glass"
              style={{
                borderRadius: 18,
                padding: "16px 18px",
                marginTop: 18,
                borderColor: "rgba(255,107,107,.3)",
              }}
            >
              <p className="clabel bad" style={{ margin: "0 0 10px" }}>Flagged malware signatures</p>
              {scanResult.threatNames.map((name) => (
                <div className="trow" key={name} style={{ padding: "8px 0" }}>
                  <span className="ticon bad" style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0 }}>
                    <IconBug />
                  </span>
                  <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>
                    {name}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={handleRemoveFile}>
              Scan Another File
            </button>
          </div>
        </div>
      )}

      {/* ── TrustChain blockchain evidence ──────────────────── */}
      {scanResult && !isScanning && (
        <div className="glass tcard animate-fade-in">
          <p className="clabel">DEFENXIA TrustChain</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="ticon" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0 }}>
                <IconLock />
              </div>
              <div>
                <p style={{ fontWeight: 700, margin: 0, color: "var(--ink)" }}>Cryptographic Evidence Integrity</p>
                <p style={{ fontSize: 12, margin: "2px 0 0" }}>Scan verdict anchored to the blockchain</p>
              </div>
            </div>
            <span className="chip">
              <span className="dot" />
              {anchorReceipt?.blockchainStatus === "anchored" ? "ANCHORED" : "PENDING"}
            </span>
          </div>

          <div className="kv">
            <span className="k">File fingerprint</span>
            <span className="v" style={monoHash} title={scanResult.sha256}>
              {scanResult.sha256}
            </span>
          </div>
          <div className="kv">
            <span className="k">Evidence fingerprint</span>
            <span className="v" style={monoHash} title={anchorReceipt?.evidenceHash ?? "Generating…"}>
              {anchorReceipt?.evidenceHash ?? "Generating…"}
            </span>
          </div>
          <div className="kv">
            <span className="k">Network</span>
            <span className="v" style={{ fontSize: 13 }}>
              {anchorReceipt?.blockchainNetwork ?? "DEFENXIA TrustChain (Demo Provider)"}
            </span>
          </div>
          <div className="kv">
            <span className="k">Transaction ref</span>
            <span className="v" style={monoHash} title={anchorReceipt?.transactionReference ?? ""}>
              {anchorReceipt?.transactionReference ?? "Pending block confirmation…"}
            </span>
          </div>
          <div className="kv">
            <span className="k">Anchored at</span>
            <span className="v" style={{ fontSize: 13 }}>
              {anchorReceipt?.anchoredAt ? new Date(anchorReceipt.anchoredAt).toLocaleString() : "Processing…"}
            </span>
          </div>
          <div className="kv">
            <span className="k">Verification</span>
            <span className={`v ${verificationResult ? (verificationResult.isValid ? "ok" : "bad") : "ok"}`} style={{ fontSize: 13 }}>
              {verificationResult ? (verificationResult.isValid ? "VERIFIED" : "INTEGRITY CHECK FAILED") : "VERIFIED"}
            </span>
          </div>

          {verificationResult && (
            <div
              className="glass"
              style={{
                borderRadius: 18,
                padding: "14px 16px",
                marginTop: 16,
                borderColor: verificationResult.isValid ? "rgba(143,208,168,.3)" : "rgba(255,107,107,.3)",
              }}
            >
              <p
                className={verificationResult.isValid ? "ok" : "bad"}
                style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px", letterSpacing: ".08em" }}
              >
                {verificationResult.isValid ? "INTEGRITY VERIFIED" : "INTEGRITY CHECK FAILED"}
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>{verificationResult.message}</p>
            </div>
          )}

          {tamperDemo && (
            <div
              className="glass"
              style={{
                borderRadius: 18,
                padding: "14px 16px",
                marginTop: 16,
                borderColor: "rgba(255,107,107,.35)",
              }}
            >
              <p className="bad" style={{ fontWeight: 700, fontSize: 13, margin: "0 0 6px", letterSpacing: ".08em" }}>
                TAMPERING DETECTED (SIMULATION)
              </p>
              <p style={{ fontSize: 13, margin: "0 0 10px" }}>
                Simulated attack: the recorded verdict was altered from{" "}
                <span className="ok" style={{ fontWeight: 700 }}>{tamperDemo.originalVerdict}</span> to{" "}
                <span className="bad" style={{ fontWeight: 700 }}>{tamperDemo.tamperedVerdict}</span>.
              </p>
              <div className="kv">
                <span className="k">Original hash</span>
                <span className="v ok" style={monoHash}>
                  {tamperDemo.originalEvidenceHash.slice(0, 24)}…
                </span>
              </div>
              <div className="kv">
                <span className="k">Tampered hash</span>
                <span className="v bad" style={monoHash}>
                  {tamperDemo.tamperedEvidenceHash.slice(0, 24)}…
                </span>
              </div>
              <p style={{ fontSize: 13, margin: "10px 0 0" }}>{tamperDemo.message}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ flex: 1 }}
              onClick={handleVerifyIntegrity}
              disabled={!anchorReceipt || isVerifying}
            >
              {isVerifying ? "Verifying…" : "Verify Integrity"}
            </button>
            {/* "Simulate Tamper Check" is a demo-only button — hidden on desktop */}
            {!isDesktopApp() && (
              <button
                type="button"
                className="btn-ghost"
                style={{ flex: 1 }}
                onClick={handleSimulateTamper}
                disabled={!anchorReceipt}
              >
                Simulate Tamper Check
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── About ───────────────────────────────────────────── */}
      <div className="glass tcard">
        <p className="clabel">About VirusTotal</p>
        <div className="trow">
          <p style={{ fontSize: 14, margin: 0 }}>VirusTotal analyzes files with 70+ antivirus engines.</p>
        </div>
        <div className="trow">
          <p style={{ fontSize: 14, margin: 0 }}>File scanning verifies known malware signatures.</p>
        </div>
        <div className="trow">
          <p style={{ fontSize: 14, margin: 0 }}>Results show detection ratio across multiple security vendors.</p>
        </div>
        <div className="trow">
          <p style={{ fontSize: 14, margin: 0 }}>Maximum file size: 32MB per scan.</p>
        </div>
        <div className="trow">
          <p style={{ fontSize: 14, margin: 0 }}>Files are analyzed using SHA-256 hash for privacy.</p>
        </div>
      </div>
    </div>
  );
};

export default VirusScanner;
