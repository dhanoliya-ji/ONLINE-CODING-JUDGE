import { EditorView } from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * The editor's "forge" theme, built from the app's CSS variables so it
 * follows the palette instead of carrying a second, hard-coded one.
 *
 * The variables already switch with html[data-theme]; the only things that
 * differ between the two variants are the editor background and a darkening
 * of the syntax colours on light paper, where the raw accent tokens fall
 * just short of 4.5:1 against white.
 */
function forge(dark: boolean) {
  // On light paper, mix each accent a fifth of the way towards black.
  const ink = (variable: string) =>
    dark ? `var(${variable})` : `color-mix(in srgb, var(${variable}) 78%, black)`;

  const chrome = EditorView.theme(
    {
      "&": {
        color: "var(--ink)",
        backgroundColor: dark ? "var(--bg-raised)" : "var(--surface)",
        height: "100%",
      },
      ".cm-content": { caretColor: "var(--ember)", paddingBlock: "10px" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ember)", borderLeftWidth: "2px" },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        { backgroundColor: "color-mix(in srgb, var(--ember) 24%, transparent)" },
      ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--ink) 4%, transparent)" },
      ".cm-gutters": {
        backgroundColor: dark ? "var(--bg-raised)" : "var(--surface)",
        color: "var(--ink-3)",
        border: "none",
        borderRight: "1px solid var(--line)",
      },
      ".cm-lineNumbers .cm-gutterElement": { paddingInline: "14px 10px", minWidth: "44px" },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ember)" },
      "&.cm-focused .cm-matchingBracket": {
        backgroundColor: "color-mix(in srgb, var(--ember) 18%, transparent)",
        outline: "1px solid color-mix(in srgb, var(--ember) 55%, transparent)",
      },
      ".cm-nonmatchingBracket": { color: "var(--fail)" },
      ".cm-tooltip": {
        backgroundColor: "var(--surface-2)",
        color: "var(--ink)",
        border: "1px solid var(--line-strong)",
        borderRadius: "10px",
        overflow: "hidden",
      },
      ".cm-tooltip-autocomplete > ul > li": { padding: "3px 10px" },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "color-mix(in srgb, var(--ember) 20%, var(--surface-2))",
        color: "var(--ink)",
      },
      ".cm-completionDetail": { color: "var(--ink-3)" },
      ".cm-panels": { backgroundColor: "var(--surface-2)", color: "var(--ink)" },
      ".cm-placeholder": { color: "var(--ink-3)" },
    },
    { dark },
  );

  const highlight = HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier, t.self], color: ink("--ember") },
    { tag: [t.string, t.special(t.string), t.regexp, t.character], color: ink("--pass") },
    { tag: [t.number, t.bool, t.null, t.atom, t.unit], color: ink("--warn") },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: ink("--ink-3"), fontStyle: "italic" },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: ink("--frost") },
    { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: ink("--ember-2") },
    { tag: [t.meta, t.annotation, t.processingInstruction], color: ink("--frost") },
    { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: "var(--ink-2)" },
    { tag: [t.propertyName, t.attributeName], color: "var(--ink)" },
    { tag: t.definition(t.variableName), color: "var(--ink)", fontWeight: "500" },
    { tag: t.invalid, color: "var(--fail)" },
  ]);

  return [chrome, syntaxHighlighting(highlight)];
}

export const forgeDark = forge(true);
export const forgeLight = forge(false);
