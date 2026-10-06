import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatGameDateTime } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n";

function first<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }

export default async function MessagesPage() {
  const locale = await getLocale(); const t = getDictionary(locale);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id,left_at,conversation:conversations(id,type,applicant_user_id,game:games(id,starts_at,activity:activities(name_lv,name_en)))")
    .eq("user_id", user.id)
    .is("left_at", null);

  return <div className="page">
    <p className="eyebrow">{t.messages}</p><h1>{t.gameConversations}</h1><p className="lead">{t.gameConversationsLead}</p>
    <section className="panel"><div className="stack">
      {memberships?.map((m:any) => { const c=first(m.conversation); const game=first(c?.game); const a=first(game?.activity); if(!c)return null; return <Link className="list-row" href={`/messages/${c.id}`} key={c.id}><div><strong>{locale==="lv"?a?.name_lv:a?.name_en}</strong><div className="hint">{c.type === "group" ? (locale==="lv"?"Spēles grupas čats":"Game group chat") : t.messageOrganizer}</div></div><span>{game?.starts_at ? formatGameDateTime(game.starts_at,locale) : ""}</span></Link>; })}
      {!memberships?.length && <p className="hint">{t.noConversations}</p>}
    </div></section>
  </div>;
}
