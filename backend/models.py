# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, func
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
from database import Base

# Association table for Many-to-Many relationship between User and Song
favorites = Table(
    "favorites",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("song_id", Integer, ForeignKey("songs.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
)


class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    genre = Column(String)

    mood = Column(String)
    language = Column(String)
    year = Column(Integer)
    album = Column(String)

    audio_url = Column(String)

    spotify_url = Column(String, nullable=True)
    spotify_track_id = Column(String, nullable=True)
    album_cover = Column(String, nullable=True)
    preview_url = Column(String, nullable=True)

    favorited_by = relationship(
        "User",
        secondary=favorites,
        back_populates="favorite_songs"
    )

class User(Base):
    """
    SQLAlchemy database model for the 'users' table.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Many-to-many relationship with songs
    favorite_songs = relationship("Song", secondary=favorites, back_populates="favorited_by")
