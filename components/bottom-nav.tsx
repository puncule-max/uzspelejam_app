import Link from "next/link";

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <Link href="/">Explore</Link>
      <Link className="nav-create" href="/create">Create</Link>
      <Link href="/my-games">My Games</Link>
      <Link href="/profile">Profile</Link>
    </nav>
  );
}
