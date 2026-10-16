"""Every supported language, judged for real by the local sandbox.

Each language gets the same four checks: a correct program is accepted, a
syntax error is a compilation error (or, for TypeScript, which has no compile
step, a runtime error), an infinite loop hits the time limit, and a 512 MB
allocation is stopped by the 128 MB memory limit.

A language whose toolchain is not installed is skipped -- unless
REQUIRE_ALL_TOOLCHAINS is set, as it is in CI and inside the Docker image,
where a missing compiler must fail loudly rather than quietly skip.
"""

import os
import sys

import pytest

from app.execution.base import ExecutionRequest, Outcome
from app.execution.languages import LANGUAGES
from app.execution.local_backend import LocalBackend

pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="the local sandbox needs POSIX rlimits")

# Reads two integers, prints their sum.
SUM = {
    "python": "a, b = map(int, input().split())\nprint(a + b)\n",
    "c": '#include <stdio.h>\nint main(void){long long a,b;scanf("%lld %lld",&a,&b);printf("%lld\\n",a+b);return 0;}\n',
    "cpp": "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<\"\\n\";}\n",
    "java": "import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);long a=s.nextLong(),b=s.nextLong();System.out.println(a+b);}}\n",
    "javascript": "const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
    "typescript": "import { readFileSync } from 'node:fs';\nconst [a, b]: number[] = readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
    "go": 'package main\nimport "fmt"\nfunc main(){var a,b int64;fmt.Scan(&a,&b);fmt.Println(a+b)}\n',
    "rust": "use std::io::Read;\nfn main(){let mut s=String::new();std::io::stdin().read_to_string(&mut s).unwrap();let v:Vec<i64>=s.split_whitespace().map(|x|x.parse().unwrap()).collect();println!(\"{}\",v[0]+v[1]);}\n",
    "ruby": "a, b = gets.split.map(&:to_i)\nputs a + b\n",
    "php": "<?php\n[$a, $b] = array_map('intval', preg_split('/\\s+/', trim(fgets(STDIN))));\necho $a + $b, PHP_EOL;\n",
}

BROKEN = {
    "python": "print(\n",
    "c": "int main(void){ return }\n",
    "cpp": "int main(){ return }\n",
    "java": "public class Main{ void x( }\n",
    "javascript": "console.log((;\n",
    "typescript": "const x: number = ;\n",
    "go": "package main\nfunc main(){ x := }\n",
    "rust": "fn main(){ let x = ; }\n",
    "ruby": "def x(\n",
    "php": "<?php echo ;\n",
}

LOOP = {
    "python": "while True:\n    pass\n",
    "c": "int main(void){volatile long x=0;for(;;)x++;}\n",
    "cpp": "int main(){volatile long x=0;for(;;)x++;}\n",
    "java": "public class Main{public static void main(String[] a){long x=0;while(true)x++;}}\n",
    "javascript": "for (;;) {}\n",
    "typescript": "let i: number = 0;\nfor (;;) { i++; }\n",
    "go": "package main\nfunc main(){x:=0;for{x++}}\n",
    "rust": "fn main(){let mut x:u64=0;loop{x=x.wrapping_add(1);std::hint::black_box(x);}}\n",
    "ruby": "loop { }\n",
    "php": "<?php while (true) {}\n",
}

# Allocates ~512 MB and touches it, so it cannot be optimised away.
HOG = {
    "python": "x = bytearray(512 * 1024 * 1024)\nprint(len(x))\n",
    "c": "#include <stdlib.h>\n#include <string.h>\n#include <stdio.h>\nint main(void){size_t n=512u<<20;char*p=malloc(n);if(!p)return 1;memset(p,1,n);printf(\"%d\\n\",p[n-1]);}\n",
    "cpp": "#include <vector>\n#include <cstdio>\nint main(){std::vector<char> v(512u<<20,1);std::printf(\"%d\\n\",v.back());}\n",
    "java": "public class Main{public static void main(String[] a){byte[] b=new byte[512*1024*1024];b[b.length-1]=1;System.out.println(b[b.length-1]);}}\n",
    "javascript": "const a = [];\nfor (let i = 0; i < 64; i++) a.push(new Array(1 << 20).fill(i));\nconsole.log(a.length);\n",
    "typescript": "const a: number[][] = [];\nfor (let i = 0; i < 64; i++) a.push(new Array(1 << 20).fill(i));\nconsole.log(a.length);\n",
    "go": "package main\nimport \"fmt\"\nfunc main(){b:=make([]byte,512<<20);for i:=range b{b[i]=1};fmt.Println(b[len(b)-1])}\n",
    "rust": "fn main(){let v=vec![1u8;512<<20];println!(\"{}\",v[v.len()-1]);}\n",
    "ruby": "s = 'x' * (512 * 1024 * 1024)\nputs s.size\n",
    "php": "<?php ini_set('memory_limit', '-1'); $s = str_repeat('x', 512 * 1024 * 1024); echo strlen($s);\n",
}


def test_every_language_has_every_program():
    for table in (SUM, BROKEN, LOOP, HOG):
        assert set(table) == set(LANGUAGES), set(LANGUAGES) ^ set(table)


@pytest.fixture(scope="module")
def backend():
    return LocalBackend()


def _need(backend, language):
    available = backend.describe().get("toolchains", {}).get(language)
    if not available:
        if os.getenv("REQUIRE_ALL_TOOLCHAINS"):
            pytest.fail(f"{language} toolchain is not installed, and REQUIRE_ALL_TOOLCHAINS is set")
        pytest.skip(f"{language} toolchain is not installed")


def _run(backend, language, source, stdin="", time_limit_ms=4000):
    return backend.run(
        ExecutionRequest(language=language, source_code=source, stdin=stdin,
                         time_limit_ms=time_limit_ms, memory_limit_mb=128)
    )


@pytest.mark.parametrize("language", sorted(LANGUAGES))
def test_a_correct_program_is_accepted(backend, language):
    _need(backend, language)
    result = _run(backend, language, SUM[language], stdin="40 2\n")
    assert result.outcome is Outcome.OK, (result.outcome, result.compile_output, result.stderr, result.detail)
    assert result.stdout.strip() == "42"


@pytest.mark.parametrize("language", sorted(LANGUAGES))
def test_a_syntax_error_is_reported_not_raised(backend, language):
    _need(backend, language)
    result = _run(backend, language, BROKEN[language])
    expected = Outcome.RUNTIME_ERROR if LANGUAGES[language].compile_cmd is None else Outcome.COMPILE_ERROR
    assert result.outcome is expected, (result.outcome, result.compile_output, result.stderr)


@pytest.mark.parametrize("language", sorted(LANGUAGES))
def test_an_infinite_loop_hits_the_time_limit(backend, language):
    _need(backend, language)
    result = _run(backend, language, LOOP[language], time_limit_ms=1500)
    assert result.outcome is Outcome.TIMEOUT, (result.outcome, result.stderr, result.detail)


@pytest.mark.parametrize("language", sorted(LANGUAGES))
def test_a_512_mb_allocation_is_stopped(backend, language):
    _need(backend, language)
    result = _run(backend, language, HOG[language])
    assert result.outcome is not Outcome.OK, (result.outcome, result.stdout)
    assert result.outcome in (Outcome.MEMORY_EXCEEDED, Outcome.RUNTIME_ERROR), (result.outcome, result.stderr)
