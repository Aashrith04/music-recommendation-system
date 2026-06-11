# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import List

import os
from database import get_db
import models
import schemas
from auth_utils import decode_access_token, get_password_hash, verify_password, create_access_token
from recommendation import get_content_recommendations

app = FastAPI(title="AI Music Recommendation API - Phase 4")
@app.on_event("startup")
def startup_event():
    from init_db import init_db
    init_db()

# Configure CORS origins dynamically from environment variable
cors_origin_str = os.getenv("CORS_ORIGIN", "http://localhost:5173")
origins = [origin.strip() for origin in cors_origin_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files to serve audio clips
app.mount("/static", StaticFiles(directory="static"), name="static")


# HTTPBearer security scheme to read JWT from Authorization header
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> models.User:
    """
    Dependency that extracts the token, decodes it, and retrieves the current authenticated user.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- Authentication Endpoints ---

@app.post("/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account. Password is hashed before storing.
    """
    # Check if username already exists
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    db_email = db.query(models.User).filter(models.User.email == user.email).first()
    if db_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_pwd = get_password_hash(user.password)
    new_user = models.User(username=user.username, email=user.email, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user with username and password, returning a JWT token.
    """
    user = db.query(models.User).filter(models.User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def get_profile(current_user: models.User = Depends(get_current_user)):
    """
    Retrieve the current logged-in user's profile.
    """
    return current_user

# --- Songs CRUD Endpoints ---

@app.get("/songs", response_model=List[schemas.SongResponse])
def get_songs(db: Session = Depends(get_db)):
    """
    Retrieve all songs from the SQLite database.
    """
    songs = db.query(models.Song).order_by(models.Song.id).all()
    return songs

@app.post("/songs", response_model=schemas.SongResponse, status_code=status.HTTP_201_CREATED)
def create_song(song: schemas.SongCreate, db: Session = Depends(get_db)):
    """
    Add a new song to the database.
    """
    db_song = models.Song(
        title=song.title,
        artist=song.artist,
        genre=song.genre,
        mood=song.mood,
        language=song.language,
        year=song.year,
        album=song.album,
        audio_url=song.audio_url
    )
    db.add(db_song)
    db.commit()
    db.refresh(db_song)
    return db_song

@app.get("/songs/{song_id}", response_model=schemas.SongResponse)
def get_song(song_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a specific song by its ID.
    """
    db_song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not db_song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song with ID {song_id} not found"
        )
    return db_song

@app.put("/songs/{song_id}", response_model=schemas.SongResponse)
def update_song(song_id: int, updated_song: schemas.SongUpdate, db: Session = Depends(get_db)):
    """
    Update details of a specific song.
    """
    db_song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not db_song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song with ID {song_id} not found"
        )
    
    db_song.title = updated_song.title
    db_song.artist = updated_song.artist
    db_song.genre = updated_song.genre
    db_song.mood = updated_song.mood
    db_song.language = updated_song.language
    db_song.year = updated_song.year
    db_song.album = updated_song.album
    db_song.audio_url = updated_song.audio_url
    
    db.commit()
    db.refresh(db_song)
    return db_song

@app.delete("/songs/{song_id}", status_code=status.HTTP_200_OK)
def delete_song(song_id: int, db: Session = Depends(get_db)):
    """
    Delete a specific song from the database.
    """
    db_song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not db_song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song with ID {song_id} not found"
        )
    
    db.delete(db_song)
    db.commit()
    return {"message": "Song deleted successfully"}

# --- Favorites Endpoints ---

@app.post("/favorites/{song_id}", status_code=status.HTTP_200_OK)
def add_favorite(song_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Add a song to the current user's favorites list.
    """
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song with ID {song_id} not found"
        )
    
    if song in current_user.favorite_songs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Song is already in favorites"
        )
    
    current_user.favorite_songs.append(song)
    db.commit()
    return {"message": "Song added to favorites"}

@app.delete("/favorites/{song_id}", status_code=status.HTTP_200_OK)
def remove_favorite(song_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Remove a song from the current user's favorites list.
    """
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song with ID {song_id} not found"
        )
    
    if song not in current_user.favorite_songs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Song not found in favorites"
        )
    
    current_user.favorite_songs.remove(song)
    db.commit()
    return {"message": "Song removed from favorites"}

@app.get("/favorites", response_model=List[schemas.SongResponse])
def get_favorites(current_user: models.User = Depends(get_current_user)):
    """
    Retrieve all favorite songs of the current logged-in user.
    """
    return current_user.favorite_songs

# --- Recommendations Endpoint ---

@app.get("/recommendations", response_model=List[schemas.SongResponse])
def get_recommendations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get personalized song recommendations for the current logged-in user.
    """
    all_songs = db.query(models.Song).all()
    user_favorites = current_user.favorite_songs
    recommendations = get_content_recommendations(
        user_favorites=user_favorites,
        all_songs=all_songs,
        limit=5
    )
    return recommendations

if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

