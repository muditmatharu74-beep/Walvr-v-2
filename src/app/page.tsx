import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl w-full text-center space-y-8">

        {/* Logo */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tight gradient-text">
            Wavlr
          </h1>
          <p className="text-muted-foreground text-lg">
            Turn your music into content. Automatically.
          </p>
        </div>

        {/* Hero */}
        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-tight">
            Upload a song.
            <br />
            Get a 4K video.
            <br />
            <span className="gradient-text">Go viral.</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Wavlr analyzes your music, matches it with cinematic clips, syncs
            your lyrics word by word, and exports a video ready to post on
            Reels, TikTok, and YouTube.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 glass rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors"
          >
            Log In
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
          {[
            {
              title: "AI Beat Detection",
              desc: "Every cut matches the music perfectly.",
            },
            {
              title: "Word-by-Word Lyrics",
              desc: "Real captions synced to your audio.",
            },
            {
              title: "4K Export",
              desc: "Ready to post. No editing required.",
            },
          ].map((f) => (
            <div key={f.title} className="glass rounded-xl p-6 text-left">
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
