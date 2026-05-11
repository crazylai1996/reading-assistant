from pydantic import BaseModel,Field, field_validator, model_validator

class BookNote(BaseModel):
    title: str = Field(default='', min_length=1, max_length=100)
    author: str = Field(default='', min_length=1, max_length=50)
    content: str = Field(default='', min_length=1)