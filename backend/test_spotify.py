# test_spotify.py

from spotify_service import SpotifyService

sp = SpotifyService()

print(
    sp.search_track(
        "Kesariya",
        "Arijit Singh"
    )
)