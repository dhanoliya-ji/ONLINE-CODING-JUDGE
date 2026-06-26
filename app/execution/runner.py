import subprocess
import tempfile
import os


def run_python_code(
    source_code: str,
    input_data: str
):

    with tempfile.NamedTemporaryFile(
        suffix=".py",
        delete=False,
        mode="w",
        encoding="utf-8"
    ) as file:

        file.write(source_code)

        filename = file.name

    try:

        result = subprocess.run(

            ["python", filename],

            input=input_data,

            capture_output=True,

            text=True,

            timeout=2

        )

        return {

            "stdout": result.stdout.strip(),

            "stderr": result.stderr.strip(),

            "returncode": result.returncode

        }

    finally:

        os.remove(filename)