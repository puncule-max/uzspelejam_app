import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n";

function first<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

export default async function MyGamesPage() {
  const locale = await getLocale(); const t = getDictionary(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-games");
  const select = "id,starts_at,activity:activities(name_lv,name_en)";
  const [{ data: hosting }, { data: apps }, { data: participants }, { data: waiting }, { data: following }] = await Promise.all([
    supabase.from("games").select(select).eq("creator_id", user.id).order("starts_at"),
    supabase.from("game_applications").select(`status,game:games(${select})`).eq("user_id",user.id).eq("status","pending"),
    supabase.from("game_participants").select(`status,game:games(${select})`).eq("user_id",user.id).eq("status","accepted"),
    supabase.from("game_waiting_list").select(`status,game:games(${select})`).eq("user_id",user.id).eq("status","active"),
    supabase.from("game_followers").select(`game:games(${select})`).eq("user_id",user.id),
  ]);
  const Section = ({ title, rows }: { title: string; rows: any[] | null }) => <section className="panel"><h2>{title}</h2><div className="stack">{rows?.map((row:any, i:number) => { const g = first(row.game) ?? row; const a=first(g?.activity); return g ? <Link key={g.id ?? i} className="list-row" href={`/games/${g.id}`}><strong>{locale === "lv" ? a?.name_lv : a?.name_en}</strong><span>{formatGameDateTime(g.starts_at,locale)}</span></Link> : null; })}{!rows?.length && <p className="hint">{t.nothingHere}</p>}</div></section>;
  return <div className="page"><p className="eyebrow">{t.myGames}</p><h1>{t.yourGameStates}</h1><Section title={t.hosting} rows={hosting}/><Section title={t.joined} rows={participants}/><Section title={t.pending} rows={apps}/><Section title={t.waitingList} rows={waiting}/><Section title={t.following} rows={following}/></div>;
}
