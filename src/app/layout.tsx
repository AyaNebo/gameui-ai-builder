import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GameUI AI — Design. Play. Iterate.",
  description:
    "An engine-agnostic visual UI editor for games. Happy Harvest mock workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
