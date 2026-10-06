import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime } from "@/lib/format";

export default async function MyGamesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-games");
  const [{ data: hosting }, { data: apps }, { data: participants }, { data: waiting }, { data: following }] = await Promise.all([
    supabase.from("games").select("id,starts_at,additional_players_required,activity:activities(name_en)").eq("creator_id", user.id).order("starts_at"),
    supabase.from("game_applications").select("status,game:games(id,starts_at,activity:activities(name_en))").eq("user_id",user.id).eq("status","pending"),
    supabase.from("game_participants").select("status,game:games(id,starts_at,activity:activities(name_en))").eq("user_id",user.id).eq("status","accepted"),
    supabase.from("game_waiting_list").select("status,game:games(id,starts_at,activity:activities(name_en))").eq("user_id",user.id).eq("status","active"),
    supabase.from("game_followers").select("game:games(id,starts_at,activity:activities(name_en))").eq("user_id",user.id),
  ]);
  const Section = ({ title, rows }: { title: string; rows: any[] | null }) => <section className="panel"><h2>{title}</h2><div className="stack">{rows?.map((row:any, i:number) => { const g = row.game ?? row; return g ? <Link key={g.id ?? i} className="list-row" href={`/games/${g.id}`}><strong>{g.activity?.name_en ?? "Game"}</strong><span>{formatGameDateTime(g.starts_at)}</span></Link> : null; })}{!rows?.length && <p className="hint">Nothing here yet.</p>}</div></section>;
  return <div className="page"><p className="eyebrow">My Games</p><h1>Your game states</h1><Section title="Hosting" rows={hosting}/><Section title="Joined" rows={participants}/><Section title="Pending" rows={apps}/><Section title="Waiting list" rows={waiting}/><Section title="Following" rows={following}/></div>;
}
