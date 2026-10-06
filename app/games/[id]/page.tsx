import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameDetails } from "@/lib/game-data";
import { formatGameDateTime, skillLabel, missingNeedLabel } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n";
import { joinGame, joinWaitingList, withdrawApplication, leaveWaitingList, leaveGame, followGame, unfollowGame } from "@/app/game-actions";
import { reportGame, blockUser } from "@/app/safety-actions";
import { ShareButton } from "@/components/share-button";
import { openOrganizerConversation } from "@/app/message-actions";
import { Avatar } from "@/components/avatar";

function HiddenGame({ id }: { id: string }) { return <input type="hidden" name="game_id" value={id} />; }

export default async function GameDetails({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const locale = await getLocale(); const t = getDictionary(locale);
  const error = typeof sp.error === "string" ? sp.error : null;
  const data = await getGameDetails(id);
  if (!data) notFound();
  const { game, user, access, acceptedCount, conversationId, positionOptions, organizerProfile, teams, acceptedParticipants } = data;
  if (!access.permissions.canViewGame) notFound();
  const activity = locale === "lv" ? game.activity?.name_lv : game.activity?.name_en;
  const location = game.mode === "online" ? `Online · ${game.online_platform}` : [game.custom_location, game.city].filter(Boolean).join(" · ");
  const actionTypes = new Set(access.actions.map(a => a.type));
  const requiredOpen=positionOptions.filter((p:any)=>p.remaining_count>0);
  const requiredOpenTotal=requiredOpen.reduce((sum:number,p:any)=>sum+Number(p.remaining_count),0);
  const positionName=requiredOpen.length===1&&requiredOpenTotal===access.remainingPlayers
    ? (locale==="lv"?requiredOpen[0].name_lv:requiredOpen[0].name_en)
    : null;
  const missingTitle = access.gameStatus === "fully_booked"
    ? t.fullyBooked
    : access.gameStatus === "open"
      ? missingNeedLabel({
          remaining:access.remainingPlayers,
          participationType:game.activity?.participation_type,
          activityCode:game.activity?.code,
          positionName,
          locale
        })
      : access.gameStatus;
  const payerCount=Math.max(1,Number(game.additional_players_required)+(game.organizer_share_included===false?0:1));
  const perPlayer=Number(game.total_cost??0)/payerCount;

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
      {conversationId && actionTypes.has("open_group_chat") && <Link className="button primary wide" href={`/messages/${conversationId}`}>{t.openGroupChat}</Link>}
      {actionTypes.has("message_organizer") && <form action={openOrganizerConversation}><HiddenGame id={id}/><button className="button ghost wide" type="submit">{t.messageOrganizer}</button></form>}
      {actionTypes.has("rate_players") && <Link className="button primary wide" href={`/games/${id}/rate`}>{locale==="lv"?"Novērtēt spēlētājus":"Rate players"}</Link>}
      <div className="dual-actions">
        {actionTypes.has("follow") && <form action={followGame}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.follow}</button></form>}
        {actionTypes.has("edit_follow_preferences") && <Link className="button ghost" href={`/games/${id}/follow`}>{locale==="lv"?"Sekošanas iestatījumi":"Follow settings"}</Link>}
        {actionTypes.has("unfollow") && <form action={unfollowGame}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.unfollow}</button></form>}
        {access.permissions.canShareGame && <ShareButton label={locale==="lv"?"Dalīties":"Share"} text={access.remainingPlayers===1?"One spot left. You in?":"You in?"}/>}
        {actionTypes.has("withdraw_application") && <form action={withdrawApplication}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.withdraw}</button></form>}
        {actionTypes.has("leave_waiting_list") && <form action={leaveWaitingList}><HiddenGame id={id}/><button className="button ghost" type="submit">{t.leaveWaiting}</button></form>}
        {actionTypes.has("leave_game") && <form action={leaveGame}><HiddenGame id={id}/><button className="button danger" type="submit">{t.leaveGame}</button></form>}
      </div>
    </section>
    <section className="panel organizer-card">
      <h2>{locale==="lv"?"Organizators":"Organizer"}</h2>
      <Link className="organizer-link" href={`/users/${game.creator_id}`}>
        <Avatar className="avatar-small" src={organizerProfile?.avatar_url} name={organizerProfile?.display_name}/>
        <div>
          <strong>{organizerProfile?.display_name ?? (locale==="lv"?"Organizators":"Organizer")}</strong>
          <p className="hint">★ {Number(organizerProfile?.rating_average ?? 0).toFixed(1)} ({organizerProfile?.rating_count ?? 0}) · {organizerProfile?.completed_games_count ?? 0} {locale==="lv"?"spēles":"games"}</p>
        </div>
      </Link>
    </section>
    <section className="detail-grid">
      <article className="panel"><h3>{t.when}</h3><p>{formatGameDateTime(game.starts_at,locale)}</p></article>
      <article className="panel"><h3>{t.where}</h3><p>{location || "TBA"}</p></article>
      <article className="panel"><h3>{t.level}</h3><p>{skillLabel(game.required_skill_levels,locale)}</p></article>
      <article className="panel"><h3>{t.cost}</h3>{game.payment_method==="free"?<p>{t.free}</p>:<><p>€{Number(game.total_cost).toFixed(2)} · ≈ €{perPlayer.toFixed(2)} / {locale==="lv"?"spēlētāju":"player"}</p><p className="hint">{game.organizer_share_included===false?(locale==="lv"?"Organizatora daļa nav iekļauta sadalījumā.":"Organizer share is excluded from the split."):(locale==="lv"?"Organizatora daļa ir iekļauta sadalījumā.":"Organizer share is included in the split.")}</p></>}</article>
    </section>
    {game.activity?.supports_positions&&positionOptions.some((p:any)=>p.required_count>0)&&<section className="panel"><h2>{locale==="lv"?"Vajadzīgās pozīcijas":"Positions needed"}</h2><div className="stack">{positionOptions.filter((p:any)=>p.required_count>0).map((p:any)=><div className="position-status" key={p.id}><strong>{locale==="lv"?p.name_lv:p.name_en}</strong><span>{p.accepted_count}/{p.required_count} · {p.remaining_count>0?`${p.remaining_count} ${locale==="lv"?"vēl vajag":"still needed"}`:(locale==="lv"?"Nokomplektēts":"Filled")}</span></div>)}</div></section>}
    {access.permissions.canViewConfirmedParticipants&&<section className="panel">
      <h2>{locale==="lv"?"Dalībnieki":"Participants"}</h2>
      <div className="stack">
        {acceptedParticipants.map((row:any)=>{
          const profile:any=Array.isArray(row.profile)?row.profile[0]:row.profile;
          const position:any=Array.isArray(row.position)?row.position[0]:row.position;
          const team=teams.find((x:any)=>x.id===row.team_id);
          return <Link className="participant-public-row" href={`/users/${row.user_id}`} key={row.user_id}>
            <Avatar className="avatar-small" src={profile?.avatar_url} name={profile?.display_name}/>
            <div><strong>{profile?.display_name??(locale==="lv"?"Spēlētājs":"Player")}</strong><p className="hint">{[team?.name,position?(locale==="lv"?position.name_lv:position.name_en):null].filter(Boolean).join(" · ")}</p></div>
            <span>★ {Number(profile?.rating_average??0).toFixed(1)}</span>
          </Link>;
        })}
        {!acceptedParticipants.length&&<p className="hint">{locale==="lv"?"Vēl nav apstiprinātu dalībnieku.":"No confirmed participants yet."}</p>}
      </div>
    </section>}
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
