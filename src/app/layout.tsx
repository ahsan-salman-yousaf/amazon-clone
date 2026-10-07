import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Olympus Cart",
    template: "%s · Olympus Cart",
  },
  description: "Olympus Cart is a demo shopping site. It is not affiliated with Amazon.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div aria-hidden className="color-fields" />
        <p className="bg-primary px-4 py-1.5 text-center text-xs text-primary-foreground">
          Demo project, not affiliated with Amazon. No real orders or payments: checkout runs in Stripe test mode.
        </p>
        {children}
      </body>
    </html>
  );
}
