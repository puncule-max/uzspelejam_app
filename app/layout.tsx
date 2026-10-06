import "./globals.css";
import type { Metadata } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Uzspēlējam?",
  description: "Find the missing player, partner or opponent.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return <html lang={locale}><body><main className="app-shell">{children}</main><BottomNav /></body></html>;
}
