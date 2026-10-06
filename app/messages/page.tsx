import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime } from "@/lib/format";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id,left_at,conversation:conversations(id,type,applicant_user_id,game:games(id,starts_at,activity:activities(name_en)))")
    .eq("user_id", user.id)
    .is("left_at", null);

  return <div className="page">
    <p className="eyebrow">Messages</p>
    <h1>Game conversations</h1>
    <p className="lead">Only conversations tied to a game appear here.</p>
    <section className="panel">
      <div className="stack">
        {memberships?.map((m:any) => {
          const c = m.conversation;
          if (!c) return null;
          const title = c.type === "group" ? "Game group chat" : "Organizer conversation";
          return <Link className="list-row" href={`/messages/${c.id}`} key={c.id}>
            <div><strong>{c.game?.activity?.name_en ?? "Game"}</strong><div className="hint">{title}</div></div>
            <span>{c.game?.starts_at ? formatGameDateTime(c.game.starts_at) : ""}</span>
          </Link>;
        })}
        {!memberships?.length && <p className="hint">No active game conversations yet.</p>}
      </div>
    </section>
  </div>;
}
