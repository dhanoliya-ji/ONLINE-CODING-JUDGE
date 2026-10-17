import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { DIFFICULTY_TEXT } from "../lib/format";
import { useTheme } from "../lib/theme";
import type { ProblemSummary } from "../lib/types";

/**
 * Ctrl/⌘ K: jump to any problem by name or statement text, or run a command.
 * Problem search hits the API (debounced), so it covers the whole library.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProblemSummary[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .problems({ search: text, limit: 8 })
        .then((page) => !cancelled && setResults(page.items))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  function go(path: string) {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  }

  async function random() {
    onOpenChange(false);
    try {
      const pick = await api.randomProblem({});
      navigate(`/problems/${pick.slug}`);
    } catch {
      navigate("/problems");
    }
  }

  async function daily() {
    onOpenChange(false);
    try {
      const pick = await api.dailyProblem();
      navigate(`/problems/${pick.slug}`);
    } catch {
      navigate("/problems");
    }
  }

  const item = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search problems and commands"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
      contentClassName="panel fixed top-[12vh] left-1/2 z-[61] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <span className="text-ink-3" aria-hidden="true">⌕</span>
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search problems by title or statement, or type a command…"
          className="h-13 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-ink-3">
          {searching ? "Searching…" : query.trim().length < 2 ? "Type to search the problem library." : "No problems match."}
        </Command.Empty>

        {results.length > 0 && (
          <Command.Group heading="Problems" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase">
            {results.map((problem) => (
              <Command.Item key={problem.id} value={`problem-${problem.id}`} onSelect={() => go(`/problems/${problem.slug}`)} className={item}>
                <span className={`font-mono text-xs ${DIFFICULTY_TEXT[problem.difficulty]}`}>{problem.difficulty}</span>
                <span className="flex-1 truncate text-ink">{problem.title}</span>
                {problem.solved_by_me && <span className="text-pass" aria-label="Solved">✓</span>}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase">
          <Command.Item value="daily" onSelect={daily} className={item}>☀ Today's problem</Command.Item>
          <Command.Item value="random" onSelect={random} className={item}>⚄ Random unsolved problem</Command.Item>
          <Command.Item value="problems" onSelect={() => go("/problems")} className={item}>☰ All problems</Command.Item>
          <Command.Item value="contests" onSelect={() => go("/contests")} className={item}>★ Contests</Command.Item>
          <Command.Item value="leaderboard" onSelect={() => go("/leaderboard")} className={item}>▲ Leaderboard</Command.Item>
          {user && <Command.Item value="profile" onSelect={() => go("/dashboard")} className={item}>▦ My profile & progress</Command.Item>}
          {user && <Command.Item value="submissions" onSelect={() => go("/submissions")} className={item}>≡ My submissions</Command.Item>}
          {user && <Command.Item value="lists" onSelect={() => go("/lists")} className={item}>☆ My lists & bookmarks</Command.Item>}
          <Command.Item value="theme" onSelect={() => { toggle(); onOpenChange(false); }} className={item}>◐ Toggle light / dark theme</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
