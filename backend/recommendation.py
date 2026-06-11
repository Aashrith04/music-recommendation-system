from typing import List
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import models

def get_content_recommendations(user_favorites: List[models.Song], all_songs: List[models.Song], limit: int = 5) -> List[models.Song]:
    """
    Generate content-based song recommendations for a user based on their favorites.
    Uses TF-IDF vectorization and Cosine Similarity.
    
    Weighting formula: title + artist * 2 + genre * 2 + mood * 2 + language * 2 + year + album
    f"{title} {artist} {artist} {genre} {genre} {mood} {mood} {language} {language} {year} {album}"
    """
    # 1. Check if user has any favorites. If not, return fallback (5 most recent songs in the database)
    if not user_favorites:
        # Sort catalog by ID descending to get the most recent ones
        sorted_recent = sorted(all_songs, key=lambda s: s.id, reverse=True)
        return sorted_recent[:limit]

    # 2. Extract favorite IDs to easily exclude them from recommendations later
    favorite_ids = {song.id for song in user_favorites}

    # 3. Build text documents for all songs in the catalog
    # Feature engineering weighting: title + artist * 2 + genre * 2 + mood * 2 + language * 2 + year + album
    song_docs = []
    song_ids = []
    song_map = {}
    
    for song in all_songs:
        title = song.title or ""
        artist = song.artist or ""
        genre = song.genre or ""
        mood = song.mood or ""
        language = song.language or ""
        year = str(song.year) if song.year is not None else ""
        album = song.album or ""
        
        # Construct weighted text representation
        metadata = f"{title} {artist} {artist} {genre} {genre} {mood} {mood} {language} {language} {year} {album}"
        song_docs.append(metadata.lower())
        song_ids.append(song.id)
        song_map[song.id] = song

    # 4. Vectorize text content using TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(stop_words='english')
    tfidf_matrix = vectorizer.fit_transform(song_docs)

    # 5. Extract vectors corresponding to the user's favorite songs
    favorite_indices = [song_ids.index(fav_id) for fav_id in favorite_ids if fav_id in song_ids]
    
    if not favorite_indices:
        # Fallback if somehow favorites are not in the current song catalog list
        sorted_recent = sorted(all_songs, key=lambda s: s.id, reverse=True)
        return sorted_recent[:limit]
        
    favorite_vectors = tfidf_matrix[favorite_indices]

    # 6. Calculate the user profile vector as the mean vector of their favorite songs' vectors
    # This represents the average features of songs the user likes
    user_profile_vector = np.asarray(favorite_vectors.mean(axis=0))

    # 7. Calculate Cosine Similarity between user profile and all songs in the catalog
    similarity_scores = cosine_similarity(user_profile_vector, tfidf_matrix).flatten()

    # 8. Sort and filter results
    # Zip IDs with their similarity scores
    ranked_songs = []
    for idx, score in enumerate(similarity_scores):
        song_id = song_ids[idx]
        # Exclude songs that the user has already favorited
        if song_id not in favorite_ids:
            ranked_songs.append((song_id, score))

    # Sort songs by similarity score in descending order
    ranked_songs.sort(key=lambda item: item[1], reverse=True)

    # 9. Return the top N recommended song objects
    recommended_songs = [song_map[song_id] for song_id, _ in ranked_songs[:limit]]
    return recommended_songs
