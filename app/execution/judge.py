from app.execution.docker_runner import run_python_docker


def judge_submission(source_code, testcases):

    total = len(testcases)

    passed = 0

    execution_time = 0

    for testcase in testcases:

        result = run_python_docker(
            source_code,
            testcase.input_data
        )

        execution_time += result["execution_time"]

        if result["stderr"] == "Time Limit Exceeded":

            return {
                "verdict": "Time Limit Exceeded",
                "score": passed,
                "execution_time": execution_time,
                "memory_used": result["memory_used"]
            }

        if result["exit_code"] != 0:

            return {
                "verdict": "Runtime Error",
                "score": passed,
                "execution_time": execution_time,
                "memory_used": result["memory_used"]
            }

        if result["stdout"].strip() != testcase.expected_output.strip():

            return {
                "verdict": "Wrong Answer",
                "score": passed,
                "execution_time": execution_time,
                "memory_used": result["memory_used"]
            }

        passed += 1

    return {
        "verdict": "Accepted",
        "score": passed,
        "execution_time": execution_time,
        "memory_used": "128 MB"
    }