import { updatePassword } from "@/app/auth-actions";
import { getLocale } from "@/lib/i18n";

export default async function UpdatePasswordPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const sp=await searchParams;
  const locale=await getLocale(); const lv=locale==="lv";
  const error=typeof sp.error==="string"?sp.error:null;
  return <div className="page narrow">
    <p className="eyebrow">{lv?"Konts":"Account"}</p>
    <h1>{lv?"Iestati jaunu paroli":"Set a new password"}</h1>
    {error&&<p className="notice error">{error}</p>}
    <form action={updatePassword} className="wizard">
      <label>{lv?"Jaunā parole":"New password"}<input type="password" name="password" minLength={8} required autoComplete="new-password"/></label>
      <label>{lv?"Atkārto paroli":"Confirm password"}<input type="password" name="confirm_password" minLength={8} required autoComplete="new-password"/></label>
      <button className="button primary wide" type="submit">{lv?"Saglabāt paroli":"Save password"}</button>
    </form>
  </div>;
}
