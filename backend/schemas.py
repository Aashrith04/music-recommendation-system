# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SongBase(BaseModel):
    title: str
    artist: str
    genre: str
    mood: Optional[str] = None
    language: Optional[str] = None
    year: Optional[int] = None
    album: Optional[str] = None
    audio_url: Optional[str] = None


class SongCreate(SongBase):
    """
    Schema for validating song creation requests.
    """
    pass

class SongUpdate(SongBase):
    """
    Schema for validating song update requests.
    """
    pass

class SongResponse(SongBase):
    """
    Schema for standard API responses.
    Includes database-managed fields like id and created_at.
    """
    id: int
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class UserCreate(BaseModel):
    """
    Schema for validating user registration requests.
    """
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    """
    Schema for validating JSON user login requests.
    """
    username: str
    password: str

class UserResponse(BaseModel):
    """
    Schema for serializing user details in responses.
    """
    id: int
    username: str
    email: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

class Token(BaseModel):
    """
    Schema representing the access token structure returned on login.
    """
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """
    Schema representing the payload encoded in the access token.
    """
    username: str | None = None

