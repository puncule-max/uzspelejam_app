import Link from "next/link";
import { requestPasswordReset } from "@/app/auth-actions";
import { getLocale } from "@/lib/i18n";
import { authErrorMessage } from "@/lib/auth-errors";

export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const sp=await searchParams;
  const locale=await getLocale(); const lv=locale==="lv";
  const error=authErrorMessage(typeof sp.error==="string"?sp.error:null,locale);
  const sent=sp.sent==="1";
  return <div className="page narrow">
    <Link className="back" href="/login">← {lv?"Ieiet":"Sign in"}</Link>
    <p className="eyebrow">{lv?"Konts":"Account"}</p>
    <h1>{lv?"Atjaunot paroli":"Reset password"}</h1>
    <p className="lead">{lv?"Nosūtīsim paroles atjaunošanas saiti uz tavu e-pastu.":"We’ll send a password reset link to your email."}</p>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {sent&&<p className="notice success">{lv?"Ja konts eksistē, atjaunošanas saite ir nosūtīta.":"If the account exists, a reset link has been sent."}</p>}
    <form action={requestPasswordReset} className="wizard">
      <label>{lv?"E-pasts":"Email"}<input type="email" name="email" required autoComplete="email"/></label>
      <button className="button primary wide" type="submit">{lv?"Nosūtīt saiti":"Send reset link"}</button>
    </form>
  </div>;
}
