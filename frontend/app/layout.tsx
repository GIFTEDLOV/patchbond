import type { Metadata } from "next";
import Link from "next/link";
import { AppProviders } from "@/components/app-providers";
import { WalletControl } from "@/components/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "PatchBond - funded security remediation",
  description: "Security remediation escrow backed by authenticated code evidence and independent GenLayer adjudication.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "PatchBond - proof before payout",
    description: "Funded security remediation backed by authenticated code evidence.",
    images: [{ url: "/og.png", width: 1792, height: 918, alt: "PatchBond - Proof before payout." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PatchBond - proof before payout",
    description: "Funded security remediation backed by authenticated code evidence.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <AppProviders>
          <header className="site-header">
            <div className="site-header-inner">
              <Link className="wordmark" href="/" aria-label="PatchBond home">
                <span className="mark" aria-hidden="true"><span>PB</span></span>
                <span className="wordmark-copy"><strong>PatchBond</strong><small>PROOF BEFORE PAYOUT</small></span>
              </Link>
              <div className="header-tools">
                <span className="network-chip"><i aria-hidden="true" /> Bradbury testnet</span>
                <nav aria-label="Primary navigation">
                  <Link href="/cases/new">Create case</Link>
                  <Link href="/developer">Developer portal</Link>
                </nav>
                <div className="header-wallet"><WalletControl /></div>
              </div>
            </div>
          </header>
          <main id="main">{children}</main>
        </AppProviders>
        <footer className="site-footer">
          <div className="footer-brand"><span className="footer-mark">PB</span><span><strong>PatchBond</strong><small>Immutable remediation escrow</small></span></div>
          <div className="footer-principles"><span>Authenticated evidence</span><span>Independent interpretation</span><span>Finalized settlement</span></div>
        </footer>
      </body>
    </html>
  );
}
