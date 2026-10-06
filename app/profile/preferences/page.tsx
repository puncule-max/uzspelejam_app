import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { saveUserActivity, savePreferredPosition } from "@/app/profile-preference-actions";

export default async function ProfilePreferencesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const sp=await searchParams; const locale=await getLocale(); const lv=locale==="lv";
  const error=typeof sp.error==="string"?sp.error:null;

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/profile/preferences");

  const [{data:activities},{data:selected},{data:positions},{data:preferred}]=await Promise.all([
    supabase.from("activities").select("id,code,name_lv,name_en,category,supports_positions,supports_skill_levels").eq("active",true).order("category").order(locale==="lv"?"name_lv":"name_en"),
    supabase.from("user_activities").select("activity_id,skill_level").eq("user_id",user.id),
    supabase.from("positions").select("id,activity_id,name_lv,name_en,sort_order").eq("active",true).order("sort_order"),
    supabase.from("user_preferred_positions").select("position_id,priority").eq("user_id",user.id),
  ]);

  const selectedMap=new Map((selected??[]).map((x:any)=>[x.activity_id,x]));
  const preferredMap=new Map((preferred??[]).map((x:any)=>[x.position_id,x]));

  return <div className="page">
    <Link className="back" href="/profile">← {lv?"Profils":"Profile"}</Link>
    <p className="eyebrow">{lv?"Matchmaking profils":"Matchmaking profile"}</p>
    <h1>{lv?"Aktivitātes un līmenis":"Activities and skill"}</h1>
    <p className="lead">{lv?"Atzīmē tikai tās aktivitātes, kurās vēlies atrast spēles vai spēlētājus.":"Choose only activities where you want to find games or players."}</p>
    {error&&<p className="notice error">{error}</p>}

    <div className="stack">
      {activities?.map((a:any)=>{
        const current:any=selectedMap.get(a.id);
        const activityPositions=(positions??[]).filter((p:any)=>p.activity_id===a.id);
        return <section className="panel preference-card" key={a.id}>
          <form action={saveUserActivity} className="preference-main">
            <input type="hidden" name="activity_id" value={a.id}/>
            <label className="check-row"><input type="checkbox" name="enabled" defaultChecked={Boolean(current)}/><span><strong>{lv?a.name_lv:a.name_en}</strong><small>{a.category}</small></span></label>
            {a.supports_skill_levels&&<label>{lv?"Līmenis":"Skill"}<select name="skill_level" defaultValue={current?.skill_level??"intermediate"}><option value="beginner">{lv?"Iesācējs":"Beginner"}</option><option value="intermediate">{lv?"Vidējs":"Intermediate"}</option><option value="advanced">{lv?"Pieredzējis":"Advanced"}</option></select></label>}
            <button className="button ghost" type="submit">{lv?"Saglabāt":"Save"}</button>
          </form>

          {current&&a.supports_positions&&activityPositions.length>0&&<div className="position-preferences">
            <h3>{lv?"Vēlamās pozīcijas":"Preferred positions"}</h3>
            {activityPositions.map((p:any)=>{const pref:any=preferredMap.get(p.id);return <form action={savePreferredPosition} className="position-row" key={p.id}>
              <input type="hidden" name="position_id" value={p.id}/>
              <label className="check-row"><input type="checkbox" name="enabled" defaultChecked={Boolean(pref)}/><span>{lv?p.name_lv:p.name_en}</span></label>
              <input type="number" name="priority" min="1" max="10" defaultValue={pref?.priority??1} title={lv?"Prioritāte":"Priority"}/>
              <button className="button ghost" type="submit">{lv?"Saglabāt":"Save"}</button>
            </form>})}
          </div>}
        </section>;
      })}
    </div>
  </div>;
}
