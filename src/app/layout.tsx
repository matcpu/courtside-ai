import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Courtside AI · The league that learns as it plays",
  description:
    "Autonomous youth basketball league operations, powered by Meta Muse Spark. Verified results. Fairer competition. Human control.",
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
