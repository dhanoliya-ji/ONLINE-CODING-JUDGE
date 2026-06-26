import subprocess
import tempfile
import os


def run_java_code(
    source_code,
    input_data
):

    with tempfile.TemporaryDirectory() as tmp:

        java_file = os.path.join(
            tmp,
            "Main.java"
        )

        with open(
            java_file,
            "w",
            encoding="utf-8"
        ) as f:

            f.write(source_code)

        compile_result = subprocess.run(

            [
                "javac",
                java_file
            ],

            capture_output=True,

            text=True

        )

        if compile_result.returncode != 0:

            return {

                "stdout": "",

                "stderr": compile_result.stderr,

                "returncode": -1

            }

        run_result = subprocess.run(

            [
                "java",
                "-cp",
                tmp,
                "Main"
            ],

            input=input_data,

            capture_output=True,

            text=True,

            timeout=2

        )

        return {

            "stdout": run_result.stdout.strip(),

            "stderr": run_result.stderr.strip(),

            "returncode": run_result.returncode

        }