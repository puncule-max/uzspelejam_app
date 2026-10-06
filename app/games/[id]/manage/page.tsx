import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptApplication, declineApplication, promoteWaitingUser } from "@/app/game-actions";

export default async function ManageGame({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/${id}/manage`);
  const { data: game } = await supabase.from("games").select("id,creator_id,additional_players_required,activity:activities(name_en)").eq("id",id).single();
  if (!game) notFound(); if (game.creator_id !== user.id) redirect(`/games/${id}`);
  const [{ data: applications }, { data: waiting }, { data: participants }] = await Promise.all([
    supabase.from("game_applications").select("id,user_id,status,requested_position_id,created_at,profile:profiles!game_applications_user_id_fkey(display_name,city)").eq("game_id",id).eq("status","pending").order("created_at"),
    supabase.from("game_waiting_list").select("id,user_id,status,created_at,profile:profiles!game_waiting_list_user_id_fkey(display_name,city)").eq("game_id",id).eq("status","active").order("created_at"),
    supabase.from("game_participants").select("id,user_id,status,profile:profiles!game_participants_user_id_fkey(display_name,city)").eq("game_id",id).eq("status","accepted")
  ]);
  const remaining = Math.max(0, game.additional_players_required - (participants?.length ?? 0));
  return <div className="page">
    <Link className="back" href={`/games/${id}`}>← Game details</Link>
    <p className="eyebrow">Organizer</p><h1>Manage {game.activity?.name_en ?? "game"}</h1>
    {error && <p className="notice error">{error}</p>}
    <section className="panel"><h2>Capacity</h2><p>{participants?.length ?? 0} confirmed · <strong>{remaining} still needed</strong></p></section>
    <section className="panel"><h2>Pending applications</h2>
      <div className="stack">{applications?.map((a:any)=><article className="applicant" key={a.id}><div><strong>{a.profile?.display_name ?? "Player"}</strong><p>{a.profile?.city || ""}</p></div><div className="inline-actions"><form action={acceptApplication}><input type="hidden" name="game_id" value={id}/><input type="hidden" name="application_id" value={a.id}/><button className="button primary" disabled={remaining <= 0}>Accept</button></form><form action={declineApplication}><input type="hidden" name="game_id" value={id}/><input type="hidden" name="application_id" value={a.id}/><button className="button ghost">Decline</button></form></div></article>)}{!applications?.length && <p>No pending applications.</p>}</div>
    </section>
    <section className="panel"><h2>Waiting list</h2>
      <div className="stack">{waiting?.map((w:any,index:number)=><article className="applicant" key={w.id}><div><strong>#{index+1} · {w.profile?.display_name ?? "Player"}</strong><p>{w.profile?.city || ""}</p></div><form action={promoteWaitingUser}><input type="hidden" name="game_id" value={id}/><input type="hidden" name="waiting_id" value={w.id}/><button className="button primary" disabled={remaining <= 0}>Accept into game</button></form></article>)}{!waiting?.length && <p>No one is waiting.</p>}</div>
    </section>
    <section className="panel"><h2>Confirmed</h2><div className="stack">{participants?.map((p:any)=><div key={p.id}><strong>{p.profile?.display_name ?? "Player"}</strong></div>)}{!participants?.length && <p>No confirmed players yet.</p>}</div></section>
  </div>;
}
