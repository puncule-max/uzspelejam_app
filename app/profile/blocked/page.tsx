import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unblockUser } from "@/app/safety-actions";
import { getLocale } from "@/lib/i18n";

function first<T>(value:T|T[]|null|undefined):T|null { return Array.isArray(value)?value[0]??null:value??null; }

export default async function BlockedUsersPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const locale=await getLocale(); const lv=locale==="lv";
  const sp=await searchParams;
  const error=typeof sp.error==="string"?sp.error:null;
  const supabase=await createClient();
  const { data:{ user } }=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/profile/blocked");

  const { data: rows }=await supabase.from("blocks")
    .select("blocked_user_id,created_at,profile:profiles!blocks_blocked_user_id_fkey(display_name,avatar_url)")
    .eq("blocker_user_id",user.id)
    .order("created_at",{ascending:false});

  return <div className="page narrow">
    <Link className="back" href="/profile">← {lv?"Profils":"Profile"}</Link>
    <p className="eyebrow">{lv?"Drošība":"Safety"}</p>
    <h1>{lv?"Bloķētie lietotāji":"Blocked users"}</h1>
    {error&&<p className="notice error">{error}</p>}
    <section className="panel"><div className="stack">
      {rows?.map((r:any)=>{const p=first(r.profile);return <div className="applicant" key={r.blocked_user_id}><strong>{p?.display_name??(lv?"Lietotājs":"User")}</strong><form action={unblockUser}><input type="hidden" name="user_id" value={r.blocked_user_id}/><button className="button ghost" type="submit">{lv?"Atbloķēt":"Unblock"}</button></form></div>})}
      {!rows?.length&&<p className="hint">{lv?"Neviena bloķēta lietotāja.":"No blocked users."}</p>}
    </div></section>
  </div>;
}
