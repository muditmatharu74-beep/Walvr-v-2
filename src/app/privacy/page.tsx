import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1a0508 0%, #150305 40%, #1a0609 100%)",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#f5f0eb",
      padding: "6rem 3rem",
    }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>

        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none", display: "block", marginBottom: "3rem" }}>W∆LVR</Link>

        <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>Legal</p>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>Privacy Policy</h1>
        <p style={{ color: "rgba(245,240,235,0.35)", marginBottom: "4rem", fontSize: "0.85rem" }}>Last updated: June 11, 2026</p>

        {[
          {
            title: "1. Introduction",
            content: `Walvr ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.

By using Walvr, you consent to the data practices described in this policy. If you do not agree, please do not use the Service.`
          },
          {
            title: "2. Information We Collect",
            content: `We collect the following types of information:

ACCOUNT INFORMATION
- Email address (required to create an account)
- Password (stored encrypted, never in plain text)
- Profile information including your subscription plan and credit balance

PAYMENT INFORMATION
- We do not store your credit card details. All payment processing is handled by Stripe. We store only your Stripe customer ID and subscription status.

UPLOADED CONTENT
- Audio files you upload for processing (MP3, MP4, WAV, M4A)
- Song title and artist name you provide
- Generated video metadata including mood, genre, and lyrics

USAGE DATA
- Number of videos created per month
- Templates and caption styles selected
- Browser type and device information
- IP address and approximate location
- Pages visited and features used within the Service

COMMUNICATIONS
- If you contact us for support, we retain those communications`
          },
          {
            title: "3. How We Use Your Information",
            content: `We use your information to:

(a) Provide, operate, and maintain the Service
(b) Process your audio files and generate videos
(c) Process payments and manage your subscription
(d) Send transactional emails including receipts, password resets, and account notifications
(e) Monitor and analyze usage patterns to improve the Service
(f) Detect and prevent fraud and abuse
(g) Comply with legal obligations
(h) Respond to your support requests

We do not sell your personal information to third parties. We do not use your uploaded audio content to train AI models.`
          },
          {
            title: "4. Data Retention",
            content: `We retain your data as follows:

ACCOUNT DATA: Retained for as long as your account is active. Deleted within 30 days of account deletion request.

UPLOADED AUDIO FILES: Stored temporarily during processing. Audio files are retained in Supabase Storage for up to 30 days after upload, then automatically deleted.

GENERATED VIDEOS: Video render URLs are stored in our database. The actual rendered video files are hosted by Creatomate and subject to their retention policies.

PAYMENT DATA: Transaction records are retained for 7 years as required by US tax law.

USAGE DATA: Retained for up to 2 years for analytics purposes.`
          },
          {
            title: "5. Third-Party Services",
            content: `We use the following third-party services that may process your data:

SUPABASE — Database and file storage. Your account data and uploaded files are stored on Supabase servers. Privacy policy: supabase.com/privacy

STRIPE — Payment processing. Handles all credit card transactions. Privacy policy: stripe.com/privacy

OPENAI (WHISPER) — Audio transcription. Your uploaded audio is sent to OpenAI's Whisper API for transcription. Privacy policy: openai.com/privacy

ANTHROPIC (CLAUDE) — AI analysis. Song lyrics and metadata are sent to Anthropic's API for mood and genre analysis. Privacy policy: anthropic.com/privacy

CREATOMATE — Video rendering. Your audio files and generated captions are sent to Creatomate for video rendering. Privacy policy: creatomate.com/privacy

VERCEL — Hosting and deployment. Our application runs on Vercel's infrastructure. Privacy policy: vercel.com/legal/privacy-policy

By using Walvr, you acknowledge that your data may be processed by these third-party services.`
          },
          {
            title: "6. Cookies",
            content: `We use cookies and similar tracking technologies to:

(a) Maintain your login session
(b) Remember your preferences
(c) Analyze how the Service is used

You can control cookies through your browser settings. Disabling cookies may affect your ability to use certain features of the Service.

We do not use advertising cookies or sell cookie data to advertisers.`
          },
          {
            title: "7. Data Security",
            content: `We implement industry-standard security measures including:

- Encryption of data in transit using TLS/SSL
- Encrypted password storage using bcrypt hashing
- Row-level security on our database
- Regular security audits

However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your data.`
          },
          {
            title: "8. Your Rights",
            content: `You have the following rights regarding your personal data:

ACCESS: You may request a copy of the personal data we hold about you.

CORRECTION: You may request correction of inaccurate personal data.

DELETION: You may request deletion of your account and associated personal data. Submit requests to privacy@walvr.com. We will process deletion requests within 30 days.

PORTABILITY: You may request an export of your data in a machine-readable format.

OPT-OUT: You may opt out of non-transactional marketing emails at any time using the unsubscribe link in those emails.

To exercise any of these rights, contact us at privacy@walvr.com`
          },
          {
            title: "9. Children's Privacy",
            content: `Walvr is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will delete it immediately.

If you are between 13 and 18, you may only use Walvr with the consent and supervision of a parent or guardian.`
          },
          {
            title: "10. California Privacy Rights (CCPA)",
            content: `If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):

- The right to know what personal information we collect and how it is used
- The right to delete your personal information
- The right to opt-out of the sale of personal information (we do not sell personal information)
- The right to non-discrimination for exercising your privacy rights

To exercise your CCPA rights, contact us at privacy@walvr.com`
          },
          {
            title: "11. International Users",
            content: `Walvr is operated from the United States. If you are accessing the Service from outside the United States, your data will be transferred to and processed in the United States.

If you are in the European Economic Area (EEA), you have rights under the General Data Protection Regulation (GDPR). Our legal basis for processing your data is:
- Contract performance (to provide the Service you signed up for)
- Legitimate interests (to improve and secure the Service)
- Legal obligation (to comply with applicable law)

For GDPR inquiries, contact us at privacy@walvr.com`
          },
          {
            title: "12. Changes to This Policy",
            content: `We may update this Privacy Policy from time to time. We will notify you of material changes by email or by posting a notice on the Service. Your continued use of the Service after changes constitutes acceptance of the updated policy.`
          },
          {
            title: "13. Contact Us",
            content: `If you have questions about this Privacy Policy or our data practices, please contact us at:

Email: privacy@walvr.com

We will respond to all privacy inquiries within 30 days.`
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: "3rem", paddingBottom: "3rem", borderBottom: "1px solid rgba(200,16,46,0.1)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "1rem", letterSpacing: "-0.01em" }}>{section.title}</h2>
            <p style={{ color: "rgba(245,240,235,0.55)", lineHeight: "1.8", fontSize: "0.9rem", whiteSpace: "pre-line" }}>{section.content}</p>
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
