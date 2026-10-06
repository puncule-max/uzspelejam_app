import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";

function first<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?v[0]??null:v??null;}

export default async function UserProfilePage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const locale=await getLocale(); const lv=locale==="lv";
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();

  const {data:rows,error}=await supabase.rpc("get_profile_detail",{p_user_id:id});
  if(error) notFound();
  const profile:any=Array.isArray(rows)?rows[0]:rows;
  if(!profile) notFound();

  const [{data:activities},{data:preferred}]=await Promise.all([
    supabase.from("user_activities")
      .select("skill_level,activity:activities(id,name_lv,name_en,supports_positions)")
      .eq("user_id",id),
    supabase.from("user_preferred_positions")
      .select("priority,position:positions(id,name_lv,name_en,activity_id)")
      .eq("user_id",id)
      .order("priority")
  ]);

  return <div className="page narrow">
    <Link className="back" href="/">← {lv?"Meklēt spēli":"Explore"}</Link>
    <section className="profile-card">
      <div className="avatar-large">{profile.display_name?.slice(0,1).toUpperCase()??"?"}</div>
      <div>
        <h1>{profile.display_name}</h1>
        <p>{profile.visibility==="private"?(lv?"Privāts profils":"Private profile"):(lv?"Publisks profils":"Public profile")}</p>
        <p>★ {Number(profile.rating_average??0).toFixed(1)} ({profile.rating_count??0}) · {profile.completed_games_count??0} {lv?"spēles":"games"}</p>
      </div>
    </section>

    {(profile.city||profile.about)&&<section className="panel">
      {profile.city&&<p><strong>{lv?"Pilsēta":"City"}:</strong> {profile.city}</p>}
      {profile.about&&<p>{profile.about}</p>}
    </section>}

    <section className="panel"><h2>{lv?"Aktivitātes":"Activities"}</h2><div className="stack">
      {activities?.map((row:any)=>{
        const a:any=first(row.activity);
        const positions=(preferred??[]).filter((p:any)=>first(p.position)?.activity_id===a?.id);
        return <div className="profile-activity" key={a?.id}>
          <div><strong>{lv?a?.name_lv:a?.name_en}</strong><span>{row.skill_level??(lv?"Nav norādīts":"Not set")}</span></div>
          {positions.length>0&&<small>{positions.map((p:any)=>{const pos:any=first(p.position);return lv?pos?.name_lv:pos?.name_en}).filter(Boolean).join(", ")}</small>}
        </div>;
      })}
      {!activities?.length&&<p className="hint">{lv?"Aktivitātes vēl nav norādītas.":"No activities selected yet."}</p>}
    </div></section>

    {user?.id===id&&<Link className="button primary wide" href="/profile/preferences">{lv?"Rediģēt matchmaking profilu":"Edit matchmaking profile"}</Link>}
  </div>;
}
