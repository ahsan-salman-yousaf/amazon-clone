import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AccountMenu, SignInLink } from "@/components/auth/account-menu";
import { CartBadge } from "@/components/cart/cart-badge";
import { SiteHeader } from "@/components/site-header";
import { getCategories } from "@/lib/catalog";
import { groupDepartments } from "@/lib/departments";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const departments = groupDepartments(await getCategories());
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <div aria-hidden className="color-fields" />
        <p className="bg-primary px-4 py-1.5 text-center text-xs text-primary-foreground">
          Demo project, not affiliated with Amazon. No real orders or payments: checkout runs in Stripe test mode.
        </p>
        <SiteHeader
          departments={departments}
          account={
            <Suspense fallback={<SignInLink />}>
              <AccountMenu />
            </Suspense>
          }
          cartBadge={
            <Suspense>
              <CartBadge />
            </Suspense>
          }
        />
        {children}
      </body>
    </html>
  );
}
