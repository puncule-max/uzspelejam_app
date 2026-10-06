import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime, skillLabel } from "@/lib/format";
import { getDictionary, getLocale, interpolate } from "@/lib/i18n";

type SearchParams = Record<string,string|string[]|undefined>;

function one(value: string|string[]|undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildUrl(current: SearchParams, changes: Record<string,string|null>) {
  const params = new URLSearchParams();
  for (const [key,value] of Object.entries(current)) {
    const v = one(value);
    if (v) params.set(key,v);
  }
  for (const [key,value] of Object.entries(changes)) {
    if (!value) params.delete(key); else params.set(key,value);
  }
  const q = params.toString();
  return q ? `/?${q}` : "/";
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const query = one(params.q) ?? "";
  const quick = one(params.quick) ?? "";
  const modeRaw = one(params.mode);
  const mode = modeRaw === "online" ? "online" : null;
  const openOnly = one(params.open) === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: games } = await supabase.rpc("list_public_games", {
    p_limit: 50,
    p_query: query || null,
    p_mode: mode,
    p_quick: quick || null,
    p_open_only: openOnly,
  });

  const quickFilters = [
    { key:"today", label:t.today, href:buildUrl(params,{quick:quick==="today"?null:"today"}) },
    { key:"tomorrow", label:t.tomorrow, href:buildUrl(params,{quick:quick==="tomorrow"?null:"tomorrow"}) },
    { key:"week", label:t.thisWeek, href:buildUrl(params,{quick:quick==="week"?null:"week"}) },
    { key:"online", label:t.online, href:buildUrl(params,{mode:mode==="online"?null:"online"}) },
    { key:"open", label:t.openSpots, href:buildUrl(params,{open:openOnly?null:"1"}) },
  ];

  return <div className="page">
    <header className="topbar"><div><p className="eyebrow">Wanna play, my friend?</p><h1>{process.env.NEXT_PUBLIC_APP_NAME || t.brand}</h1></div><div className="top-actions">{user && <Link className="icon-button notification-link" href="/notifications" aria-label={t.notifications}>●</Link>}{user ? <Link className="text-button" href="/profile">{t.profile}</Link> : <Link className="button ghost" href="/login">{t.signIn}</Link>}</div></header>
    <section className="hero"><h2>{t.heroTitle}</h2><p>{t.heroBody}</p><div className="hero-actions"><Link className="button primary" href={user ? "/create" : "/login?next=/create"}>{t.createGame}</Link><span className="button ghost">You in?</span></div></section>

    <form className="search-form" action="/" method="get">
      <input className="search" name="q" defaultValue={query} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
      {quick && <input type="hidden" name="quick" value={quick}/>}
      {mode && <input type="hidden" name="mode" value={mode}/>}
      {openOnly && <input type="hidden" name="open" value="1"/>}
      <button className="button primary" type="submit">{locale==="lv"?"Meklēt":"Search"}</button>
    </form>

    <div className="chips">{quickFilters.map(f => {
      const active = (f.key==="today"&&quick==="today")||(f.key==="tomorrow"&&quick==="tomorrow")||(f.key==="week"&&quick==="week")||(f.key==="online"&&mode==="online")||(f.key==="open"&&openOnly);
      return <Link className={`chip ${active?"active":""}`} href={f.href} key={f.key}>{f.label}</Link>;
    })}</div>

    <div className="section-heading"><h2>{t.games}</h2><span>{games?.length ?? 0}</span></div>
    <div className="card-list">
      {games?.map((g:any) => {
        const full = Number(g.remaining_players) === 0;
        const missing = Number(g.remaining_players);
        const activityName = locale === "lv" ? g.activity_name_lv : g.activity_name_en;
        return <Link className="game-card" href={`/games/${g.id}`} key={g.id}>
          <div className="card-top"><strong>{activityName ?? "Game"}</strong><span className="status">{full ? t.fullyBooked : `${missing} ${t.spotsLeft}`}</span></div>
          <h3>{full ? t.joinWaitingList : missing === 1 ? t.oneMissing : interpolate(t.manyMissing,{count:missing})}</h3>
          <p>{formatGameDateTime(g.starts_at, locale)}</p>
          <p>{g.mode === "online" ? `Online · ${g.online_platform}` : [g.custom_location,g.city].filter(Boolean).join(" · ")}</p>
          <div className="meta-row"><span>{skillLabel(g.required_skill_levels, locale)}</span><span>{g.payment_method === "free" ? t.free : `€${Number(g.total_cost).toFixed(2)}`}</span></div>
          <div className="progress-line"><span>{g.accepted_players_count} {t.confirmed}</span><span>{full ? t.following : `${missing} ${t.spotsLeft}`}</span></div>
        </Link>;
      })}
      {!games?.length && <section className="panel"><h3>{t.noGames}</h3><p>{query || quick || mode || openOnly ? (locale==="lv"?"Pamēģini citu meklēšanu vai filtru.":"Try another search or filter.") : t.beFirst}</p><Link className="button primary" href={user ? "/create" : "/login?next=/create"}>{t.createGame}</Link></section>}
    </div>
  </div>;
}
