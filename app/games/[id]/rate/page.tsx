import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitRating } from "@/app/rating-actions";
import { getLocale } from "@/lib/i18n";

function first<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?v[0]??null:v??null;}

export default async function RateGamePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params;
  const sp=await searchParams;
  const locale=await getLocale(); const lv=locale==="lv";
  const error=typeof sp.error==="string"?sp.error:null;
  const saved=sp.saved==="1";

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect(`/login?next=/games/${id}/rate`);

  const {data:gameRaw}=await supabase.from("games")
    .select("id,creator_id,ends_at,activity:activities(name_lv,name_en),creator:profiles!games_creator_id_fkey(id,display_name,avatar_url,rating_average,rating_count)")
    .eq("id",id).maybeSingle();
  if(!gameRaw) notFound();
  if(new Date(gameRaw.ends_at)>new Date()) redirect(`/games/${id}`);

  const {data:participantRows}=await supabase.from("game_participants")
    .select("user_id,status,profile:profiles!game_participants_user_id_fkey(id,display_name,avatar_url,rating_average,rating_count)")
    .eq("game_id",id).eq("status","accepted");

  const {data:existing}=await supabase.from("ratings")
    .select("*").eq("game_id",id).eq("reviewer_user_id",user.id);

  const creator:any=first(gameRaw.creator);
  const people:any[]=[];
  if(gameRaw.creator_id!==user.id && creator) people.push(creator);
  for(const row of participantRows??[]){
    const p:any=first((row as any).profile);
    if(p && p.id!==user.id && !people.some(x=>x.id===p.id)) people.push(p);
  }
  const activity:any=first(gameRaw.activity);

  return <div className="page">
    <Link className="back" href={`/games/${id}`}>← {lv?"Spēle":"Game"}</Link>
    <p className="eyebrow">{lv?"Atsauksmes":"Ratings"}</p>
    <h1>{lv?"Novērtē spēlētājus":"Rate the players"}</h1>
    <p className="lead">{lv?(activity?.name_lv??"Spēle"):(activity?.name_en??"Game")}</p>
    {error&&<p className="notice error">{error}</p>}
    {saved&&<p className="notice success">{lv?"Atsauksme saglabāta.":"Rating saved."}</p>}
    <div className="stack">
      {people.map(person=>{
        const current:any=existing?.find((r:any)=>r.reviewed_user_id===person.id);
        return <section className="panel rating-card" key={person.id}>
          <div className="card-top"><div><h2>{person.display_name}</h2><p className="hint">★ {Number(person.rating_average??0).toFixed(1)} ({person.rating_count??0})</p></div></div>
          <form action={submitRating} className="wizard">
            <input type="hidden" name="game_id" value={id}/>
            <input type="hidden" name="reviewed_user_id" value={person.id}/>
            <label>{lv?"Vērtējums":"Rating"}<select name="rating" defaultValue={String(current?.rating??5)}>{[5,4,3,2,1].map(n=><option value={n} key={n}>{"★".repeat(n)} ({n})</option>)}</select></label>
            <div className="rating-tags">
              <label className="check-row"><input type="checkbox" name="reliable" defaultChecked={Boolean(current?.reliable)}/><span>Reliable</span></label>
              <label className="check-row"><input type="checkbox" name="friendly" defaultChecked={Boolean(current?.friendly)}/><span>Friendly</span></label>
              <label className="check-row"><input type="checkbox" name="good_teammate" defaultChecked={Boolean(current?.good_teammate)}/><span>Good teammate</span></label>
              <label className="check-row"><input type="checkbox" name="fair_player" defaultChecked={Boolean(current?.fair_player)}/><span>Fair player</span></label>
            </div>
            <label>{lv?"Komentārs (neobligāts)":"Comment (optional)"}<textarea name="comment" maxLength={1000} rows={3} defaultValue={current?.comment??""}/></label>
            <button className="button primary" type="submit">{current?(lv?"Atjaunināt":"Update"):(lv?"Saglabāt":"Save")}</button>
          </form>
        </section>;
      })}
      {!people.length&&<section className="panel"><p>{lv?"Nav citu dalībnieku, ko novērtēt.":"No other participants to rate."}</p></section>}
    </div>
  </div>;
}
