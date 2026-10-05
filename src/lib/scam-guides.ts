export interface ScamGuide {
  slug: string;
  title: string;
  what: string;
  symptoms: string[];
  prevent: string[];
  immediate: string[];
  dos: string[];
  donts: string[];
}

export const scamGuides: ScamGuide[] = [
  {
    slug: "upi-fraud",
    title: "UPI Fraud",
    what: "UPI fraud is any scam where a criminal tricks you into approving a payment, sharing your UPI PIN, or installing a remote-access app so they can drain your bank account through PhonePe, Google Pay, BHIM or Paytm.",
    symptoms: [
      "You receive a 'collect request' asking you to enter your UPI PIN to RECEIVE money",
      "Caller claims to be from bank/KYC team and asks for OTP or PIN",
      "You are asked to install AnyDesk, TeamViewer or QuickSupport",
      "Unknown debit alerts right after a call or link click",
    ],
    prevent: [
      "UPI PIN is needed only to SEND money, never to receive it",
      "Never install screen-sharing apps requested by a caller",
      "Verify merchant VPA before paying; avoid paying from links in SMS",
      "Set a low daily UPI limit in your bank app",
    ],
    immediate: [
      "Call 1930 within the golden hour (first 24 hours) to freeze the transfer",
      "Report on cybercrime.gov.in with the transaction ID",
      "Inform your bank and block UPI on the affected account",
      "Uninstall any remote-access app and change your PINs",
    ],
    dos: [
      "Do check the payee name on the approval screen",
      "Do keep SMS and app notifications switched on",
      "Do save the 1930 helpline in your contacts",
    ],
    donts: [
      "Do not enter UPI PIN for incoming money",
      "Do not share OTP, CVV or card number with anyone",
      "Do not scan a QR code sent to you to 'receive' a refund",
    ],
  },
  {
    slug: "qr-scam",
    title: "QR Scam",
    what: "In a QR scam the fraudster sends you a QR code claiming it will credit money to you. Scanning it actually authorises a debit from your account, or opens a phishing page that steals your credentials.",
    symptoms: [
      "Seller on OLX/Facebook sends a QR code to 'pay you'",
      "QR code stickers pasted over the original shop QR",
      "Scanning opens a login page asking for bank details",
    ],
    prevent: [
      "Scanning a QR can only SEND money — never receive it",
      "Use DEFENXIA's Scan QR Code module before scanning unknown codes",
      "At shops, confirm the merchant name shown after scanning",
    ],
    immediate: [
      "Stop the transaction and screenshot the QR",
      "Call 1930 and report on cybercrime.gov.in",
      "Report the seller profile to the marketplace",
    ],
    dos: [
      "Do verify the merchant name and amount before approving",
      "Do prefer typing the UPI ID over scanning forwarded codes",
    ],
    donts: [
      "Do not scan QR codes received on WhatsApp from strangers",
      "Do not approve a payment you did not initiate",
    ],
  },
  {
    slug: "otp-scam",
    title: "OTP Scam",
    what: "OTP scams use urgency and impersonation — fake bank staff, delivery agents or electricity board officials — to make you read out the one-time password that authorises a transaction or account takeover.",
    symptoms: [
      "Caller already knows your name and partial card number",
      "Threat of account block, electricity cut or parcel return",
      "OTP SMS arrives for an action you never started",
    ],
    prevent: [
      "No bank, RBI or government official ever asks for an OTP",
      "Read the OTP SMS text — it always states what is being authorised",
      "Enable DEFENXIA AI SMS Shield to flag scam messages",
    ],
    immediate: [
      "Disconnect the call and never repeat the OTP",
      "If shared, call your bank immediately and freeze the card/account",
      "Call 1930 and file a complaint on cybercrime.gov.in",
    ],
    dos: [
      "Do call the number printed on your own debit card to verify",
      "Do report the calling number in your complaint",
    ],
    donts: [
      "Do not share OTP even with 'bank employees'",
      "Do not act under time pressure created by the caller",
    ],
  },
  {
    slug: "fake-loan-app",
    title: "Fake Loan App",
    what: "Fake instant-loan apps disburse a small amount, harvest your contacts and gallery, then use blackmail and extortion with sky-high interest and morphed photos.",
    symptoms: [
      "App not listed with an RBI-registered NBFC",
      "Demands contacts, SMS and gallery permission at install",
      "Money credited without any documentation, huge processing fee cut",
      "Abusive recovery calls and messages to your contacts",
    ],
    prevent: [
      "Borrow only from RBI-registered lenders listed on rbi.org.in",
      "Use DEFENXIA App Permission Check before granting access",
      "Never grant contacts or gallery access to a lending app",
    ],
    immediate: [
      "Do not pay extortion demands; keep all evidence",
      "Report on cybercrime.gov.in and to RBI Sachet",
      "Revoke app permissions and uninstall the app",
      "File a local police complaint for harassment",
    ],
    dos: [
      "Do check the lender's NBFC registration number",
      "Do read the loan agreement and total repayment amount",
    ],
    donts: [
      "Do not install loan APKs shared over WhatsApp or Telegram",
      "Do not give a fake app access to your contacts",
    ],
  },
  {
    slug: "sim-swap",
    title: "SIM Swap Attack",
    what: "In a SIM swap the attacker gets a duplicate SIM of your number, so all your banking OTPs land on their phone while your own SIM goes dead.",
    symptoms: [
      "Sudden loss of network for several hours with no outage",
      "SMS from operator about a SIM change you did not request",
      "Unexpected transaction alerts once network returns",
    ],
    prevent: [
      "Never share your SIM's 20-digit number or Aadhaar copies with callers",
      "Set a SIM PIN and register for operator-level porting alerts",
      "Prefer app-based authenticators over SMS OTP where possible",
    ],
    immediate: [
      "Call your operator to block the duplicate SIM at once",
      "Freeze internet banking and cards through the bank helpline",
      "Call 1930 and report on cybercrime.gov.in",
    ],
    dos: [
      "Do visit the operator store with ID to restore your SIM",
      "Do review the last 48 hours of bank statements",
    ],
    donts: [
      "Do not ignore a long, unexplained no-network period",
      "Do not share KYC documents on calls or WhatsApp",
    ],
  },
  {
    slug: "whatsapp-banking-scam",
    title: "WhatsApp Banking Scam",
    what: "Fraudsters pose as your bank, a relative or an employer on WhatsApp, using stolen profile photos to request urgent money transfers or push malicious APK files.",
    symptoms: [
      "Unknown number with your relative's photo asking for urgent money",
      "'Bank' support chat on a normal mobile number, not a verified business account",
      "APK files named like 'BankUpdate.apk' or wedding invitation files",
    ],
    prevent: [
      "Call the person on their known number before sending money",
      "Banks use verified WhatsApp Business accounts with a green tick",
      "Never install APK files received in chat; use DEFENXIA Scan Files",
    ],
    immediate: [
      "Stop chatting, report and block the number in WhatsApp",
      "If money was sent, call 1930 within the golden hour",
      "Run a device scan and revoke suspicious app permissions",
    ],
    dos: [
      "Do enable two-step verification on WhatsApp",
      "Do warn family members about the impersonation",
    ],
    donts: [
      "Do not transfer money based on a chat request alone",
      "Do not open unknown attachments or shortened links",
    ],
  },
];

export const getScamGuide = (slug?: string) =>
  scamGuides.find((g) => g.slug === slug);
