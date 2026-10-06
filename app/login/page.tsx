import Link from "next/link";
import { signIn } from "@/app/auth-actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const message = typeof params.message === "string" ? params.message : null;
  const next = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/";
  return <div className="page narrow"><p className="eyebrow">Wanna play, my friend?</p><h1>Sign in</h1><p className="lead">Join the game that is missing you.</p>{message && <p className="notice success">{message}</p>}{error && <p className="notice error">{error}</p>}<form action={signIn} className="wizard"><input type="hidden" name="next" value={next} /><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required minLength={6} /></label><button className="button primary wide" type="submit">Sign in</button></form><p className="hint">No account? <Link href="/signup">Create one</Link></p></div>;
}
