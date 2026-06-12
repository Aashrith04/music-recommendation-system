import os
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

class SpotifyService:
    def __init__(self):
        client_id = os.getenv("SPOTIPY_CLIENT_ID")
        client_secret = os.getenv("SPOTIPY_CLIENT_SECRET")

        if client_id and client_secret:
            auth_manager = SpotifyClientCredentials(
                client_id=client_id,
                client_secret=client_secret
            )
            self.sp = spotipy.Spotify(auth_manager=auth_manager)
        else:
            self.sp = None

    def search_track(self, title, artist):
        if not self.sp:
            return None

        try:
            query = f"track:{title} artist:{artist}"

            results = self.sp.search(
                q=query,
                type="track",
                limit=1
            )

            items = results["tracks"]["items"]

            if not items:
                return None

            track = items[0]

            return {
                "spotify_track_id": track["id"],
                "spotify_url": track["external_urls"]["spotify"],
                "album_cover": track["album"]["images"][0]["url"] if track["album"]["images"] else None,
                "preview_url": track["preview_url"]
            }

        except Exception as e:
            print("Spotify Error:", e)
            return None