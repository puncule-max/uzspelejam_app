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

  const select = "id,starts_at,ends_at,activity:activities(name_lv,name_en)";
  const [{ data: hostingAll }, { data: apps }, { data: participantsAll }, { data: waiting }, { data: following }] = await Promise.all([
    supabase.from("games").select(select).eq("creator_id", user.id).order("starts_at"),
    supabase.from("game_applications").select(`status,game:games(${select})`).eq("user_id",user.id).eq("status","pending"),
    supabase.from("game_participants").select(`status,game:games(${select})`).eq("user_id",user.id).eq("status","accepted"),
    supabase.from("game_waiting_list").select(`status,game:games(${select})`).eq("user_id",user.id).eq("status","active"),
    supabase.from("game_followers").select(`game:games(${select})`).eq("user_id",user.id),
  ]);

  const now = Date.now();
  const hosting = (hostingAll ?? []).filter((g:any) => new Date(g.ends_at).getTime() > now);
  const joined = (participantsAll ?? []).filter((r:any) => {
    const g:any=first(r.game); return g && new Date(g.ends_at).getTime() > now;
  });

  const pastMap = new Map<string,any>();
  for (const g of hostingAll ?? []) {
    if (new Date((g as any).ends_at).getTime() <= now) pastMap.set((g as any).id,g);
  }
  for (const r of participantsAll ?? []) {
    const g:any=first((r as any).game);
    if (g && new Date(g.ends_at).getTime() <= now) pastMap.set(g.id,g);
  }
  const past = [...pastMap.values()].sort((a:any,b:any)=>new Date(b.ends_at).getTime()-new Date(a.ends_at).getTime());

  const Section = ({ title, rows, rate = false }: { title: string; rows: any[] | null; rate?: boolean }) =>
    <section className="panel"><h2>{title}</h2><div className="stack">
      {rows?.map((row:any, i:number) => {
        const g:any = first(row.game) ?? row; const a:any=first(g?.activity);
        return g ? <div className="list-row" key={g.id ?? i}>
          <Link href={`/games/${g.id}`}><strong>{locale === "lv" ? a?.name_lv : a?.name_en}</strong><span>{formatGameDateTime(g.starts_at,locale)}</span></Link>
          {rate && <Link className="button ghost" href={`/games/${g.id}/rate`}>{locale==="lv"?"Novērtēt":"Rate"}</Link>}
        </div> : null;
      })}
      {!rows?.length && <p className="hint">{t.nothingHere}</p>}
    </div></section>;

  return <div className="page">
    <p className="eyebrow">{t.myGames}</p><h1>{t.yourGameStates}</h1>
    <Section title={t.hosting} rows={hosting}/>
    <Section title={t.joined} rows={joined}/>
    <Section title={t.pending} rows={apps}/>
    <Section title={t.waitingList} rows={waiting}/>
    <Section title={t.following} rows={following}/>
    <Section title={locale==="lv"?"Pabeigtās":"Past"} rows={past} rate/>
  </div>;
}
