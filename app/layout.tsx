import type { Metadata } from "next";
import { Oswald, Assistant, Syne_Mono } from "next/font/google";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import WrongNetworkBar from "@/components/botchain/WrongNetworkBar";
import "./globals.css";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const syneMono = Syne_Mono({
  variable: "--font-syne-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Layaway — Instalment Escrow Plans",
  description: "Pay in instalments. The seller is paid when you finish.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${oswald.variable} ${assistant.variable} ${syneMono.variable}`}>
      <body className="antialiased min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
        <EvmProvider>
          <ToastProvider>
            <WrongNetworkBar />
            {children}
          </ToastProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
