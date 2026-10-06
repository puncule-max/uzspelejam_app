import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameDetails } from "@/lib/game-data";
import { formatGameDateTime, skillLabel } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n";
import { joinGame, joinWaitingList, withdrawApplication, leaveWaitingList, leaveGame, followGame, unfollowGame } from "@/app/game-actions";
import { reportGame, blockUser } from "@/app/safety-actions";

function HiddenGame({ id }: { id: string }) { return <input type="hidden" name="game_id" value={id} />; }

export default async function GameDetails({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const locale = await getLocale(); const t = getDictionary(locale);
  const error = typeof sp.error === "string" ? sp.error : null;
  const data = await getGameDetails(id);
  if (!data) notFound();
  const { game, user, access, acceptedCount, conversationId, positionOptions } = data;
  if (!access.permissions.canViewGame) notFound();
  const activity = locale === "lv" ? game.activity?.name_lv : game.activity?.name_en;
  const location = game.mode === "online" ? `Online · ${game.online_platform}` : [game.custom_location, game.city].filter(Boolean).join(" · ");
  const actionTypes = new Set(access.actions.map(a => a.type));
  const missingTitle = access.gameStatus === "fully_booked" ? t.fullyBooked : access.gameStatus === "open" ? (access.remainingPlayers === 1 ? t.oneMissing : t.manyMissing.replace("{count}",String(access.remainingPlayers))) : access.gameStatus;

  return <div className="page">
    <Link href="/" className="back">← {t.explore}</Link>
    {error && <p className="notice error">{error}</p>}
    <section className="detail-hero">
      <span className="activity">{activity ?? "Game"}</span>
      <h1>{missingTitle}</h1>
      <p className="lead">{acceptedCount} {t.confirmed} · {skillLabel(game.required_skill_levels,locale)}</p>
      {actionTypes.has("sign_in") && <Link className="button primary wide" href={`/login?next=/games/${id}`}>{t.signInToJoin}</Link>}
      {actionTypes.has("join") && <form action={joinGame} className="join-form"><HiddenGame id={id}/>{game.activity?.supports_positions&&positionOptions.length>0&&<label>{locale==="lv"?"Vēlamā pozīcija":"Preferred position"}<select name="position_id" defaultValue=""><option value="">{locale==="lv"?"Nav preferences":"No preference"}</option>{positionOptions.map((p:any)=><option key={p.id} value={p.id}>{locale==="lv"?p.name_lv:p.name_en}{p.required_count>0?` · ${p.remaining_count} ${locale==="lv"?"vēl vajag":"still needed"}`:""}</option>)}</select></label>}<button className="button primary wide" type="submit">{t.join}</button></form>}
      {actionTypes.has("join_waiting_list") && <form action={joinWaitingList}><HiddenGame id={id}/><button className="button primary wide" type="submit">{t.joinWaitingList}</button></form>}
      {access.userGameState === "pending" && <div className="status-box"><strong>{t.requestPending}</strong></div>}
      {access.userGameState === "waiting_list" && <div className="status-box"><strong>{t.waitingStatus}</strong>{access.waitingListPosition && <span>{locale==="lv" ? `Tava vieta: #${access.waitingListPosition}` : `Your position: #${access.waitingListPosition}`}</span>}</div>}
      {access.userGameState === "accepted" && <div className="status-box success"><strong>{t.youreIn}</strong></div>}
      {access.userGameState === "organizer" && <Link className="button primary wide" href={`/games/${id}/manage`}>{t.manageGame}</Link>}
      {conversationId && (actionTypes.has("open_group_chat") || actionTypes.has("message_organizer")) && <Link className="button primary wide" href={`/messages/${conversationId}`}>{actionTypes.has("open_group_chat") ? t.openGroupChat : t.messageOrganizer}</Link>}
      {actionTypes.has("rate_players") && <Link className="button primary wide" href={`/games/${id}/rate`}>{locale==="lv"?"Novērtēt spēlētājus":"Rate players"}</Link>}
      <div className="dual-actions">
        {actionTypes.has("follow") && <form action={followGame}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.follow}</button></form>}
        {actionTypes.has("edit_follow_preferences") && <Link className="button ghost" href={`/games/${id}/follow`}>{locale==="lv"?"Sekošanas iestatījumi":"Follow settings"}</Link>}
        {actionTypes.has("unfollow") && <form action={unfollowGame}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.unfollow}</button></form>}
        {actionTypes.has("withdraw_application") && <form action={withdrawApplication}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.withdraw}</button></form>}
        {actionTypes.has("leave_waiting_list") && <form action={leaveWaitingList}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.leaveWaiting}</button></form>}
        {actionTypes.has("leave_game") && <form action={leaveGame}><HiddenGame id={id}/><button className="button danger" type="submit">{t.leaveGame}</button></form>}
      </div>
    </section>
    <section className="detail-grid">
      <article className="panel"><h3>{t.when}</h3><p>{formatGameDateTime(game.starts_at,locale)}</p></article>
      <article className="panel"><h3>{t.where}</h3><p>{location || "TBA"}</p></article>
      <article className="panel"><h3>{t.level}</h3><p>{skillLabel(game.required_skill_levels,locale)}</p></article>
      <article className="panel"><h3>{t.cost}</h3><p>{game.payment_method === "free" ? t.free : `€${Number(game.total_cost).toFixed(2)}`}</p></article>
    </section>
    {game.activity?.supports_positions&&positionOptions.some((p:any)=>p.required_count>0)&&<section className="panel"><h2>{locale==="lv"?"Vajadzīgās pozīcijas":"Positions needed"}</h2><div className="stack">{positionOptions.filter((p:any)=>p.required_count>0).map((p:any)=><div className="position-status" key={p.id}><strong>{locale==="lv"?p.name_lv:p.name_en}</strong><span>{p.accepted_count}/{p.required_count} · {p.remaining_count>0?`${p.remaining_count} ${locale==="lv"?"vēl vajag":"still needed"}`:(locale==="lv"?"Nokomplektēts":"Filled")}</span></div>)}</div></section>}
    <section className="panel"><h2>{t.gameDetails}</h2><p>{game.description || "—"}</p><p>{game.venue_booked === true ? (locale==="lv"?"Vieta rezervēta ✓":"Venue booked ✓") : game.venue_booked === false ? (locale==="lv"?"Vieta vēl nav rezervēta":"Venue not booked yet") : ""}</p></section>
    <section className="panel"><h2>{t.yourStatus}</h2><p><strong>{access.userGameState.replaceAll("_", " ")}</strong></p></section>
    {user && user.id !== game.creator_id && <section className="panel">
      <h2>{locale==="lv"?"Drošība":"Safety"}</h2>
      {sp.reported === "1" && <p className="notice success">{locale==="lv"?"Ziņojums nosūtīts.":"Report submitted."}</p>}
      <details>
        <summary>{locale==="lv"?"Ziņot par spēli / organizatoru":"Report game / organizer"}</summary>
        <form action={reportGame} className="wizard">
          <input type="hidden" name="game_id" value={id}/>
          <label>{locale==="lv"?"Iemesls":"Reason"}<select name="reason" defaultValue="unsafe">
            <option value="spam">Spam</option>
            <option value="harassment">{locale==="lv"?"Uzmākšanās":"Harassment"}</option>
            <option value="unsafe">{locale==="lv"?"Nedroša situācija":"Unsafe"}</option>
            <option value="inappropriate">{locale==="lv"?"Nepiemērots saturs":"Inappropriate"}</option>
            <option value="fraud">{locale==="lv"?"Krāpšana":"Fraud"}</option>
            <option value="other">{locale==="lv"?"Cits":"Other"}</option>
          </select></label>
          <label>{locale==="lv"?"Komentārs":"Comment"}<textarea name="comment" rows={3} maxLength={2000}/></label>
          <button className="button ghost" type="submit">{locale==="lv"?"Nosūtīt ziņojumu":"Submit report"}</button>
        </form>
      </details>
      <form action={blockUser} className="safety-block-form">
        <input type="hidden" name="user_id" value={game.creator_id}/>
        <input type="hidden" name="game_id" value={id}/>
        <button className="button danger wide" type="submit">{locale==="lv"?"Bloķēt organizatoru":"Block organizer"}</button>
      </form>
    </section>}
  </div>;
}
