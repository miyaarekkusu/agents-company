from pydantic import BaseModel


class TaskRequest(BaseModel):
    task: str


class TaskResult(BaseModel):
    result: str
