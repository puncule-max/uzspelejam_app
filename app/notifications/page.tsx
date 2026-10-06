import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n";
import { openNotification, markAllNotificationsRead } from "@/app/notification-actions";

export default async function NotificationsPage() {
  const locale = await getLocale(); const t = getDictionary(locale);
  const labels: Record<string,string> = locale === "lv" ? {
    application_received:"Jauns pieteikums",
    application_accepted:"Tu piedalies",
    application_declined:"Pieteikums noraidīts",
    spot_available:"Atbrīvojās vieta",
    fully_booked:"Spēle ir pilna",
    waiting_list_promoted:"Tu esi iekļauts spēlē",
    game_cancelled:"Spēle atcelta",
    date_changed:"Mainījās datums",
    time_changed:"Mainījās laiks",
    venue_changed:"Mainījās vieta",
    price_changed:"Mainījās cena",
    booking_status_changed:"Mainījās rezervācijas statuss",
    new_player:"Pievienojās jauns spēlētājs",
    participant_removed:"Tu vairs neesi spēles dalībnieks",
  } : {
    application_received:"New join request",application_accepted:"You’re in",application_declined:"Request declined",spot_available:"A spot just opened up",fully_booked:"Game is fully booked",waiting_list_promoted:"You’re in from the waiting list",game_cancelled:"Game cancelled",date_changed:"Date changed",time_changed:"Time changed",venue_changed:"Venue changed",price_changed:"Price changed",booking_status_changed:"Booking status changed",new_player:"New player joined",participant_removed:"You were removed from the game"
  };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");
  const { data: rows } = await supabase.from("notifications").select("id,type,game_id,payload,read_at,created_at,game:games(activity:activities(name_lv,name_en))").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
  return <div className="page"><p className="eyebrow">{t.notifications}</p><div className="card-top"><h1>{t.whatChanged}</h1><form action={markAllNotificationsRead}><button className="button ghost" type="submit">{locale==="lv"?"Atzīmēt visu kā izlasītu":"Mark all read"}</button></form></div><section className="panel"><div className="stack">
    {rows?.map((n:any) => {const game=Array.isArray(n.game)?n.game[0]:n.game; const a=Array.isArray(game?.activity)?game.activity[0]:game?.activity; return <form action={openNotification} key={n.id}><input type="hidden" name="notification_id" value={n.id}/><input type="hidden" name="game_id" value={n.game_id??""}/><button className={`notification-row notification-button ${n.read_at?"":"unread"}`} type="submit"><div><strong>{labels[n.type] ?? n.type}</strong><p>{locale==="lv"?a?.name_lv:a?.name_en}</p></div><span>{new Intl.DateTimeFormat(locale==="lv"?"lv-LV":"en-GB",{timeZone:"Europe/Riga",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(n.created_at))}</span></button></form>})}
    {!rows?.length && <p className="hint">{t.nothingNew}</p>}
  </div></section></div>;
}
