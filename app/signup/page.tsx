import Link from "next/link";
import { signUp } from "@/app/auth-actions";
import { getDictionary, getLocale } from "@/lib/i18n";
import { safeNext } from "@/lib/auth-navigation";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const locale = await getLocale(); const t = getDictionary(locale);
  const error = typeof params.error === "string" ? params.error : null;
  const next = safeNext(params.next);
  return <div className="page narrow">
    <p className="eyebrow">{t.brand}</p><h1>{t.createProfile}</h1><p className="lead">{t.signupLead}</p>
    {error && <p className="notice error">{error}</p>}
    <form action={signUp} className="wizard">
      <input type="hidden" name="next" value={next}/>
      <label>{t.name}<input name="display_name" required maxLength={80} /></label>
      <label>{t.email}<input name="email" type="email" autoComplete="email" required /></label>
      <label>{t.password}<input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
      <label>{t.birthDate}<input name="birth_date" type="date" required /></label>
      <label>{t.city}<input name="city" placeholder="Rīga" /></label>
      <label>{t.language}<select name="language" defaultValue={locale}><option value="lv">Latviešu</option><option value="en">English</option></select></label>
      <button className="button primary wide" type="submit">{t.signUp}</button>
    </form>
    <p className="hint">{t.alreadyRegistered} <Link href={`/login?next=${encodeURIComponent(next)}`}>{t.signIn}</Link></p>
  </div>;
}
