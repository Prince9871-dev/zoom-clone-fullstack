import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

class UserRegister(BaseModel):
    email: str = Field(..., description="Unique email address for registration")
    full_name: str = Field(..., min_length=1, max_length=100, description="Full display name of the user")
    password: str = Field(..., min_length=6, max_length=100, description="Login password (minimum 6 characters)")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email address format")
        return v.lower().strip()

    @field_validator("full_name")
    @classmethod
    def name_must_not_be_whitespace(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty or whitespace")
        return v.strip()

class UserLogin(BaseModel):
    email: str = Field(..., description="Register user email")
    password: str = Field(..., description="User login password")

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Optional new name")
    password: Optional[str] = Field(None, min_length=6, max_length=100, description="Optional new password")



class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
