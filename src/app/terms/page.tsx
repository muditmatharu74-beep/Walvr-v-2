"use client";
import Link from "next/link";

export default function TermsPage() {
  return (
    <main>
      <h1>Terms of Service</h1>
    </main>
  );
}
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>

        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none", display: "block", marginBottom: "3rem" }}>W∆LVR</Link>

        <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>Legal</p>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>Terms of Service</h1>
        <p style={{ color: "rgba(245,240,235,0.35)", marginBottom: "4rem", fontSize: "0.85rem" }}>Last updated: June 11, 2026</p>

        {[
          {
            title: "1. Acceptance of Terms",
            content: `By accessing or using Walvr ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. These terms apply to all users, including free and paid subscribers.`
          },
          {
            title: "2. Description of Service",
            content: `Walvr is an AI-powered content creation tool that allows users to upload audio files and generate lyric videos using a library of licensed background footage and AI-generated captions. The Service is intended for musicians, artists, and content creators.`
          },
          {
            title: "3. User Responsibility for Content — IMPORTANT",
            content: `YOU ARE SOLELY RESPONSIBLE FOR ALL CONTENT YOU UPLOAD TO WALVR.

By uploading any audio, video, or other content to Walvr, you represent and warrant that:

(a) You own or have obtained all necessary rights, licenses, consents, and permissions to use and authorize Walvr to process the content you upload.

(b) You have the legal right to upload and use the music, lyrics, and any other audio content in the videos you create.

(c) Your use of the content does not and will not infringe, misappropriate, or violate any third-party intellectual property rights, including but not limited to copyrights, trademarks, or neighboring rights.

(d) You understand that uploading music you do not own the rights to — including commercially released songs by other artists — may constitute copyright infringement under applicable law.

(e) You agree that Walvr is not responsible for any copyright infringement, DMCA takedowns, platform removals, legal claims, or damages arising from your use of content you do not have the rights to.

Walvr does not review uploaded content for copyright compliance. You upload at your own risk.`
          },
          {
            title: "4. Copyright and DMCA",
            content: `Walvr respects intellectual property rights and expects users to do the same.

If you believe that content created through or hosted on Walvr infringes your copyright, please send a DMCA takedown notice to: legal@walvr.com

Include: (1) identification of the copyrighted work, (2) identification of the infringing material, (3) your contact information, (4) a statement of good faith belief, and (5) a statement of accuracy under penalty of perjury.

Walvr will respond to valid DMCA notices promptly. Repeat infringers will have their accounts terminated.`
          },
          {
            title: "5. Platform Distribution Responsibility",
            content: `When you download a video created with Walvr and upload it to any third-party platform including but not limited to TikTok, Instagram, YouTube, Facebook, Spotify, or any other service:

(a) You are solely responsible for complying with that platform's terms of service and community guidelines.

(b) You are solely responsible for any copyright claims, Content ID matches, monetization restrictions, or takedowns that occur on those platforms.

(c) Walvr is not liable for any consequences arising from your distribution of videos containing content you do not have the rights to.

(d) Walvr does not guarantee that videos will be free from copyright claims on any platform.`
          },
          {
            title: "6. Walvr's Licensed Content",
            content: `The background footage, visual templates, and effects provided by Walvr as part of the Service are licensed for use within the Service. By using the Service, you receive a limited, non-exclusive, non-transferable license to use these assets as part of videos created through Walvr.

You may not: extract, download, sell, redistribute, or sublicense the background footage or templates independently from a completed video created through the Service.`
          },
          {
            title: "7. Credits and Payments",
            content: `Walvr operates on a credit-based system. Credits are purchased and used to generate videos.

(a) Credits are non-refundable once purchased, except as required by applicable law.

(b) Monthly subscription credits reset at the start of each billing cycle. Unused credits may roll over up to the maximum specified for your plan.

(c) Walvr reserves the right to modify credit pricing and plan features at any time with reasonable notice.

(d) All payments are processed by Stripe. By making a purchase, you agree to Stripe's terms of service.

(e) Subscriptions automatically renew unless cancelled before the renewal date.`
          },
          {
            title: "8. Refund Policy",
            content: `Due to the nature of digital content generation, all sales of credits and subscriptions are final and non-refundable, except:

(a) If a technical error on Walvr's end prevented you from using credits you purchased, we will restore those credits.

(b) Refund requests must be submitted within 7 days of purchase to support@walvr.com.

(c) Walvr reserves the right to grant or deny refunds at its sole discretion.`
          },
          {
            title: "9. Prohibited Uses",
            content: `You may not use Walvr to create content that:

(a) Infringes any third-party intellectual property rights.
(b) Is defamatory, harassing, hateful, or threatening.
(c) Violates any applicable law or regulation.
(d) Contains explicit sexual content or graphic violence.
(e) Promotes illegal activities.
(f) Impersonates any person or entity.

Walvr reserves the right to terminate accounts that violate these prohibitions without notice or refund.`
          },
          {
            title: "10. Disclaimer of Warranties",
            content: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WALVR DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE FROM HARMFUL COMPONENTS. YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK.`
          },
          {
            title: "11. Limitation of Liability",
            content: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WALVR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.

IN NO EVENT SHALL WALVR'S TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU PAID TO WALVR IN THE SIX MONTHS PRECEDING THE CLAIM.`
          },
          {
            title: "12. Indemnification",
            content: `You agree to indemnify, defend, and hold harmless Walvr and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any way connected with:

(a) Your use of the Service.
(b) Your violation of these Terms.
(c) Your violation of any third-party rights, including intellectual property rights.
(d) Any content you upload, create, or distribute using the Service.

This indemnification obligation survives termination of these Terms.`
          },
          {
            title: "13. Account Termination",
            content: `Walvr reserves the right to suspend or terminate your account at any time for violation of these Terms, suspected copyright infringement, fraudulent activity, or any other reason at Walvr's sole discretion.

Upon termination, your right to use the Service ceases immediately. Unused credits are forfeited upon termination for cause.`
          },
          {
            title: "14. Changes to Terms",
            content: `Walvr reserves the right to modify these Terms at any time. We will notify users of material changes via email or a notice on the Service. Continued use of the Service after changes constitutes acceptance of the new Terms.`
          },
          {
            title: "15. Governing Law",
            content: `These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes arising from these Terms shall be resolved through binding arbitration or in the courts of competent jurisdiction in the United States.
          },
          {
            title: "16. Contact",
            content: `For questions about these Terms, please contact us at legal@walvr.com`
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: "3rem", paddingBottom: "3rem", borderBottom: "1px solid rgba(200,16,46,0.1)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "1rem", letterSpacing: "-0.01em" }}>{section.title}</h2>
            <p style={{ color: "rgba(245,240,235,0.55)", lineHeight: "1.8", fontSize: "0.9rem", whiteSpace: "pre-line" }}>{section.content}</p>
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
