import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { CommandPalette } from "./CommandPalette";
import { ForgeBackdrop, Kbd, Logo, Spinner } from "./ui";

const NAV = [
  { to: "/problems", label: "Problems" },
  { to: "/contests", label: "Contests" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/submissions", label: "Submissions", private: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Ctrl/⌘ K opens the command palette from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const links = NAV.filter((item) => !item.private || user);
  // The Solve page is a full-height workspace: no footer under it.
  const workspace = /^\/problems\/[^/]+$/.test(location.pathname);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <ForgeBackdrop />
      <ColdStartNotice />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <header className="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl">
        <nav className="mx-auto flex h-15 max-w-[1440px] items-center gap-5 px-4 sm:px-6" aria-label="Main">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Crucible home">
            <Logo />
            <span className="hidden font-display text-[17px] font-bold tracking-wide text-ink sm:block">Crucible</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="btn-ghost hidden h-9 items-center gap-3 rounded-lg px-3 text-sm text-ink-3 sm:flex"
              aria-label="Search and commands"
            >
              <span aria-hidden="true">⌕</span>
              <span className="hidden lg:inline">Search problems…</span>
              <Kbd>Ctrl K</Kbd>
            </button>
            <ThemeToggle />

            {user ? (
              <AccountMenu
                username={user.username}
                isAdmin={user.is_admin}
                onSignOut={() => {
                  logout();
                  navigate("/");
                }}
              />
            ) : (
              <>
                <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:text-ink sm:block">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary rounded-lg px-3.5 py-2 text-sm font-semibold">
                  Start solving
                </Link>
              </>
            )}

            <button
              onClick={() => setMenuOpen((open) => !open)}
              className="btn-ghost grid size-9 place-items-center rounded-lg md:hidden"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="border-t border-line px-4 py-3 md:hidden">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  ["block rounded-lg px-3 py-2.5 text-sm font-medium", isActive ? "bg-surface-2 text-ink" : "text-ink-2"].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button onClick={() => setPaletteOpen(true)} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink-2">
              Search…
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {!workspace && (
        <footer className="border-t border-line py-8">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 text-sm text-ink-3 sm:flex-row sm:px-6">
            <p>
              Crucible, an open-source online judge by{" "}
              <a href="https://github.com/dhanoliya-ji" target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ember">
                Gajendra Dhanoliya
              </a>
              . Imported problems credit their source on every page.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/dhanoliya-ji/ONLINE-CODING-JUDGE" target="_blank" rel="noreferrer" className="hover:text-ink">
                Source
              </a>
              <a href={`${import.meta.env.VITE_API_BASE_URL ?? ""}/docs`} target="_blank" rel="noreferrer" className="hover:text-ink">
                API docs
              </a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="btn-ghost grid size-9 place-items-center rounded-lg text-ink-2"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}

function AccountMenu({ username, isAdmin, onSignOut }: { username: string; isAdmin: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-2"
      >
        <span
          className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-ember to-frost text-sm font-bold text-ember-ink"
          aria-hidden="true"
        >
          {username.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-sm font-medium text-ink lg:block">{username}</span>
      </button>
      {open && (
        <div role="menu" className="panel absolute right-0 mt-2 w-52 overflow-hidden p-1.5 shadow-2xl">
          <p className="px-3 py-2 text-xs text-ink-3">
            Signed in as <span className="font-semibold text-ink">{username}</span>
            {isAdmin && <span className="ml-1 text-ember">· admin</span>}
          </p>
          {[
            { to: "/dashboard", label: "Profile & progress" },
            { to: "/submissions", label: "My submissions" },
          ].map((item) => (
            <Link key={item.to} to={item.to} role="menuitem" className="block rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              {item.label}
            </Link>
          ))}
          <button role="menuitem" onClick={onSignOut} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The API sleeps on Render's free tier and takes ~50s to wake. Rather than
 * letting the first page look broken, probe on boot and explain the wait.
 */
function ColdStartNotice() {
  const [state, setState] = useState<"checking" | "cold" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;
    // Only surface the banner if the wake-up is actually slow.
    const slowTimer = setTimeout(() => {
      if (!cancelled) setState((s) => (s === "checking" ? "cold" : s));
    }, 1800);

    api
      .ping()
      .then(() => !cancelled && setState("ready"))
      .catch(() => !cancelled && setState("ready"))
      .finally(() => clearTimeout(slowTimer));

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, []);

  if (state !== "cold") return null;

  return (
    <div className="sticky top-0 z-50 border-b border-warn/30 bg-warn/12 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 text-sm text-ink sm:px-6">
        <Spinner size={15} />
        <p>
          <span className="font-semibold">Waking the judge…</span>{" "}
          <span className="text-ink-2">The API sleeps on free hosting and takes up to a minute to start. This happens once.</span>
        </p>
      </div>
    </div>
  );
}
