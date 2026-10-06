import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { updateGameDetails } from "@/app/game-admin-actions";
import { CancellationPolicyField } from "@/components/cancellation-policy-field";

function rigaParts(value:string){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
    timeZone:"Europe/Riga",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date(value)).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}

export default async function EditGamePage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params;
  const sp=await searchParams;
  const locale=await getLocale(); const lv=locale==="lv";
  const error=typeof sp.error==="string"?sp.error:null;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login?next=/games/"+id+"/edit");

  const {data:game}=await supabase.from("games").select("id,creator_id,mode,starts_at,ends_at,custom_location,city,online_platform,total_cost,payment_method,organizer_share_included,additional_players_required,venue_booked,cancellation_policy_minutes,description,cancelled_at").eq("id",id).maybeSingle();
  if(!game) notFound();
  if(game.creator_id!==user.id) redirect("/games/"+id);
  if(game.cancelled_at) redirect("/games/"+id);

  const start=rigaParts(game.starts_at);
  const end=rigaParts(game.ends_at);

  return <div className="page narrow">
    <Link className="back" href={"/games/"+id+"/manage"}>← {lv?"Pārvaldīt spēli":"Manage game"}</Link>
    <p className="eyebrow">{lv?"Organizators":"Organizer"}</p>
    <h1>{lv?"Rediģēt spēli":"Edit game"}</h1>
    <p className="lead">{lv?"Dalībnieki un sekotāji saņems paziņojumus par būtiskām izmaiņām.":"Participants and followers will be notified about relevant changes."}</p>
    {error&&<p className="notice error">{error}</p>}
    <form action={updateGameDetails} className="wizard">
      <input type="hidden" name="game_id" value={id}/>
      <div className="two-col"><label>{lv?"Datums":"Date"}<input type="date" name="date" required defaultValue={start.date}/></label><label>{lv?"Sākums":"Start"}<input type="time" name="start_time" required defaultValue={start.time}/></label></div>
      <label>{lv?"Beigas":"End"}<input type="time" name="end_time" required defaultValue={end.time}/></label>
      {game.mode!=="online"&&<><label>{lv?"Vieta":"Location"}<input name="custom_location" defaultValue={game.custom_location??""}/></label><label>{lv?"Pilsēta":"City"}<input name="city" defaultValue={game.city??""}/></label><label>{lv?"Laukums/vieta rezervēta?":"Venue booked?"}<select name="venue_booked" defaultValue={game.venue_booked===true?"true":game.venue_booked===false?"false":""}><option value="">{lv?"Nav norādīts":"Not specified"}</option><option value="true">{lv?"Jā":"Yes"}</option><option value="false">{lv?"Nē":"No"}</option></select></label></>}
      {game.mode!=="physical"&&<label>{lv?"Online platforma":"Online platform"}<input name="online_platform" defaultValue={game.online_platform??""}/></label>}
      <label>{lv?"Apmaksa":"Payment"}<select name="payment_method" defaultValue={game.payment_method}><option value="free">{lv?"Bez maksas":"Free"}</option><option value="pay_at_venue">{lv?"Maksāt uz vietas":"Pay at venue"}</option><option value="pay_in_advance">{lv?"Maksāt iepriekš":"Pay in advance"}</option></select></label>
      <label>{lv?"Kopējā cena (€)":"Total cost (€)"}<input type="number" min="0" step="0.01" name="total_cost" defaultValue={Number(game.total_cost??0)}/></label>
      <label>{lv?"Vai organizators sedz arī savu daļu?":"Does the organizer pay their own share?"}<select name="organizer_share_included" defaultValue={game.organizer_share_included===false?"false":"true"}><option value="true">{lv?"Jā":"Yes"}</option><option value="false">{lv?"Nē":"No"}</option></select></label>
      {game.payment_method!=="free"&&Number(game.total_cost)>0&&<p className="hint">≈ €{(Number(game.total_cost)/Math.max(1,Number(game.additional_players_required)+(game.organizer_share_included===false?0:1))).toFixed(2)} {lv?"uz spēlētāju pēc pašreizējā sadalījuma":"per player with the current split"}</p>}
      <CancellationPolicyField locale={locale} currentMinutes={game.cancellation_policy_minutes} label={lv?"Bezmaksas atcelšana līdz":"Free cancellation until"}/>
      <label>{lv?"Piezīmes":"Notes"}<textarea name="description" rows={4} maxLength={2000} defaultValue={game.description??""}/></label>
      <button className="button primary wide" type="submit">{lv?"Saglabāt izmaiņas":"Save changes"}</button>
    </form>
  </div>;
}
