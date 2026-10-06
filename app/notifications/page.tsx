import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const labels: Record<string,string> = {
  application_received: "New join request",
  application_accepted: "You’re in",
  application_declined: "Request declined",
  spot_available: "A spot just opened up",
  fully_booked: "Game is fully booked",
  waiting_list_promoted: "You’re in from the waiting list",
  game_cancelled: "Game cancelled",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  const { data: rows } = await supabase
    .from("notifications")
    .select("id,type,game_id,payload,read_at,created_at,game:games(activity:activities(name_en))")
    .eq("user_id",user.id)
    .order("created_at",{ascending:false})
    .limit(100);

  return <div className="page">
    <p className="eyebrow">Notifications</p>
    <h1>What changed</h1>
    <section className="panel">
      <div className="stack">
        {rows?.map((n:any) => <Link key={n.id} className="notification-row" href={n.game_id ? `/games/${n.game_id}` : "#"}>
          <div><strong>{labels[n.type] ?? n.type}</strong><p>{n.game?.activity?.name_en ?? "Game"}</p></div>
          <span>{new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Riga",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(n.created_at))}</span>
        </Link>)}
        {!rows?.length && <p className="hint">Nothing new yet.</p>}
      </div>
    </section>
  </div>;
}
