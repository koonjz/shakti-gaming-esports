import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";
import GlobalChatWidget from "@/components/GlobalChatWidget";
import SmoothScrollProvider from "@/providers/SmoothScrollProvider";
import InteractiveEmberBackground from "@/components/ui/InteractiveEmberBackground";

export const metadata: Metadata = {
  title: "SHAKTRIX | Esports & Gaming Community Hub",
  description: "Find teammates, register for tournaments, track stats, and build your gaming legacy on SHAKTRIX.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SmoothScrollProvider>
            <InteractiveEmberBackground />
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 2 }}>
              <Navbar />
              <main style={{ flex: '1 0 auto' }}>
                {children}
              </main>
              <GlobalChatWidget />
              <footer className="esports-footer" style={{ flexShrink: 0 }}>
                <div className="container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Brand */}
                    <div>
                      <div className="footer-brand">
                        SHAKT<span className="accent">RIX</span>
                      </div>
                      <div className="footer-tagline">India&apos;s competitive esports platform</div>
                    </div>

                    {/* Nav links */}
                    <ul className="footer-links">
                      <li><a href="/tournaments">Tournaments</a></li>
                      <li><a href="/teams">Teams</a></li>
                      <li><a href="/leaderboard">Leaderboard</a></li>
                      <li><a href="/players">Players</a></li>
                      <li><a href="/about">About</a></li>
                    </ul>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <span className="footer-copy">&copy; {new Date().getFullYear()} SHAKTRIX Esports. All rights reserved.</span>
                    <span className="footer-copy">Tournament brackets &amp; Live Leaderboards synced in real-time.</span>
                  </div>
                </div>
              </footer>
            </div>
          </SmoothScrollProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
