import Link from "next/link";
import { signIn } from "@/app/auth-actions";
import { getDictionary, getLocale } from "@/lib/i18n";
import { safeNext } from "@/lib/auth-navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const locale = await getLocale(); const t = getDictionary(locale);
  const error = typeof params.error === "string" ? params.error : null;
  const message = typeof params.message === "string" ? params.message : null;
  const next = safeNext(params.next);
  return <div className="page narrow"><p className="eyebrow">Wanna play, my friend?</p><h1>{t.signInTitle}</h1><p className="lead">{t.signInLead}</p>{message && <p className="notice success">{message}</p>}{error && <p className="notice error">{error}</p>}<form action={signIn} className="wizard"><input type="hidden" name="next" value={next} /><label>{t.email}<input name="email" type="email" autoComplete="email" required /></label><label>{t.password}<input name="password" type="password" autoComplete="current-password" required minLength={6} /></label><button className="button primary wide" type="submit">{t.signIn}</button></form><p className="hint"><Link href="/forgot-password">{locale==="lv"?"Aizmirsi paroli?":"Forgot password?"}</Link></p><p className="hint">{t.noAccount} <Link href={`/signup?next=${encodeURIComponent(next)}`}>{t.signUp}</Link></p></div>;
}
