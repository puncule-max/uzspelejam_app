import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { setLanguage } from "@/app/language-actions";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n";

export default async function ProfilePage() {
  const locale = await getLocale(); const t = getDictionary(locale); const lv=locale==="lv";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");
  const { data: profileRows } = await supabase.rpc("get_profile_detail",{p_user_id:user.id});
  const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
  return <div className="page"><p className="eyebrow">{t.profile}</p><section className="profile-card"><div className="avatar-large">{profile?.display_name?.slice(0,1).toUpperCase() ?? "?"}</div><div><h1>{profile?.display_name ?? "Player"}</h1><p>{profile?.city || "Latvia"} · {profile?.visibility || "private"}</p><p>★ {Number(profile?.rating_average ?? 0).toFixed(1)} ({profile?.rating_count ?? 0})</p></div></section>
    <Link className="button primary wide" href="/profile/edit">{lv?"Rediģēt profilu":"Edit profile"}</Link>
    <section className="panel"><h2>{t.language}</h2><form action={setLanguage} className="inline-form"><select name="language" defaultValue={locale}><option value="lv">Latviešu</option><option value="en">English</option></select><button className="button primary" type="submit">OK</button></form></section>
    <section className="panel"><h2>{t.account}</h2><p>{user.email}</p></section>
    <section className="panel"><h2>{lv?"Matchmaking profils":"Matchmaking profile"}</h2><Link className="button ghost wide" href="/profile/preferences">{lv?"Aktivitātes un pozīcijas":"Activities and positions"}</Link></section>
    <section className="panel"><h2>{lv?"Drošība":"Safety"}</h2><Link className="button ghost wide" href="/profile/blocked">{lv?"Bloķētie lietotāji":"Blocked users"}</Link></section>
    <section className="panel"><h2>{t.actions}</h2><div className="stack"><Link className="button ghost" href="/my-games">{t.myGames}</Link><Link className="button primary" href="/create">{t.createGame}</Link><form action={signOut}><button className="button danger wide">{t.signOut}</button></form></div></section>
  </div>;
}
