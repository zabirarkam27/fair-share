import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FairShare · A little clearer, together",
  description: "Shared expenses, fair splits, and a clear way to settle up.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
