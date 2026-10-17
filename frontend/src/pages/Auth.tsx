import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Alert, Button, Logo } from "../components/ui";

type Mode = "login" | "register";

const PERKS = [
  { mark: "▦", text: "A progress profile with a heatmap and streaks" },
  { mark: "?", text: "AI hints that nudge instead of spoiling" },
  { mark: "★", text: "Timed contests and a global leaderboard" },
];

export function AuthPage({ mode }: { mode: Mode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);

    try {
      if (isRegister) {
        await register(username.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      navigate(location.state?.from ?? "/problems", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.length) {
        // Surface validation errors next to the field that caused them.
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((e) => [e.field, e.message])));
        setError("Please correct the highlighted fields.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail("demo@example.com");
    setPassword("DemoPass123");
  }

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-3.75rem)] max-w-[1120px] items-center gap-12 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_440px]">
      {/* Brand side: context for why to sign in. Hidden on small screens, where the form comes first. */}
      <aside className="animate-rise relative hidden lg:block">
        <div
          className="pointer-events-none absolute -top-24 -left-24 size-[420px] rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)]"
          aria-hidden="true"
        />
        <p className="relative font-mono text-[13px] tracking-[0.08em] text-ember [[data-theme=light]_&]:text-ember-2">
          {isRegister ? "JOIN CRUCIBLE" : "WELCOME BACK"}
        </p>
        <h2 className="relative mt-4 max-w-[30rem] font-display text-[clamp(2rem,3.6vw,3.25rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-ink">
          Forge your skills under{" "}
          <span className="bg-gradient-to-br from-ember-2 to-ember bg-clip-text text-transparent">real</span> judging.
        </h2>
        <ul className="relative mt-8 space-y-3">
          {PERKS.map((perk) => (
            <li key={perk.text} className="flex items-center gap-3 text-[15px] text-ink-2">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-ember/12 font-mono text-ember"
                aria-hidden="true"
              >
                {perk.mark}
              </span>
              {perk.text}
            </li>
          ))}
        </ul>
        <div className="relative mt-10 inline-flex items-center gap-3 rounded-2xl border border-pass/40 bg-surface/80 px-4 py-3 font-mono text-[13px] text-ink-2">
          <span className="grid size-7 place-items-center rounded-full bg-pass/15 text-pass" aria-hidden="true">
            ✓
          </span>
          <span>
            <span className="font-semibold tracking-wide text-pass">ACCEPTED</span> · 12 / 12 tests · 42 ms
          </span>
        </div>
      </aside>

      <div className="panel animate-rise w-full max-w-[440px] justify-self-center rounded-[22px] p-6 shadow-[0_40px_80px_-40px_var(--glow)] sm:p-8">
        <div className="mb-7">
          <Logo size={34} />
          <h1 className="mt-5 font-display text-[26px] font-bold tracking-tight text-ink">
            {isRegister ? "Create your account" : "Sign in"}
          </h1>
          <p className="mt-1.5 text-sm text-ink-2">
            {isRegister ? "Start solving problems in seconds. It's free." : "Sign in to submit and track your progress."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div aria-live="polite">{error && <Alert>{error}</Alert>}</div>

          {isRegister && (
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="ada_lovelace"
              autoComplete="username"
              error={fieldErrors.username}
              hint="Letters, digits, underscore, dot and hyphen."
            />
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            error={fieldErrors.email}
          />

          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={isRegister ? "new-password" : "current-password"}
            error={fieldErrors.password}
            hint={isRegister ? "At least 8 characters, mixing letters with digits or symbols." : undefined}
          />

          <Button type="submit" loading={busy} className="min-h-11 w-full text-[15px]">
            {isRegister ? "Create account" : "Sign in"}
          </Button>
        </form>

        {!isRegister && (
          <button
            onClick={fillDemo}
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-2.5 text-[13px] text-ink-2 transition-colors hover:border-ember/50 hover:text-ink"
          >
            <span aria-hidden="true">⚡</span> Use the demo account
          </button>
        )}

        <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-2">
          {isRegister ? "Already have an account?" : "No account yet?"}{" "}
          <Link
            to={isRegister ? "/login" : "/register"}
            state={location.state}
            className="font-semibold text-ember hover:text-ember-2 [[data-theme=light]_&]:text-ember-2"
          >
            {isRegister ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
}) {
  const id = `field-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="field min-h-11"
        // .field sets its border outside Tailwind's layers, so a utility cannot override it.
        style={error ? { borderColor: "color-mix(in srgb, var(--fail) 65%, transparent)" } : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-fail">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
