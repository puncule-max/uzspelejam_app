import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "@/app/message-actions";

export default async function ConversationPage({ params, searchParams }: { params: Promise<{id:string}>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/messages/${id}`);

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("conversation_id,left_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase.from("conversations").select("id,type,game_id,game:games(id,activity:activities(name_en))").eq("id",id).single(),
    supabase.from("messages").select("id,body,created_at,sender_id,sender:profiles!messages_sender_id_fkey(display_name)").eq("conversation_id",id).order("created_at",{ascending:true}).limit(200)
  ]);

  if (!conversation) notFound();
  const active = membership.left_at == null;

  return <div className="page chat-page">
    <Link className="back" href="/messages">← Messages</Link>
    <p className="eyebrow">{conversation.type === "group" ? "Group chat" : "Organizer chat"}</p>
    <h1>{conversation.game?.activity?.name_en ?? "Game"}</h1>
    {error && <p className="notice error">{error}</p>}
    <section className="chat-thread">
      {messages?.map((m:any) => <article className={`message ${m.sender_id === user.id ? "mine" : ""}`} key={m.id}>
        <strong>{m.sender?.display_name ?? "Player"}</strong>
        <p>{m.body}</p>
        <span>{new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Riga",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"short"}).format(new Date(m.created_at))}</span>
      </article>)}
      {!messages?.length && <p className="hint">No messages yet.</p>}
    </section>
    {active ? <form action={sendMessage} className="message-composer">
      <input type="hidden" name="conversation_id" value={id}/>
      <textarea name="body" rows={2} maxLength={4000} placeholder="Write a game-related message…" required />
      <button className="button primary" type="submit">Send</button>
    </form> : <p className="notice">This conversation is closed.</p>}
  </div>;
}
