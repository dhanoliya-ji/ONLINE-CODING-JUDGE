import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { StreamLanguage } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { oneDark } from "@codemirror/theme-one-dark";
import type { LanguageId } from "../lib/types";

/** Runnable skeletons so a new user is never staring at an empty buffer. */
export const STARTERS: Record<LanguageId, string> = {
  python: `# Read from standard input, write to standard output.
a, b = map(int, input().split())
print(a + b)
`,
  cpp: `#include <iostream>

int main() {
    long long a, b;
    std::cin >> a >> b;
    std::cout << a + b << std::endl;
    return 0;
}
`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        long a = scanner.nextLong();
        long b = scanner.nextLong();
        System.out.println(a + b);
    }
}
`,
  c: `#include <stdio.h>

int main(void) {
    long long a, b;
    scanf("%lld %lld", &a, &b);
    printf("%lld\\n", a + b);
    return 0;
}
`,
  javascript: `// Read all of standard input, write to standard output.
const input = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/);
const [a, b] = input.map(Number);
console.log(a + b);
`,
  typescript: `// Node 24 runs TypeScript directly (type annotations only: no enums).
import { readFileSync } from "node:fs";

const [a, b]: number[] = readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(a + b);
`,
  go: `package main

import "fmt"

func main() {
	var a, b int64
	fmt.Scan(&a, &b)
	fmt.Println(a + b)
}
`,
  rust: `use std::io::Read;

fn main() {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).unwrap();
    let nums: Vec<i64> = input.split_whitespace().map(|x| x.parse().unwrap()).collect();
    println!("{}", nums[0] + nums[1]);
}
`,
  ruby: `# Read from standard input, write to standard output.
a, b = gets.split.map(&:to_i)
puts a + b
`,
  php: `<?php
// Read from standard input, write to standard output.
[$a, $b] = array_map("intval", preg_split("/\\s+/", trim(fgets(STDIN))));
echo $a + $b, PHP_EOL;
`,
};

export function CodeEditor({
  value,
  onChange,
  language,
  height = "420px",
}: {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId;
  height?: string;
}) {
  const extensions = useMemo(() => {
    switch (language) {
      case "c":
      case "cpp":
        return [cpp()];
      case "java":
        return [java()];
      case "javascript":
        return [javascript()];
      case "typescript":
        return [javascript({ typescript: true })];
      case "go":
        return [go()];
      case "rust":
        return [rust()];
      case "ruby":
        return [StreamLanguage.define(ruby)];
      case "php":
        return [php()];
      default:
        return [python()];
    }
  }, [language]);

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        foldGutter: false,
        // The browser's own search UI is more familiar than CodeMirror's,
        // and the panel fights the glass styling.
        searchKeymap: false,
      }}
      aria-label="Source code editor"
    />
  );
}
