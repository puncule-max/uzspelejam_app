import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id",user.id).single();
  return <div className="page"><p className="eyebrow">Profile</p><section className="profile-card"><div className="avatar-large">{profile?.display_name?.slice(0,1).toUpperCase() ?? "?"}</div><div><h1>{profile?.display_name ?? "Player"}</h1><p>{profile?.city || "Latvia"} · {profile?.visibility || "private"} profile</p></div></section><section className="panel"><h2>Account</h2><p>{user.email}</p><p>Language: {profile?.language === "en" ? "English" : "Latviešu"}</p><p className="hint">Profile editing, activities and ratings are the next module.</p></section><section className="panel"><h2>Actions</h2><div className="stack"><Link className="button ghost" href="/my-games">My Games</Link><Link className="button primary" href="/create">Create game</Link><form action={signOut}><button className="button danger wide">Sign out</button></form></div></section></div>;
}
