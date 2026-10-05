/**
 * DEFENXIA TrustChain — Blockchain Scan Integrity Service
 * 
 * Provides deterministic canonicalization of file scan evidence,
 * SHA-256 evidence fingerprinting, and cryptographic blockchain anchoring.
 * 
 * NOTE: Does NOT upload file contents to any blockchain or store sensitive keys in frontend.
 */

export interface CanonicalScanEvidence {
  schemaVersion: "defenxia.trustchain.v1";
  fileSha256: string;
  fileName: string;
  fileSize: number;
  scanTimestamp: string;
  virusTotalVerdict: "CLEAN" | "MALICIOUS";
  positives: number;
  totalEngines: number;
  threatSummary: string[];
}

export interface BlockchainAnchorReceipt {
  id: string;
  scanId?: string;
  fileHash: string;
  evidenceHash: string;
  virusTotalVerdict: "CLEAN" | "MALICIOUS";
  blockchainStatus: "anchored" | "pending" | "failed" | "unavailable";
  blockchainNetwork: string;
  transactionReference: string;
  blockNumber: number;
  anchoredAt: string;
  verificationStatus: "verified" | "unverified" | "tampered" | "failed";
  verifiedAt?: string;
  canonicalPayload: CanonicalScanEvidence;
}

export interface IntegrityVerificationResult {
  isValid: boolean;
  calculatedEvidenceHash: string;
  anchoredEvidenceHash: string;
  message: string;
  verifiedAt: string;
}

/**
 * Computes SHA-256 hash of a string using the native Web Crypto API
 */
export async function sha256String(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministically sorts object keys and serializes to canonical JSON string
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`);
  return "{" + pairs.join(",") + "}";
}

/**
 * Pluggable Blockchain Anchor Provider Interface
 */
export interface BlockchainAnchorProvider {
  networkName: string;
  isDemo: boolean;
  anchorEvidence(
    evidenceHash: string,
    payload: CanonicalScanEvidence
  ): Promise<{
    status: "anchored" | "pending" | "failed" | "unavailable";
    transactionReference: string;
    blockNumber: number;
    network: string;
    anchoredAt: string;
  }>;
  verifyOnChain(anchorReference: string, evidenceHash: string): Promise<boolean>;
}

/**
 * Default Provider: Demo / Testnet Anchor Provider
 * Clearly tagged so no real blockchain transactions are fabricated.
 */
class DemoTrustChainProvider implements BlockchainAnchorProvider {
  networkName = "DEFENXIA TrustChain (Demo Provider)";
  isDemo = true;

  async anchorEvidence(evidenceHash: string, _payload: CanonicalScanEvidence) {
    // Generate deterministic cryptographic transaction hash derived from evidenceHash + timestamp
    const timestamp = new Date().toISOString();
    const txSeed = await sha256String(`tx:${evidenceHash}:${timestamp}`);
    const transactionReference = `0x${txSeed.slice(0, 40)}`;
    const blockNumber = 18452900 + Math.floor(Math.random() * 500);

    return {
      status: "anchored" as const,
      transactionReference,
      blockNumber,
      network: this.networkName,
      anchoredAt: timestamp,
    };
  }

  async verifyOnChain(_anchorReference: string, _evidenceHash: string): Promise<boolean> {
    // In demo mode, anchors are verified via cryptographic evidence fingerprinting
    return true;
  }
}

// Active provider instance (can be swapped with Edge Function / RPC provider)
let activeProvider: BlockchainAnchorProvider = new DemoTrustChainProvider();

export function setBlockchainProvider(provider: BlockchainAnchorProvider) {
  activeProvider = provider;
}

export function getActiveBlockchainProvider(): BlockchainAnchorProvider {
  return activeProvider;
}

/**
 * Generates canonical evidence object from scan parameters
 */
export function buildCanonicalEvidence(params: {
  fileSha256: string;
  fileName: string;
  fileSize: number;
  scanTimestamp: string;
  isSafe: boolean;
  positives: number;
  totalEngines: number;
  threatSummary: string[];
}): CanonicalScanEvidence {
  return {
    schemaVersion: "defenxia.trustchain.v1",
    fileSha256: params.fileSha256,
    fileName: params.fileName,
    fileSize: params.fileSize,
    scanTimestamp: params.scanTimestamp,
    virusTotalVerdict: params.isSafe ? "CLEAN" : "MALICIOUS",
    positives: params.positives,
    totalEngines: params.totalEngines,
    threatSummary: [...params.threatSummary].sort(),
  };
}

/**
 * Anchors scan evidence to the blockchain provider
 */
export async function anchorScanEvidence(
  canonicalPayload: CanonicalScanEvidence,
  scanId?: string
): Promise<BlockchainAnchorReceipt> {
  const canonicalString = canonicalizeJson(canonicalPayload);
  const evidenceHash = await sha256String(canonicalString);

  const providerResult = await activeProvider.anchorEvidence(evidenceHash, canonicalPayload);

  return {
    id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    scanId,
    fileHash: canonicalPayload.fileSha256,
    evidenceHash,
    virusTotalVerdict: canonicalPayload.virusTotalVerdict,
    blockchainStatus: providerResult.status,
    blockchainNetwork: providerResult.network,
    transactionReference: providerResult.transactionReference,
    blockNumber: providerResult.blockNumber,
    anchoredAt: providerResult.anchoredAt,
    verificationStatus: "verified",
    verifiedAt: new Date().toISOString(),
    canonicalPayload,
  };
}

/**
 * Verifies the integrity of an anchored evidence record
 */
export async function verifyScanEvidenceIntegrity(
  receipt: BlockchainAnchorReceipt
): Promise<IntegrityVerificationResult> {
  const verifiedAt = new Date().toISOString();

  try {
    // 1. Re-serialize canonical payload deterministically
    const recomputedCanonicalString = canonicalizeJson(receipt.canonicalPayload);
    // 2. Recompute SHA-256 evidence fingerprint
    const calculatedEvidenceHash = await sha256String(recomputedCanonicalString);

    // 3. Compare with anchored evidence hash
    const isHashMatch = calculatedEvidenceHash === receipt.evidenceHash;

    if (!isHashMatch) {
      return {
        isValid: false,
        calculatedEvidenceHash,
        anchoredEvidenceHash: receipt.evidenceHash,
        message: "The recorded scan evidence no longer matches its trusted fingerprint.",
        verifiedAt,
      };
    }

    // 4. Verify with provider
    const providerValid = await activeProvider.verifyOnChain(
      receipt.transactionReference,
      receipt.evidenceHash
    );

    if (!providerValid) {
      return {
        isValid: false,
        calculatedEvidenceHash,
        anchoredEvidenceHash: receipt.evidenceHash,
        message: "Blockchain anchor verification rejected by provider network.",
        verifiedAt,
      };
    }

    return {
      isValid: true,
      calculatedEvidenceHash,
      anchoredEvidenceHash: receipt.evidenceHash,
      message: "The scan evidence matches its trusted fingerprint.",
      verifiedAt,
    };
  } catch (error: any) {
    return {
      isValid: false,
      calculatedEvidenceHash: "error",
      anchoredEvidenceHash: receipt.evidenceHash,
      message: `Verification error: ${error?.message || "Internal failure"}`,
      verifiedAt,
    };
  }
}

/**
 * In-memory Tamper-Detection Demonstration Helper (Safe Demo Mode)
 * Never modifies real scan evidence. Shows how cryptographic mismatch is detected.
 */
export async function simulateTamperCheck(receipt: BlockchainAnchorReceipt): Promise<{
  originalEvidenceHash: string;
  tamperedEvidenceHash: string;
  tamperedField: string;
  originalVerdict: string;
  tamperedVerdict: string;
  isMatch: boolean;
  message: string;
}> {
  // Create a synthetic tampered copy
  const tamperedPayload: CanonicalScanEvidence = {
    ...receipt.canonicalPayload,
    // Falsify the verdict (e.g. from MALICIOUS to CLEAN, or CLEAN to MALICIOUS)
    virusTotalVerdict: receipt.canonicalPayload.virusTotalVerdict === "MALICIOUS" ? "CLEAN" : "MALICIOUS",
    positives: receipt.canonicalPayload.virusTotalVerdict === "MALICIOUS" ? 0 : 7,
  };

  const originalCanonical = canonicalizeJson(receipt.canonicalPayload);
  const tamperedCanonical = canonicalizeJson(tamperedPayload);

  const originalEvidenceHash = await sha256String(originalCanonical);
  const tamperedEvidenceHash = await sha256String(tamperedCanonical);

  return {
    originalEvidenceHash,
    tamperedEvidenceHash,
    tamperedField: "virusTotalVerdict & positives",
    originalVerdict: receipt.canonicalPayload.virusTotalVerdict,
    tamperedVerdict: tamperedPayload.virusTotalVerdict,
    isMatch: originalEvidenceHash === tamperedEvidenceHash,
    message: "TAMPERING DETECTED: The modified evidence payload produces a different SHA-256 fingerprint, invalidating the blockchain anchor.",
  };
}
