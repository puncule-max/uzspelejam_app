import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime, skillLabel } from "@/lib/format";
import { getDictionary, getLocale, interpolate } from "@/lib/i18n";

export default async function ExplorePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: games } = await supabase.rpc("list_public_games", { p_limit: 50 });

  return <div className="page">
    <header className="topbar"><div><p className="eyebrow">Wanna play, my friend?</p><h1>{process.env.NEXT_PUBLIC_APP_NAME || t.brand}</h1></div><div className="top-actions">{user && <Link className="icon-button notification-link" href="/notifications" aria-label={t.notifications}>●</Link>}{user ? <Link className="text-button" href="/profile">{t.profile}</Link> : <Link className="button ghost" href="/login">{t.signIn}</Link>}</div></header>
    <section className="hero"><h2>{t.heroTitle}</h2><p>{t.heroBody}</p><div className="hero-actions"><Link className="button primary" href={user ? "/create" : "/login?next=/create"}>{t.createGame}</Link><span className="button ghost">You in?</span></div></section>
    <input className="search" placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
    <div className="chips">{[t.today,t.tomorrow,t.thisWeek,t.online,t.openSpots].map(x => <button className="chip" key={x}>{x}</button>)}</div>
    <div className="section-heading"><h2>{t.games}</h2><span>{games?.length ?? 0}</span></div>
    <div className="card-list">
      {games?.map((g:any) => {
        const full = Number(g.remaining_players) === 0;
        const missing = Number(g.remaining_players);
        return <Link className="game-card" href={`/games/${g.id}`} key={g.id}>
          <div className="card-top"><strong>{g.activity_name_en ?? "Game"}</strong><span className="status">{full ? t.fullyBooked : `${missing} ${t.spotsLeft}`}</span></div>
          <h3>{full ? t.joinWaitingList : missing === 1 ? t.oneMissing : interpolate(t.manyMissing,{count:missing})}</h3>
          <p>{formatGameDateTime(g.starts_at, locale)}</p>
          <p>{g.mode === "online" ? `Online · ${g.online_platform}` : [g.custom_location,g.city].filter(Boolean).join(" · ")}</p>
          <div className="meta-row"><span>{skillLabel(g.required_skill_levels, locale)}</span><span>{g.payment_method === "free" ? t.free : `€${Number(g.total_cost).toFixed(2)}`}</span></div>
          <div className="progress-line"><span>{g.accepted_players_count} {t.confirmed}</span><span>{full ? t.following : `${missing} ${t.spotsLeft}`}</span></div>
        </Link>;
      })}
      {!games?.length && <section className="panel"><h3>{t.noGames}</h3><p>{t.beFirst}</p><Link className="button primary" href={user ? "/create" : "/login?next=/create"}>{t.createGame}</Link></section>}
    </div>
  </div>;
}
