// Loaded with a dynamic import() from Markdown.tsx, so KaTeX, its stylesheet
// and its fonts land in their own chunk and are fetched only when a page
// actually contains maths.
import katex from "katex";
import "katex/dist/katex.min.css";
import "./katex-overrides.css";

export default katex;
