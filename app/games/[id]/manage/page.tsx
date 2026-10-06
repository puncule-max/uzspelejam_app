import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptApplication, declineApplication, promoteWaitingUser } from "@/app/game-actions";
import { createPrivateInvite } from "@/app/invite-actions";
import { setPositionRequirement } from "@/app/position-actions";
import { updateParticipantAssignment, removeParticipant } from "@/app/participant-actions";
import { getLocale } from "@/lib/i18n";
import { cancelGame } from "@/app/game-admin-actions";

function first<T>(value:T|T[]|null|undefined):T|null { return Array.isArray(value)?value[0]??null:value??null; }

export default async function ManageGame({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params; const sp=await searchParams; const locale=await getLocale(); const lv=locale==="lv";
  const error=typeof sp.error==="string"?sp.error:null;
  const invite=typeof sp.invite==="string"?sp.invite:null;

  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect(`/login?next=/games/${id}/manage`);

  const {data:gameRaw}=await supabase.from("games")
    .select("id,creator_id,visibility,additional_players_required,cancelled_at,activity:activities(id,name_lv,name_en,supports_positions,supports_teams)")
    .eq("id",id).single();
  if(!gameRaw) notFound();
  const activity:any=first(gameRaw.activity);
  const game={...gameRaw,activity};
  if(game.creator_id!==user.id) redirect(`/games/${id}`);

  const teamsPromise=activity?.supports_teams
    ? supabase.from("game_teams").select("id,name,sort_order,max_players").eq("game_id",id).order("sort_order")
    : Promise.resolve({data:[]});

  const positionsPromise=activity?.supports_positions
    ? supabase.from("positions").select("id,name_lv,name_en,sort_order").eq("activity_id",activity.id).eq("active",true).order("sort_order")
    : Promise.resolve({data:[]});
  const requirementsPromise=activity?.supports_positions
    ? supabase.from("game_position_requirements").select("position_id,required_count").eq("game_id",id)
    : Promise.resolve({data:[]});

  const [{data:applications},{data:waiting},{data:participants},teamsRes,positionsRes,requirementsRes]=await Promise.all([
    supabase.from("game_applications")
      .select("id,user_id,status,requested_position_id,created_at,profile:profiles!game_applications_user_id_fkey(display_name),requested_position:positions!game_applications_requested_position_id_fkey(id,name_lv,name_en)")
      .eq("game_id",id).eq("status","pending").order("created_at"),
    supabase.from("game_waiting_list")
      .select("id,user_id,status,created_at,profile:profiles!game_waiting_list_user_id_fkey(display_name)")
      .eq("game_id",id).eq("status","active").order("created_at"),
    supabase.from("game_participants")
      .select("id,user_id,status,position_id,team_id,profile:profiles!game_participants_user_id_fkey(display_name),position:positions!game_participants_position_id_fkey(id,name_lv,name_en)")
      .eq("game_id",id).eq("status","accepted"),
    teamsPromise,
    positionsPromise,
    requirementsPromise
  ] as any);

  const teams:any[]=teamsRes.data??[];
  const positions:any[]=positionsRes.data??[];
  const requirements:any[]=requirementsRes.data??[];
  const requirementMap=new Map(requirements.map((r:any)=>[r.position_id,Number(r.required_count)]));
  const acceptedByPosition=new Map<string,number>();
  for(const p of participants??[]){if(p.position_id) acceptedByPosition.set(p.position_id,(acceptedByPosition.get(p.position_id)??0)+1);}
  const remaining=Math.max(0,game.additional_players_required-(participants?.length??0));

  return <div className="page">
    <Link className="back" href={`/games/${id}`}>← {lv?"Spēles detaļas":"Game details"}</Link>
    <p className="eyebrow">{lv?"Organizators":"Organizer"}</p>
    <h1>{lv?"Pārvaldīt":"Manage"} {lv?(activity?.name_lv??"spēli"):(activity?.name_en??"game")}</h1>
    {error&&<p className="notice error">{error}</p>}
    {game.cancelled_at&&<p className="notice error">{lv?"Spēle ir atcelta.":"Game is cancelled."}</p>}
    {!game.cancelled_at&&<div className="hero-actions"><Link className="button ghost" href={`/games/${id}/edit`}>{lv?"Rediģēt spēli":"Edit game"}</Link></div>}

    {game.visibility==="private"&&<section className="panel">
      <h2>{lv?"Privātā ielūguma saite":"Private invite link"}</h2>
      {invite&&<div className="status-box success"><strong>{lv?"Ielūgums izveidots":"Invite created"}</strong><code className="invite-code">{`/invite/${invite}`}</code></div>}
      <form action={createPrivateInvite} className="inline-form"><input type="hidden" name="game_id" value={id}/><select name="valid_hours" defaultValue="168"><option value="24">24 h</option><option value="168">7 d</option><option value="720">30 d</option></select><button className="button primary" type="submit">{lv?"Ģenerēt":"Generate"}</button></form>
    </section>}

    <section className="panel"><h2>{lv?"Vietas":"Capacity"}</h2><p>{participants?.length??0} {lv?"apstiprināti":"confirmed"} · <strong>{remaining} {lv?"vēl vajag":"still needed"}</strong></p></section>

    {activity?.supports_positions&&<section className="panel">
      <h2>{lv?"Kuras pozīcijas vajag?":"Which positions are needed?"}</h2>
      <p className="hint">{lv?"0 nozīmē — šai pozīcijai nav konkrētas prasības.":"0 means no specific requirement for that position."}</p>
      <div className="stack">{positions.map((pos:any)=>{
        const required=Number(requirementMap.get(pos.id)??0);
        const accepted=Number(acceptedByPosition.get(pos.id)??0);
        return <form action={setPositionRequirement} className="position-row" key={pos.id}>
          <input type="hidden" name="game_id" value={id}/><input type="hidden" name="position_id" value={pos.id}/>
          <div><strong>{lv?pos.name_lv:pos.name_en}</strong><p className="hint">{accepted} {lv?"apstiprināti":"accepted"}{required>0?` / ${required}`:""}</p></div>
          <input name="required_count" type="number" min="0" max="99" defaultValue={required}/>
          <button className="button ghost" type="submit">{lv?"Saglabāt":"Save"}</button>
        </form>;
      })}</div>
    </section>}

    <section className="panel"><h2>{lv?"Pieteikumi":"Pending applications"}</h2><div className="stack">
      {applications?.map((a:any)=>{
        const profile:any=first(a.profile); const requested:any=first(a.requested_position);
        return <article className="applicant" key={a.id}>
          <div><Link href={`/users/${a.user_id}`}><strong>{profile?.display_name??"Player"}</strong></Link>{requested&&<p className="hint">{lv?"Vēlas":"Prefers"}: {lv?requested.name_lv:requested.name_en}</p>}</div>
          <div className="application-actions">
            <form action={acceptApplication} className="inline-form">
              <input type="hidden" name="game_id" value={id}/><input type="hidden" name="application_id" value={a.id}/>
              {activity?.supports_teams&&<select name="team_id" defaultValue=""><option value="">{lv?"Bez komandas":"No team"}</option>{teams.map((team:any)=><option key={team.id} value={team.id}>{team.name}</option>)}</select>}{activity?.supports_positions&&<select name="position_id" defaultValue={a.requested_position_id??""}><option value="">{lv?"Bez pozīcijas":"No position"}</option>{positions.map((p:any)=><option key={p.id} value={p.id}>{lv?p.name_lv:p.name_en}</option>)}</select>}
              <button className="button primary" disabled={remaining<=0}>{lv?"Apstiprināt":"Accept"}</button>
            </form>
            <form action={declineApplication}><input type="hidden" name="game_id" value={id}/><input type="hidden" name="application_id" value={a.id}/><button className="button ghost">{lv?"Noraidīt":"Decline"}</button></form>
          </div>
        </article>;
      })}
      {!applications?.length&&<p>{lv?"Nav pieteikumu.":"No pending applications."}</p>}
    </div></section>

    <section className="panel"><h2>{lv?"Gaidīšanas saraksts":"Waiting list"}</h2><div className="stack">
      {waiting?.map((w:any,index:number)=>{const profile:any=first(w.profile);return <article className="applicant" key={w.id}><div><Link href={`/users/${w.user_id}`}><strong>#{index+1} · {profile?.display_name??"Player"}</strong></Link></div><form action={promoteWaitingUser} className="application-actions"><input type="hidden" name="game_id" value={id}/><input type="hidden" name="waiting_id" value={w.id}/>{activity?.supports_teams&&<select name="team_id" defaultValue=""><option value="">{lv?"Bez komandas":"No team"}</option>{teams.map((team:any)=><option key={team.id} value={team.id}>{team.name}</option>)}</select>}{activity?.supports_positions&&<select name="position_id" defaultValue=""><option value="">{lv?"Bez pozīcijas":"No position"}</option>{positions.map((pos:any)=><option key={pos.id} value={pos.id}>{lv?pos.name_lv:pos.name_en}</option>)}</select>}<button className="button primary" disabled={remaining<=0}>{lv?"Pievienot spēlei":"Accept into game"}</button></form></article>})}
      {!waiting?.length&&<p>{lv?"Neviens negaida.":"No one is waiting."}</p>}
    </div></section>

    <section className="panel"><h2>{lv?"Spēles atcelšana":"Cancel game"}</h2>
      <details>
        <summary>{lv?"Atcelt šo spēli":"Cancel this game"}</summary>
        <form action={cancelGame} className="wizard">
          <input type="hidden" name="game_id" value={id}/>
          <label>{lv?"Iemesls (neobligāts)":"Reason (optional)"}<textarea name="reason" rows={3} maxLength={1000}/></label>
          <button className="button danger wide" type="submit" disabled={Boolean(game.cancelled_at)}>{lv?"Atcelt spēli":"Cancel game"}</button>
        </form>
      </details>
    </section>

    <section className="panel"><h2>{lv?"Apstiprinātie":"Confirmed"}</h2><div className="stack">
      {participants?.map((p:any)=>{const profile:any=first(p.profile);const pos:any=first(p.position);return <div className="participant-manage" key={p.id}><div><Link href={`/users/${p.user_id}`}><strong>{profile?.display_name??"Player"}</strong></Link><span className="hint">{pos?(lv?pos.name_lv:pos.name_en):""}</span></div><form action={updateParticipantAssignment} className="inline-form"><input type="hidden" name="game_id" value={id}/><input type="hidden" name="user_id" value={p.user_id}/>{activity?.supports_teams&&<select name="team_id" defaultValue={p.team_id??""}><option value="">{lv?"Bez komandas":"No team"}</option>{teams.map((team:any)=><option key={team.id} value={team.id}>{team.name}</option>)}</select>}{activity?.supports_positions&&<select name="position_id" defaultValue={p.position_id??""}><option value="">{lv?"Bez pozīcijas":"No position"}</option>{positions.map((position:any)=><option key={position.id} value={position.id}>{lv?position.name_lv:position.name_en}</option>)}</select>}<button className="button ghost" type="submit">{lv?"Saglabāt":"Save"}</button></form><form action={removeParticipant}><input type="hidden" name="game_id" value={id}/><input type="hidden" name="user_id" value={p.user_id}/><button className="button danger" type="submit">{lv?"Noņemt":"Remove"}</button></form></div>})}
      {!participants?.length&&<p>{lv?"Vēl nav apstiprinātu spēlētāju.":"No confirmed players yet."}</p>}
    </div></section>
  </div>;
}
