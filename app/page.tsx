import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime, skillLabel } from "@/lib/format";

export default async function ExplorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: games } = await supabase.from("games").select("id,starts_at,ends_at,mode,custom_location,city,online_platform,additional_players_required,required_skill_levels,total_cost,payment_method,venue_booked,activity:activities(name_en)").eq("visibility", "public").is("cancelled_at", null).gt("ends_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(50);
  return <div className="page">
    <header className="topbar"><div><p className="eyebrow">Wanna play, my friend?</p><h1>{process.env.NEXT_PUBLIC_APP_NAME || "Uzspēlējam?"}</h1></div><div className="top-actions">{user && <Link className="icon-button notification-link" href="/notifications" aria-label="Notifications">●</Link>}{user ? <Link className="text-button" href="/profile">Profile</Link> : <Link className="button ghost" href="/login">Sign in</Link>}</div></header>
    <section className="hero"><h2>Find the spot that needs you.</h2><p>Only games that need another person: football, 3x3, padel, chess, boxing, cards and more.</p><div className="hero-actions"><Link className="button primary" href={user ? "/create" : "/login?next=/create"}>Create a game</Link><span className="button ghost">You in?</span></div></section>
    <input className="search" placeholder="What do you want to play?" aria-label="Search games" />
    <div className="chips">{["Today","Tomorrow","This week","Online","Open spots"].map(x => <button className="chip" key={x}>{x}</button>)}</div>
    <div className="section-heading"><h2>Open games</h2><span>{games?.length ?? 0} games</span></div>
    <div className="card-list">{games?.map((g:any) => <Link className="game-card" href={`/games/${g.id}`} key={g.id}><div className="card-top"><strong>{g.activity?.name_en ?? "Game"}</strong><span className="status">{g.additional_players_required} needed</span></div><h3>{g.additional_players_required === 1 ? "One person missing" : `${g.additional_players_required} people missing`}</h3><p>{formatGameDateTime(g.starts_at)}</p><p>{g.mode === "online" ? `Online · ${g.online_platform}` : [g.custom_location,g.city].filter(Boolean).join(" · ")}</p><div className="meta-row"><span>{skillLabel(g.required_skill_levels)}</span><span>{g.payment_method === "free" ? "Free" : `€${Number(g.total_cost).toFixed(2)} total`}</span></div></Link>)}{!games?.length && <section className="panel"><h3>No games yet.</h3><p>Be the first to create one.</p><Link className="button primary" href={user ? "/create" : "/login?next=/create"}>Create game</Link></section>}</div>
  </div>;
}
