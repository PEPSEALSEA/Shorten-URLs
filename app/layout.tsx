import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkSnap — Premium URL Shortener",
  description: "Transform long links into powerful, snap-worthy short URLs. Fast, secure, and stylish.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
