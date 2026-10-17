import type { LanguageId } from "../../lib/types";

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
