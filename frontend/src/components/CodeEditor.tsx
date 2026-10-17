import { useMemo } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { StreamLanguage } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import type { LanguageId } from "../lib/types";
import { useTheme } from "../lib/theme";
import { forgeDark, forgeLight } from "./solve/editorTheme";

export function CodeEditor({
  value,
  onChange,
  language,
  height = "420px",
  readOnly = false,
  label = "Source code editor",
}: {
  value: string;
  onChange?: (value: string) => void;
  language: LanguageId;
  /** A CSS height; "100%" fills a parent that has a definite height. */
  height?: string;
  readOnly?: boolean;
  label?: string;
}) {
  const { theme } = useTheme();

  const extensions = useMemo(() => {
    const mode = (() => {
      switch (language) {
        case "c":
        case "cpp":
          return cpp();
        case "java":
          return java();
        case "javascript":
          return javascript();
        case "typescript":
          return javascript({ typescript: true });
        case "go":
          return go();
        case "rust":
          return rust();
        case "ruby":
          return StreamLanguage.define(ruby);
        case "php":
          return php();
        default:
          return python();
      }
    })();
    return [
      mode,
      ...(theme === "light" ? forgeLight : forgeDark),
      // The label belongs on the focusable content, where screen readers look.
      EditorView.contentAttributes.of({ "aria-label": label }),
    ];
  }, [language, theme, label]);

  return (
    <CodeMirror
      value={value}
      height={height}
      className={height === "100%" ? "h-full" : undefined}
      // The theme lives in `extensions`; "none" stops the default light theme
      // from fighting it.
      theme="none"
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: !readOnly,
        foldGutter: false,
        // The browser's own search UI is more familiar than CodeMirror's,
        // and the panel fights the workspace styling.
        searchKeymap: false,
      }}
    />
  );
}
