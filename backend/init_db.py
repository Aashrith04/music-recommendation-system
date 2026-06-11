import sys
import json
import os
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import text
from database import SessionLocal, engine, Base
from models import Song, User

def migrate_schema():
    """
    Checks if the columns 'mood', 'language', 'year', 'album' exist in the 'songs' table.
    If not, dynamically adds them using ALTER TABLE. This is migration-safe and preserves all other data.
    """
    print("Checking database columns for migration...")
    try:
        with engine.connect() as conn:
            # SQLite command to get table info
            result = conn.execute(text("PRAGMA table_info(songs)")).fetchall()
            columns = [row[1] for row in result]
            
            # Check and add columns if they are missing
            columns_added = False
            if "mood" not in columns:
                print("Adding column 'mood' to 'songs' table...")
                conn.execute(text("ALTER TABLE songs ADD COLUMN mood VARCHAR(100)"))
                columns_added = True
            if "language" not in columns:
                print("Adding column 'language' to 'songs' table...")
                conn.execute(text("ALTER TABLE songs ADD COLUMN language VARCHAR(50)"))
                columns_added = True
            if "year" not in columns:
                print("Adding column 'year' to 'songs' table...")
                conn.execute(text("ALTER TABLE songs ADD COLUMN year INTEGER"))
                columns_added = True
            if "album" not in columns:
                print("Adding column 'album' to 'songs' table...")
                conn.execute(text("ALTER TABLE songs ADD COLUMN album VARCHAR(255)"))
                columns_added = True
            if "audio_url" not in columns:
                print("Adding column 'audio_url' to 'songs' table...")
                conn.execute(text("ALTER TABLE songs ADD COLUMN audio_url VARCHAR(500)"))
                columns_added = True
            
            if columns_added:
                conn.commit()
                print("Columns added successfully.")
            else:
                print("No schema changes needed. Columns already exist.")
    except Exception as e:
        print(f"Error during schema migration: {e}", file=sys.stderr)

def seed_database(db: Session):
    """
    Seeds the database with songs from songs_seed.json.
    Matches existing songs by title and artist to update them, or inserts them if new.
    This preserves IDs and favorite associations for existing songs.
    """
    seed_file_path = "songs_seed.json"
    if not os.path.exists(seed_file_path):
        print(f"Error: Seed file {seed_file_path} not found.", file=sys.stderr)
        return

    print(f"Reading seed data from {seed_file_path}...")
    with open(seed_file_path, "r", encoding="utf-8") as f:
        seed_songs = json.load(f)

    print(f"Processing {len(seed_songs)} songs...")
    inserted_count = 0
    updated_count = 0

    for item in seed_songs:
        title = item.get("title")
        artist = item.get("artist")
        genre = item.get("genre")
        mood = item.get("mood")
        language = item.get("language")
        year = item.get("year")
        album = item.get("album")
        audio_url = item.get("audio_url")

        # Check if song already exists in the database
        db_song = db.query(Song).filter(Song.title == title, Song.artist == artist).first()

        if db_song:
            # Update the existing song's details
            db_song.genre = genre
            db_song.mood = mood
            db_song.language = language
            db_song.year = year
            db_song.album = album
            db_song.audio_url = audio_url
            updated_count += 1
        else:
            # Insert new song
            new_song = Song(
                title=title,
                artist=artist,
                genre=genre,
                mood=mood,
                language=language,
                year=year,
                album=album,
                audio_url=audio_url
            )
            db.add(new_song)
            inserted_count += 1

    db.commit()
    print(f"Database sync complete. Songs added: {inserted_count}, Songs updated: {updated_count}.")

def init_db():
    print("Initializing database tables...")
    try:
        # Create tables if they do not exist
        Base.metadata.create_all(bind=engine)
        print("Table existence verified.")
    except Exception as e:
        print(f"Error verifying tables: {e}", file=sys.stderr)
        sys.exit(1)

    # Run migration check on existing database
    migrate_schema()

    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        print(f"Error during seeding: {e}", file=sys.stderr)
    finally:
        db.close()

if __name__ == "__main__":
    init_db()

