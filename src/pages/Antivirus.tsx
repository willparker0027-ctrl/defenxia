import { useState } from "react";
import { IconShieldCheck, IconBug, IconArrow, IconFileSearch } from "@/components/mockup/icons";

/**
 * Antivirus — full simulated scan logic preserved,
 * re-skinned in the reference mockup's visual language.
 */
const Antivirus = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filesScanned, setFilesScanned] = useState(0);
  const [threatsFound, setThreatsFound] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [scanComplete, setScanComplete] = useState(false);

  const sampleFiles = [
    "C:\\Windows\\System32\\drivers\\etc\\hosts",
    "C:\\Program Files\\Browser\\chrome.exe",
    "C:\\Users\\Documents\\report.pdf",
    "C:\\Windows\\Temp\\installer.tmp",
    "C:\\Program Files\\Antivirus\\scanner.dll",
    "C:\\Users\\Downloads\\software.exe",
    "C:\\Windows\\System32\\kernel32.dll",
    "C:\\Program Files\\Office\\winword.exe",
    "C:\\Users\\Pictures\\vacation.jpg",
    "C:\\Windows\\System32\\ntdll.dll"
  ];

  const startScan = () => {
    setIsScanning(true);
    setProgress(0);
    setFilesScanned(0);
    setThreatsFound(0);
    setScanComplete(false);

    let fileIndex = 0;
    const totalFiles = 1247; // Simulated total

    const interval = setInterval(() => {
      if (fileIndex < sampleFiles.length) {
        setCurrentFile(sampleFiles[fileIndex]);
        const newProgress = ((fileIndex + 1) / sampleFiles.length) * 100;
        setProgress(newProgress);
        setFilesScanned(Math.floor((newProgress / 100) * totalFiles));

        // Randomly find threats
        if (Math.random() > 0.8) {
          setThreatsFound(prev => prev + 1);
        }

        fileIndex++;
      } else {
        clearInterval(interval);
        setIsScanning(false);
        setScanComplete(true);
        setProgress(100);
        setFilesScanned(totalFiles);
      }
    }, 800);
  };

  const resetScan = () => {
    setScanComplete(false);
    setProgress(0);
    setFilesScanned(0);
    setThreatsFound(0);
  };

  return (
    <div className="tpage">
      <span className="eyebrow">ANTIVIRUS</span>
      <h1 className="serif">Deep system scan.</h1>
      <p className="tsub">Full system scan to detect and eliminate malware threats.</p>

      <div className="glass tcard">
        {!isScanning && !scanComplete && (
          <div style={{ textAlign: "center" }}>
            <div className="ticon" style={{ margin: "0 auto 18px" }}>
              <IconShieldCheck />
            </div>
            <h3>System Protection Ready</h3>
            <p style={{ maxWidth: "30ch", margin: "0 auto 6px" }}>
              Run a comprehensive system scan to detect malware and threats.
            </p>
            <button type="button" onClick={startScan} className="cta" style={{ width: "100%" }}>
              <span>Start Full System Scan</span>
              <span className="cta-arrow">
                <IconArrow />
              </span>
            </button>
          </div>
        )}

        {isScanning && (
          <div style={{ textAlign: "center" }}>
            <div className="ticon animate-pulse-aurora" style={{ margin: "0 auto 18px" }}>
              <IconBug />
            </div>
            <p className="clabel">Scanning system</p>
            <div className="serif" style={{ fontSize: 48 }}>{Math.round(progress)}%</div>
            <div className="pbar" style={{ margin: "18px 0 6px" }}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="kv">
              <span className="k">Files scanned</span>
              <span className="v">{filesScanned.toLocaleString()}</span>
            </div>
            <div className="kv">
              <span className="k">Threats found</span>
              <span className="v">{threatsFound}</span>
            </div>
            <p className="clabel" style={{ marginTop: 20 }}>Currently scanning</p>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12.5,
                wordBreak: "break-all",
                color: "var(--faint)",
              }}
            >
              {currentFile}
            </p>
          </div>
        )}

        {scanComplete && (
          <div>
            <div style={{ textAlign: "center" }}>
              <div className="ticon" style={{ margin: "0 auto 18px" }}>
                {threatsFound === 0 ? <IconShieldCheck /> : <IconBug />}
              </div>
              <p className="clabel">Scan complete</p>
              <h3 style={{ color: threatsFound === 0 ? "#8fd0a8" : "#ff6b6b", fontSize: 34 }}>
                {threatsFound === 0
                  ? "0 Threats Found"
                  : `${threatsFound} Threat${threatsFound > 1 ? "s" : ""} Found`}
              </h3>
              <p>Scanned {filesScanned.toLocaleString()} files in total.</p>
            </div>

            <div className="kv">
              <span className="k">Files scanned</span>
              <span className="v">{filesScanned.toLocaleString()}</span>
            </div>
            <div className="kv">
              <span className="k">Files quarantined</span>
              <span className="v">0</span>
            </div>
            <div className="kv">
              <span className="k">Threats detected</span>
              <span className="v">{threatsFound}</span>
            </div>

            {threatsFound > 0 && (
              <div style={{ marginTop: 6 }}>
                <p className="clabel" style={{ marginTop: 20 }}>Threats detected</p>
                <div className="trow">
                  <div className="ticon" style={{ width: 46, height: 46, borderRadius: 15, flexShrink: 0 }}>
                    <IconFileSearch />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      Trojan.Generic.KD.12345
                    </div>
                  </div>
                  <span className="chip" style={{ color: "#ff6b6b" }}>Quarantined</span>
                </div>
                <div className="trow">
                  <div className="ticon" style={{ width: 46, height: 46, borderRadius: 15, flexShrink: 0 }}>
                    <IconFileSearch />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      Adware.Tracking.Cookie
                    </div>
                  </div>
                  <span className="chip" style={{ color: "#ff6b6b" }}>Removed</span>
                </div>
              </div>
            )}

            <button type="button" onClick={resetScan} className="btn-ghost" style={{ width: "100%", marginTop: 20 }}>
              Run New Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Antivirus;
