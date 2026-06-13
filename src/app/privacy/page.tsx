"use client";
import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Introduction",
    content: "Walvr is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Service. By using Walvr, you consent to the data practices described here.",
  },
  {
    title: "2. Information We Collect",
    content: "ACCOUNT INFORMATION: Email address, encrypted password, subscription plan, and credit balance. PAYMENT INFORMATION: We do not store credit card details. All payments are handled by Stripe. We store only your Stripe customer ID and subscription status. UPLOADED CONTENT: Audio files you upload, song title and artist name, generated video metadata including mood, genre, and lyrics. USAGE DATA: Number of videos created, templates and caption styles selected, browser type, device information, IP address, and pages visited.",
  },
  {
    title: "3. How We Use Your Information",
    content: "We use your information to: provide and operate the Service, process your audio files and generate videos, process payments and manage your subscription, send transactional emails, monitor usage to improve the Service, detect and prevent fraud, comply with legal obligations, and respond to support requests. We do not sell your personal information. We do not use your uploaded audio content to train AI models.",
  },
  {
    title: "4. Data Retention",
    content: "ACCOUNT DATA: Retained while your account is active. Deleted within 30 days of account deletion request. UPLOADED AUDIO FILES: Retained for up to 30 days after upload then automatically deleted. GENERATED VIDEOS: Render URLs stored in our database. Actual video files hosted by Creatomate subject to their retention policies. PAYMENT DATA: Retained for 7 years as required by US tax law. USAGE DATA: Retained for up to 2 years.",
  },
  {
    title: "5. Third-Party Services",
    content: "We use the following services that may process your data: SUPABASE - database and file storage. STRIPE - payment processing. OPENAI WHISPER - audio transcription. ANTHROPIC CLAUDE - AI song analysis. CREATOMATE - video rendering. VERCEL - hosting and deployment. By using Walvr you acknowledge your data may be processed by these services.",
  },
  {
    title: "6. Cookies",
    content: "We use cookies to maintain your login session, remember preferences, and analyze Service usage. You can control cookies through your browser settings. We do not use advertising cookies or sell cookie data.",
  },
  {
    title: "7. Data Security",
    content: "We implement industry-standard security including TLS encryption in transit, encrypted password storage, and row-level database security. However no method of internet transmission is 100% secure and we cannot guarantee absolute security.",
  },
  {
    title: "8. Your Rights",
    content: "You have the right to: ACCESS your personal data, CORRECT inaccurate data, DELETE your account and data within 30 days of request, REQUEST a data export, and OPT-OUT of marketing emails. Contact privacy@walvr.com to exercise any of these rights.",
  },
  {
    title: "9. Children's Privacy",
    content: "Walvr is not intended for users under 13. We do not knowingly collect data from children under 13. Users between 13 and 18 may only use Walvr with parental consent and supervision.",
  },
  {
    title: "10. California Privacy Rights (CCPA)",
    content: "California residents have the right to know what personal information we collect, delete their personal information, opt-out of the sale of personal information (we do not sell personal information), and non-discrimination for exercising privacy rights. Contact privacy@walvr.com for CCPA requests.",
  },
  {
    title: "11. International Users",
    content: "Walvr is operated from the United States. Data from outside the US will be transferred to and processed in the United States. EU users have rights under GDPR. Our legal basis for processing is contract performance, legitimate interests, and legal obligation. Contact privacy@walvr.com for GDPR inquiries.",
  },
  {
    title: "12. Changes to This Policy",
    content: "We may update this Privacy Policy at any time. We will notify you of material changes by email or notice on the Service. Continued use after changes constitutes acceptance.",
  },
  {
    title: "13. Contact Us",
    content: "For privacy questions contact us at privacy@walvr.com. We respond to all inquiries within 30 days.",
  },
];

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1a0508 0%, #150305 40%, #1a0609 100%)", fontFamily: "'Georgia', 'Times New Roman', serif", color: "#f5f0eb", padding: "6rem 3rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>

        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none", display: "block", marginBottom: "3rem" }}>W∆LVR</Link>

        <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>Legal</p>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>Privacy Policy</h1>
        <p style={{ color: "rgba(245,240,235,0.35)", marginBottom: "4rem", fontSize: "0.85rem" }}>Last updated: June 11, 2026</p>

        {SECTIONS.map((section, i) => (
          <div key={i} style={{ marginBottom: "3rem", paddingBottom: "3rem", borderBottom: "1px solid rgba(200,16,46,0.1)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "1rem" }}>{section.title}</h2>
            <p style={{ color: "rgba(245,240,235,0.55)", lineHeight: "1.8", fontSize: "0.9rem" }}>{section.content}</p>
          </div>
        ))}

        <div style={{ marginTop: "4rem", paddingTop: "2rem", borderTop: "1px solid rgba(200,16,46,0.15)", display: "flex", gap: "2rem" }}>
          <Link href="/terms" style={{ color: "#c8102e", fontSize: "0.8rem", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>Terms of Service</Link>
          <Link href="/" style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.8rem", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>Back to Home</Link>
        </div>

      </div>
    </main>
  );
}
