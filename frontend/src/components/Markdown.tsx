import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * A deliberately tiny Markdown subset for problem statements and coach
 * replies.
 *
 * Text is rendered into React elements rather than injected with
 * `dangerouslySetInnerHTML`, so a statement can never introduce script or
 * markup into the page. The one exception is maths: each `$…$` / `$$…$$`
 * segment (and only that segment) is handed to KaTeX with `trust: false`,
 * which refuses \href, \url, \html* and friends, so its HTML output is
 * markup KaTeX generated itself.
 *
 * Supported: fenced code blocks, `**bold**`, `*italic*`, `` `code` ``,
 * `- ` and `1. ` lists, `#` headings, blank-line paragraphs, `$inline$`,
 * `$$display$$` (and Codeforces' `$$$inline$$$`). Everything else renders as
 * literal text.
 */
export function Markdown({ text }: { text: string }) {
  const segments = useMemo(() => splitFences(text.replace(/\r\n/g, "\n")), [text]);

  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "code" ? (
          <pre
            key={index}
            className="my-3 overflow-x-auto rounded-xl border border-line bg-bg-raised p-3.5 font-mono text-[12.5px] leading-relaxed text-ink"
          >
            <code data-language={segment.language || undefined}>{segment.body}</code>
          </pre>
        ) : (
          <Blocks key={index} text={segment.body} first={index === 0} />
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------ fences */

type Segment = { kind: "text" | "code"; body: string; language?: string };

const FENCE = /^```[ \t]*([\w+#.-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;

function splitFences(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    const before = text.slice(last, match.index).trim();
    if (before) out.push({ kind: "text", body: before });
    out.push({ kind: "code", body: match[2].replace(/\n$/, ""), language: match[1] });
    last = match.index + match[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) out.push({ kind: "text", body: rest });
  return out;
}

/* ------------------------------------------------------------ blocks */

function Blocks({ text, first }: { text: string; first: boolean }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, index) => {
        const gap = first && index === 0 ? undefined : "mt-3";
        const lines = block.split("\n");
        const isList = lines.every((line) => /^\s*[-*]\s+/.test(line));
        const isOrdered = lines.every((line) => /^\s*\d+[.)]\s+/.test(line));
        const trimmed = block.trim();

        // A paragraph that is nothing but display maths gets a block of its own.
        if (/^\$\$[^$][\s\S]*\$\$$/.test(trimmed) && !trimmed.slice(2, -2).includes("$$")) {
          return (
            <div key={index} className={gap}>
              <MathTex tex={trimmed.slice(2, -2)} display />
            </div>
          );
        }

        if (lines.length === 1 && /^#{1,6}\s+/.test(block)) {
          return (
            <p key={index} className={`font-semibold text-ink ${first && index === 0 ? "" : "mt-4"}`}>
              <Inline text={block.replace(/^#{1,6}\s+/, "")} />
            </p>
          );
        }

        if (isOrdered) {
          return (
            <ol key={index} className={`ml-5 list-decimal space-y-1 marker:text-ink-3 ${gap ?? ""}`}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  <Inline text={line.replace(/^\s*\d+[.)]\s+/, "")} />
                </li>
              ))}
            </ol>
          );
        }

        if (isList) {
          return (
            <ul key={index} className={`ml-4 list-disc space-y-1 marker:text-ink-3 ${gap ?? ""}`}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  <Inline text={line.replace(/^\s*[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className={gap}>
            <Inline text={block} breaks />
          </p>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------ inline */

// One capture group around the alternation, so `split` puts every token at an
// odd index. Order matters: code spans first (a `$` inside backticks is
// literal), then the longest maths delimiters, then `**bold**` before the
// single-asterisk italic rule can claim its delimiters. Inline maths must not
// start or end with whitespace, which keeps "costs $5 and $10" as prose.
const INLINE =
  /(`[^`\n]+`|\$\$\$[^$]+?\$\$\$|\$\$[^$]+?\$\$|\$(?=\S)[^$]*?[^\s$\\]\$|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;

function Inline({ text, breaks = false }: { text: string; breaks?: boolean }) {
  const parts = text.split(INLINE);

  return (
    <>
      {parts.map((part, index): ReactNode => {
        if (!part) return null;
        if (index % 2 === 0) return <Prose key={index} text={part} breaks={breaks} />;

        if (part.startsWith("`")) {
          return (
            <code
              key={index}
              className="rounded-md border border-line bg-surface-2 px-1.5 py-px font-mono text-[0.88em] text-ember-2"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("$$$")) return <MathTex key={index} tex={part.slice(3, -3)} />;
        if (part.startsWith("$$")) return <MathTex key={index} tex={part.slice(2, -2)} display />;
        if (part.startsWith("$")) return <MathTex key={index} tex={part.slice(1, -1)} />;
        if (part.startsWith("**")) {
          return (
            <strong key={index} className="font-semibold text-ink">
              <Inline text={part.slice(2, -2)} breaks={breaks} />
            </strong>
          );
        }
        return (
          <em key={index} className="italic">
            <Inline text={part.slice(1, -1)} breaks={breaks} />
          </em>
        );
      })}
    </>
  );
}

/**
 * Plain text, with line breaks kept and a few bare TeX commands that some
 * imported statements leave outside `$…$` (AtCoder constraints write
 * `1 \leq N`) turned into the symbols they stand for.
 */
function Prose({ text, breaks }: { text: string; breaks: boolean }) {
  const tidy = text.replace(BARE_TEX, (match, name: string | undefined) =>
    name ? (TEX_SYMBOLS[name] ?? match) : " ",
  );
  if (!breaks || !tidy.includes("\n")) return <>{tidy}</>;
  return (
    <>
      {tidy.split("\n").map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}

const TEX_SYMBOLS: Record<string, string> = {
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ne: "≠",
  neq: "≠",
  times: "×",
  cdot: "·",
  dots: "…",
  ldots: "…",
  cdots: "⋯",
  infty: "∞",
  pm: "±",
  lt: "<",
  gt: ">",
};

const BARE_TEX = /\\(le|leq|ge|geq|ne|neq|times|cdot|dots|ldots|cdots|infty|pm|lt|gt)(?![a-zA-Z])|\\[ ,;]/g;

/* -------------------------------------------------------------- maths */

type Katex = typeof import("katex").default;

// One shared load for the whole page; later renders find it ready.
let katexReady: Katex | null = null;
let katexLoading: Promise<Katex> | null = null;

function loadKatex(): Promise<Katex> {
  katexLoading ??= import("./solve/katex").then((module) => {
    katexReady = module.default;
    return module.default;
  });
  return katexLoading;
}

function MathTex({ tex, display = false }: { tex: string; display?: boolean }) {
  const [katex, setKatex] = useState<Katex | null>(katexReady);

  useEffect(() => {
    if (katex) return;
    let live = true;
    loadKatex()
      .then((loaded) => live && setKatex(() => loaded))
      .catch(() => {
        // Offline or a failed chunk: the TeX source stays readable as is.
      });
    return () => {
      live = false;
    };
  }, [katex]);

  const html = useMemo(() => {
    if (!katex) return null;
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        trust: false,
        strict: "ignore",
        maxExpand: 200,
      });
    } catch {
      return null;
    }
  }, [katex, tex, display]);

  if (html === null) {
    return <span className="font-mono text-[0.92em] text-ink-2">{tex}</span>;
  }

  return display ? (
    <span className="block" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}
