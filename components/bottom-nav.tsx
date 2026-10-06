import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n";

export async function BottomNav() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <Link href="/">{t.explore}</Link>
      <Link className="nav-create" href="/create">{t.create}</Link>
      <Link href="/my-games">{t.myGames}</Link>
      <Link href="/messages">{t.messages}</Link>
      <Link href="/profile">{t.profile}</Link>
    </nav>
  );
}
