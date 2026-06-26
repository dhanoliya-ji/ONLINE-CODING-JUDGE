import docker
import tempfile
import os
import time

from docker.errors import DockerException


def _get_client():
    try:
        return docker.from_env()
    except DockerException:
        return None


def run_python_docker(source_code, input_data):

    client = _get_client()

    if client is None:
        return {
            "stdout": "",
            "stderr": "Docker is not available",
            "execution_time": 0,
            "memory_used": "0 MB",
            "exit_code": -1
        }

    with tempfile.TemporaryDirectory() as tmp:

        source_file = os.path.join(tmp, "solution.py")

        with open(source_file, "w", encoding="utf-8") as f:
            f.write(source_code)

        input_file = os.path.join(tmp, "input.txt")

        with open(input_file, "w") as f:
            f.write(input_data)

        start = time.perf_counter()

        container = client.containers.run(
            image="python:3.11",
            command="sh -c 'python solution.py < input.txt'",
            volumes={
                tmp: {
                    "bind": "/code",
                    "mode": "rw"
                }
            },
            working_dir="/code",
            detach=True,
            mem_limit="128m",
            network_disabled=True,
            cpu_period=100000,
            cpu_quota=50000
        )

        try:

            result = container.wait(timeout=2)

            execution_time = (
                time.perf_counter() - start
            ) * 1000

            logs = container.logs().decode()

            return {
                "stdout": logs.strip(),
                "stderr": "",
                "execution_time": round(execution_time, 2),
                "memory_used": "128 MB",
                "exit_code": result["StatusCode"]
            }

        except Exception:

            container.kill()

            return {
                "stdout": "",
                "stderr": "Time Limit Exceeded",
                "execution_time": 2000,
                "memory_used": "128 MB",
                "exit_code": -1
            }

        finally:

            container.remove(force=True)