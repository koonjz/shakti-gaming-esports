import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Shakti Gaming | Esports & Gaming Community Hub",
  description: "Find teammates, register for tournaments, track stats, and build your gaming legacy.",
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
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <main style={{ flex: '1 0 auto' }}>
              {children}
            </main>
            <footer style={{
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              padding: '2rem 0',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              flexShrink: 0
            }}>
              <div className="container">
                <p>&copy; {new Date().getFullYear()} Shakti Gaming. All rights reserved.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'hsla(217, 12%, 50%, 0.7)' }}>
                  Tournament brackets & Live Leaderboard updates synced in real-time.
                </p>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
