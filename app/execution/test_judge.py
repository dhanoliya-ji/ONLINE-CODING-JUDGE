from app.execution.judge import judge_submission


code = """
a,b=map(int,input().split())

print(a+b)
"""

result = judge_submission(

    source_code=code,

    input_data="2 3",

    expected_output="5"

)

print(result)