import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "FairShare · A little clearer, together",
  description: "Shared moments. Clear balances.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
