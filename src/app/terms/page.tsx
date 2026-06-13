"use client";
import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing or using Walvr, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users including free and paid subscribers.",
  },
  {
    title: "2. Description of Service",
    content: "Walvr is an AI-powered content creation tool that allows users to upload audio files and generate lyric videos using licensed background footage and AI-generated captions.",
  },
  {
    title: "3. User Responsibility for Content",
    content: "YOU ARE SOLELY RESPONSIBLE FOR ALL CONTENT YOU UPLOAD TO WALVR. By uploading content you confirm that: (a) You own or have obtained all necessary rights to use the content. (b) You have the legal right to upload and use the music and lyrics. (c) Your use does not infringe any third-party intellectual property rights. (d) You understand that uploading music you do not own may constitute copyright infringement. (e) Walvr is not responsible for any copyright infringement, DMCA takedowns, platform removals, legal claims, or damages arising from your uploads. Walvr does not review uploaded content for copyright compliance. You upload at your own risk.",
  },
  {
    title: "4. Copyright and DMCA",
    content: "Walvr respects intellectual property rights. If you believe content on Walvr infringes your copyright, send a DMCA notice to legal@walvr.com including: identification of the copyrighted work, identification of the infringing material, your contact information, a statement of good faith belief, and a statement of accuracy under penalty of perjury. Repeat infringers will have their accounts terminated.",
  },
  {
    title: "5. Platform Distribution Responsibility",
    content: "When you upload a Walvr-created video to any platform including TikTok, Instagram, YouTube, or any other service: (a) You are solely responsible for complying with that platform's terms of service. (b) You are solely responsible for any copyright claims, Content ID matches, or takedowns. (c) Walvr is not liable for any consequences from your distribution of videos containing content you do not have rights to. (d) Walvr does not guarantee videos will be free from copyright claims on any platform.",
  },
  {
    title: "6. Licensed Content",
    content: "Background footage and templates provided by Walvr are licensed for use within the Service. You receive a limited non-exclusive license to use these assets as part of completed videos. You may not extract, sell, or redistribute background footage independently from a completed video.",
  },
  {
    title: "7. Credits and Payments",
    content: "Walvr operates on a credit-based system. Credits are non-refundable once purchased except as required by law. Monthly subscription credits reset each billing cycle with rollover up to plan maximum. All payments are processed by Stripe. Subscriptions auto-renew unless cancelled before renewal date.",
  },
  {
    title: "8. Refund Policy",
    content: "All sales of credits and subscriptions are final and non-refundable except where a technical error on Walvr's end prevented use of purchased credits. Refund requests must be submitted within 7 days to support@walvr.com. Walvr reserves the right to grant or deny refunds at its sole discretion.",
  },
  {
    title: "9. Prohibited Uses",
    content: "You may not use Walvr to create content that infringes intellectual property rights, is defamatory or hateful, violates any law, contains explicit sexual content or graphic violence, promotes illegal activities, or impersonates any person. Walvr reserves the right to terminate accounts that violate these rules without notice or refund.",
  },
  {
    title: "10. Disclaimer of Warranties",
    content: "THE SERVICE IS PROVIDED AS IS AND AS AVAILABLE WITHOUT WARRANTIES OF ANY KIND. WALVR DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE. YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.",
  },
  {
    title: "11. Limitation of Liability",
    content: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, WALVR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. IN NO EVENT SHALL WALVR'S TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID TO WALVR IN THE SIX MONTHS PRECEDING THE CLAIM.",
  },
  {
    title: "12. Indemnification",
    content: "You agree to indemnify and hold harmless Walvr and its officers, directors, employees, and agents from any claims, liabilities, damages, and expenses arising from: (a) Your use of the Service. (b) Your violation of these Terms. (c) Your violation of any third-party rights including intellectual property rights. (d) Any content you upload or distribute using the Service.",
  },
  {
    title: "13. Account Termination",
    content: "Walvr may suspend or terminate your account at any time for violation of these Terms, suspected copyright infringement, fraudulent activity, or any other reason at its sole discretion. Upon termination your right to use the Service ceases immediately.",
  },
  {
    title: "14. Changes to Terms",
    content: "Walvr reserves the right to modify these Terms at any time. We will notify users of material changes via email or notice on the Service. Continued use after changes constitutes acceptance.",
  },
  {
    title: "15. Governing Law",
    content: "These Terms shall be governed by the laws of the United States. Any disputes shall be resolved through binding arbitration or in courts of competent jurisdiction in the United States.",
  },
  {
    title: "16. Contact",
    content: "For questions about these Terms contact us at legal@walvr.com",
  },
];

export default function TermsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1a0508 0%, #150305 40%, #1a0609 100%)", fontFamily: "'Georgia', 'Times New Roman', serif", color: "#f5f0eb", padding: "6rem 3rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>

        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none", display: "block", marginBottom: "3rem" }}>W∆LVR</Link>

        <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>Legal</p>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>Terms of Service</h1>
        <p style={{ color: "rgba(245,240,235,0.35)", marginBottom: "4rem", fontSize: "0.85rem" }}>Last updated: June 11, 2026</p>

        {SECTIONS.map((section, i) => (
          <div key={i} style={{ marginBottom: "3rem", paddingBottom: "3rem", borderBottom: "1px solid rgba(200,16,46,0.1)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "1rem" }}>{section.title}</h2>
            <p style={{ color: "rgba(245,240,235,0.55)", lineHeight: "1.8", fontSize: "0.9rem" }}>{section.content}</p>
          </div>
        ))}

        <div style={{ marginTop: "4rem", paddingTop: "2rem", borderTop: "1px solid rgba(200,16,46,0.15)", display: "flex", gap: "2rem" }}>
          <Link href="/privacy" style={{ color: "#c8102e", fontSize: "0.8rem", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>Privacy Policy</Link>
          <Link href="/" style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.8rem", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>Back to Home</Link>
        </div>

      </div>
    </main>
  );
}
