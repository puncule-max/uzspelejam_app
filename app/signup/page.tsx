import Link from "next/link";
import { signUp } from "@/app/auth-actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  return <div className="page narrow">
    <p className="eyebrow">Uzspēlējam?</p>
    <h1>Create your profile</h1>
    <p className="lead">16+ · LV/ENG · private profile by default.</p>
    {error && <p className="notice error">{error}</p>}
    <form action={signUp} className="wizard">
      <label>Name<input name="display_name" required maxLength={80} /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" required minLength={6} /></label>
      <label>Birth date<input name="birth_date" type="date" required /></label>
      <label>City<input name="city" placeholder="Rīga" /></label>
      <label>Language<select name="language" defaultValue="lv"><option value="lv">Latviešu</option><option value="en">English</option></select></label>
      <button className="button primary wide" type="submit">Create account</button>
    </form>
    <p className="hint">Already registered? <Link href="/login">Sign in</Link></p>
  </div>;
}
