import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveFollowPreferences } from "@/app/follow-actions";
import { getLocale } from "@/lib/i18n";

export default async function FollowSettingsPage({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const lv = locale === "lv";
  const error = typeof sp.error === "string" ? sp.error : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${id}/follow`);

  const [{ data: game }, { data: follower }] = await Promise.all([
    supabase.from("games").select("id,activity:activities(name_lv,name_en)").eq("id",id).maybeSingle(),
    supabase.from("game_followers").select("*").eq("game_id",id).eq("user_id",user.id).maybeSingle(),
  ]);
  if (!game) notFound();

  const activity:any = Array.isArray(game.activity) ? game.activity[0] : game.activity;
  const defaults:any = follower ?? {
    notify_spot_available:true,
    notify_fully_booked:false,
    notify_date_change:true,
    notify_time_change:true,
    notify_venue_change:true,
    notify_price_change:false,
    notify_new_players:false,
    notify_booking_status:false,
    notify_cancelled:true,
    push_enabled:false,
  };

  const items = [
    ["notify_spot_available", lv?"Atbrīvojas vieta":"A spot becomes available"],
    ["notify_fully_booked", lv?"Spēle kļūst pilna":"Game becomes fully booked"],
    ["notify_date_change", lv?"Mainās datums":"Date changes"],
    ["notify_time_change", lv?"Mainās laiks":"Time changes"],
    ["notify_venue_change", lv?"Mainās vieta":"Venue changes"],
    ["notify_price_change", lv?"Mainās cena":"Price changes"],
    ["notify_new_players", lv?"Pievienojas jauni spēlētāji":"New players join"],
    ["notify_booking_status", lv?"Mainās rezervācijas statuss":"Venue booking status changes"],
    ["notify_cancelled", lv?"Spēle tiek atcelta":"Game is cancelled"],
  ] as const;

  return <div className="page narrow">
    <Link className="back" href={`/games/${id}`}>← {lv?"Spēle":"Game"}</Link>
    <p className="eyebrow">{lv?"Sekošana":"Following"}</p>
    <h1>{lv?"Par ko paziņot?":"What should we notify you about?"}</h1>
    <p className="lead">{lv ? (activity?.name_lv ?? "Spēle") : (activity?.name_en ?? "Game")}</p>
    {error && <p className="notice error">{error}</p>}
    <form action={saveFollowPreferences} className="wizard">
      <input type="hidden" name="game_id" value={id}/>
      <section className="panel">
        {items.map(([name,label]) => <label className="check-row" key={name}>
          <input type="checkbox" name={name} defaultChecked={Boolean(defaults[name])}/>
          <span>{label}</span>
        </label>)}
      </section>
      <input type="hidden" name="push_enabled" value=""/>
      <section className="panel">
        <strong>{lv?"In-app paziņojumi ir aktīvi":"In-app notifications are active"}</strong>
        <p className="hint">{lv?"Browser/mobile push piegāde tiks pieslēgta atsevišķi; šis iestatījums pašlaik neizliekas par aktīvu push kanālu.":"Browser/mobile push delivery is a separate integration; this setting does not pretend that push delivery is active."}</p>
      </section>
      <button className="button primary wide" type="submit">{lv?"Saglabāt":"Save"}</button>
    </form>
  </div>;
}
