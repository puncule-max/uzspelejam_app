import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameDetails } from "@/lib/game-data";
import { formatGameDateTime, skillLabel } from "@/lib/format";
import { joinGame, joinWaitingList, withdrawApplication, leaveWaitingList, leaveGame, followGame, unfollowGame } from "@/app/game-actions";

function HiddenGame({ id }: { id: string }) { return <input type="hidden" name="game_id" value={id} />; }

export default async function GameDetails({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const data = await getGameDetails(id);
  if (!data) notFound();
  const { game, user, access, acceptedCount } = data;
  if (!access.permissions.canViewGame) notFound();
  const activity = game.activity?.name_en ?? "Game";
  const location = game.mode === "online" ? `Online · ${game.online_platform}` : [game.custom_location, game.city].filter(Boolean).join(" · ");
  const actionTypes = new Set(access.actions.map(a => a.type));

  return <div className="page">
    <Link href="/" className="back">← Explore</Link>
    {error && <p className="notice error">{error}</p>}
    <section className="detail-hero">
      <span className="activity">{activity}</span>
      <h1>{access.gameStatus === "fully_booked" ? "Fully booked" : access.gameStatus === "open" ? `${access.remainingPlayers} ${access.remainingPlayers === 1 ? "person" : "people"} still needed` : access.gameStatus}</h1>
      <p className="lead">{acceptedCount} confirmed · {skillLabel(game.required_skill_levels)}</p>
      {actionTypes.has("sign_in") && <Link className="button primary wide" href={`/login?next=/games/${id}`}>Sign in to join</Link>}
      {actionTypes.has("join") && <form action={joinGame}><HiddenGame id={id}/><button className="button primary wide" type="submit">Join</button></form>}
      {actionTypes.has("join_waiting_list") && <form action={joinWaitingList}><HiddenGame id={id}/><button className="button primary wide" type="submit">Join waiting list</button></form>}
      {access.userGameState === "pending" && <div className="status-box"><strong>Request pending</strong><span>Waiting for organizer approval.</span></div>}
      {access.userGameState === "waiting_list" && <div className="status-box"><strong>You’re on the waiting list</strong><span>We’ll keep your place in the queue.</span></div>}
      {access.userGameState === "accepted" && <div className="status-box success"><strong>You’re in.</strong><span>This game is confirmed for you.</span></div>}
      {access.userGameState === "organizer" && <Link className="button primary wide" href={`/games/${id}/manage`}>Manage game</Link>}
      <div className="dual-actions">
        {actionTypes.has("follow") && <form action={followGame}><HiddenGame id={id}/><button className="button ghost" type="submit">Follow</button></form>}
        {actionTypes.has("unfollow") && <form action={unfollowGame}><HiddenGame id={id}/><button className="button ghost" type="submit">Following · Unfollow</button></form>}
        {actionTypes.has("withdraw_application") && <form action={withdrawApplication}><HiddenGame id={id}/><button className="button ghost" type="submit">Withdraw request</button></form>}
        {actionTypes.has("leave_waiting_list") && <form action={leaveWaitingList}><HiddenGame id={id}/><button className="button ghost" type="submit">Leave waiting list</button></form>}
        {actionTypes.has("leave_game") && <form action={leaveGame}><HiddenGame id={id}/><button className="button danger" type="submit">Leave game</button></form>}
      </div>
    </section>
    <section className="detail-grid">
      <article className="panel"><h3>When</h3><p>{formatGameDateTime(game.starts_at)}</p></article>
      <article className="panel"><h3>Where</h3><p>{location || "TBA"}</p></article>
      <article className="panel"><h3>Level</h3><p>{skillLabel(game.required_skill_levels)}</p></article>
      <article className="panel"><h3>Cost</h3><p>{game.payment_method === "free" ? "Free" : `€${Number(game.total_cost).toFixed(2)} · ${String(game.payment_method).replaceAll("_"," ")}`}</p></article>
    </section>
    <section className="panel"><h2>Game details</h2><p>{game.description || "No additional notes."}</p><p>{game.venue_booked === true ? "Venue booked ✓" : game.venue_booked === false ? "Venue not booked yet" : ""}</p><p>Visibility: {game.visibility}</p></section>
    <section className="panel"><h2>Your status</h2><p><strong>{access.userGameState.replaceAll("_", " ")}</strong></p>{user ? <p>Available actions are resolved server-side from your game state.</p> : <p>Sign in to join, follow or enter the waiting list.</p>}</section>
  </div>;
}
