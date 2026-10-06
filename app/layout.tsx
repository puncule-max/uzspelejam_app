import "./globals.css";
import type { Metadata } from "next";
import { BottomNav } from "@/components/bottom-nav";

export const metadata: Metadata = {
  title: "Uzspēlējam?",
  description: "Find the missing player, partner or opponent.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="lv"><body><main className="app-shell">{children}</main><BottomNav /></body></html>;
}
