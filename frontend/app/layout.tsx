import type { Metadata } from "next";
import Link from "next/link";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PatchBond — funded security remediation",
  description:
    "Security remediation escrow backed by authenticated code evidence and independent GenLayer adjudication.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "PatchBond — proof before payout",
    description: "Funded security remediation backed by authenticated code evidence.",
    images: [{ url: "/og.png", width: 1792, height: 918, alt: "PatchBond — Proof before payout." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PatchBond — proof before payout",
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
            <Link className="wordmark" href="/" aria-label="PatchBond home">
              <span className="mark" aria-hidden="true">PB</span>
              PatchBond
            </Link>
            <nav aria-label="Primary navigation">
              <Link href="/cases/new">Create case</Link>
              <Link href="/developer">Developer</Link>
            </nav>
          </header>
          <main id="main">{children}</main>
        </AppProviders>
        <footer>
          <span>PatchBond</span>
          <span>Evidence before interpretation. Finality before settlement.</span>
        </footer>
      </body>
    </html>
  );
}
