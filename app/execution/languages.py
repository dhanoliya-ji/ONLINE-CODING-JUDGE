"""Per-language build and run recipes.

Adding a language is a matter of appending one :class:`LanguageSpec` - neither
sandbox backend contains language-specific branching.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models.enums import Language


@dataclass(frozen=True, slots=True)
class LanguageSpec:
    id: str
    display_name: str
    source_filename: str
    #: Argv used to compile, or ``None`` for interpreted languages.
    compile_cmd: list[str] | None
    #: Argv used to execute the (possibly compiled) program.
    run_cmd: list[str]
    #: Image used by the Docker backend.
    docker_image: str
    #: Executables the local backend needs on ``PATH``.
    local_requirements: tuple[str, ...]
    #: Extension used for the compiled artefact, if any.
    artifact: str | None = None
    #: The JVM reserves a huge virtual address space at startup, so capping
    #: RLIMIT_AS kills it outright. Such languages self-limit instead.
    supports_address_space_limit: bool = True
    #: Extra argv injected before ``run_cmd`` args, templated with the limits.
    memory_flag_template: list[str] = field(default_factory=list)
    #: Extra environment for both compiling and running, on either backend.
    env: dict[str, str] = field(default_factory=dict)
    #: For runtimes that can neither live under RLIMIT_AS nor cap their own
    #: heap (Go): the local backend kills the run once its resident memory
    #: passes the limit.
    enforce_rss_limit: bool = False

    @property
    def needs_compile(self) -> bool:
        return self.compile_cmd is not None

    def render_run_cmd(self, memory_limit_mb: int) -> list[str]:
        """Run argv with any language-level memory flag substituted in."""
        if not self.memory_flag_template:
            return list(self.run_cmd)
        flags = [
            part.replace("{memory_mb}", str(memory_limit_mb))
            for part in self.memory_flag_template
        ]
        # Flags belong immediately after the interpreter/launcher binary.
        return [self.run_cmd[0], *flags, *self.run_cmd[1:]]


LANGUAGES: dict[str, LanguageSpec] = {
    Language.PYTHON.value: LanguageSpec(
        id=Language.PYTHON.value,
        display_name="Python 3.11",
        source_filename="solution.py",
        # Byte-compiling first turns a SyntaxError into a Compilation Error
        # verdict rather than a confusing Runtime Error.
        compile_cmd=["python", "-m", "py_compile", "solution.py"],
        run_cmd=["python", "solution.py"],
        docker_image="python:3.11-slim",
        local_requirements=("python",),
    ),
    Language.CPP.value: LanguageSpec(
        id=Language.CPP.value,
        display_name="C++17 (GCC)",
        source_filename="solution.cpp",
        compile_cmd=[
            "g++",
            "-std=c++17",
            "-O2",
            "-pipe",
            "-static",
            "-s",
            "-o",
            "solution",
            "solution.cpp",
        ],
        run_cmd=["./solution"],
        docker_image="gcc:13",
        local_requirements=("g++",),
        artifact="solution",
    ),
    Language.JAVA.value: LanguageSpec(
        id=Language.JAVA.value,
        display_name="Java 21",
        source_filename="Main.java",
        compile_cmd=["javac", "-encoding", "UTF-8", "Main.java"],
        run_cmd=["java", "-cp", ".", "Main"],
        # Kept in step with the JDK baked into the Dockerfile, so a submission
        # behaves identically on either backend.
        docker_image="eclipse-temurin:21-jdk",
        local_requirements=("javac", "java"),
        artifact="Main.class",
        supports_address_space_limit=False,
        memory_flag_template=["-Xmx{memory_mb}m", "-XX:+UseSerialGC", "-Xss64m"],
    ),
    Language.C.value: LanguageSpec(
        id=Language.C.value,
        display_name="C17 (GCC)",
        source_filename="solution.c",
        compile_cmd=[
            "gcc", "-std=c17", "-O2", "-pipe", "-static", "-s",
            "-o", "solution", "solution.c", "-lm",
        ],
        run_cmd=["./solution"],
        docker_image="gcc:13",
        local_requirements=("gcc",),
        artifact="solution",
    ),
    # JavaScript and TypeScript share Node.js. V8 reserves a large virtual
    # address space up front, so -- like the JVM -- it cannot run under
    # RLIMIT_AS and caps its own heap instead.
    Language.JAVASCRIPT.value: LanguageSpec(
        id=Language.JAVASCRIPT.value,
        display_name="JavaScript (Node.js 24)",
        source_filename="solution.js",
        # A syntax check, so a typo is a Compilation Error, not a Runtime Error.
        compile_cmd=["node", "--check", "solution.js"],
        run_cmd=["node", "solution.js"],
        docker_image="node:24-slim",
        local_requirements=("node",),
        supports_address_space_limit=False,
        memory_flag_template=["--max-old-space-size={memory_mb}", "--stack-size=65500"],
    ),
    # Node 24 strips TypeScript types natively, so there is no tsc step: it
    # runs "erasable" TypeScript (no enums or namespaces) as fast as JS.
    Language.TYPESCRIPT.value: LanguageSpec(
        id=Language.TYPESCRIPT.value,
        display_name="TypeScript (Node.js 24)",
        source_filename="solution.ts",
        compile_cmd=None,
        run_cmd=["node", "solution.ts"],
        docker_image="node:24-slim",
        local_requirements=("node",),
        supports_address_space_limit=False,
        memory_flag_template=["--max-old-space-size={memory_mb}", "--stack-size=65500"],
        env={"NODE_NO_WARNINGS": "1"},
    ),
    Language.GO.value: LanguageSpec(
        id=Language.GO.value,
        display_name="Go 1.24",
        source_filename="main.go",
        compile_cmd=["go", "build", "-o", "solution", "main.go"],
        run_cmd=["./solution"],
        docker_image="golang:1.24",
        local_requirements=("go",),
        artifact="solution",
        # The Go runtime reserves its heap arena map up front and dies with
        # "failed to reserve page summary memory" under RLIMIT_AS, and it has
        # no hard heap cap of its own -- so resident memory is policed instead.
        supports_address_space_limit=False,
        enforce_rss_limit=True,
        # Never fetch a toolchain or a module: a submission is one file, and
        # the sandbox has no business on the network.
        env={"GOTOOLCHAIN": "local", "GOPROXY": "off", "CGO_ENABLED": "0"},
    ),
    Language.RUST.value: LanguageSpec(
        id=Language.RUST.value,
        display_name="Rust 1.85",
        source_filename="main.rs",
        compile_cmd=["rustc", "-O", "--edition", "2021", "-o", "solution", "main.rs"],
        run_cmd=["./solution"],
        docker_image="rust:1.85-slim",
        local_requirements=("rustc",),
        artifact="solution",
    ),
    Language.RUBY.value: LanguageSpec(
        id=Language.RUBY.value,
        display_name="Ruby 3.3",
        source_filename="solution.rb",
        compile_cmd=["ruby", "-c", "solution.rb"],
        run_cmd=["ruby", "solution.rb"],
        docker_image="ruby:3.3-slim",
        local_requirements=("ruby",),
    ),
    Language.PHP.value: LanguageSpec(
        id=Language.PHP.value,
        display_name="PHP 8.4",
        source_filename="solution.php",
        compile_cmd=["php", "-l", "solution.php"],
        run_cmd=["php", "solution.php"],
        docker_image="php:8.4-cli",
        local_requirements=("php",),
    ),
}


def get_language(language_id: str) -> LanguageSpec:
    try:
        return LANGUAGES[language_id.strip().lower()]
    except KeyError as exc:
        supported = ", ".join(sorted(LANGUAGES))
        raise ValueError(
            f"Unsupported language {language_id!r}. Supported: {supported}"
        ) from exc


def supported_languages() -> list[dict]:
    return [
        {
            "id": spec.id,
            "name": spec.display_name,
            "compiled": spec.needs_compile,
            "docker_image": spec.docker_image,
        }
        for spec in LANGUAGES.values()
    ]
