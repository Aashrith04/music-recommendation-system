import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Play, Pause, Disc, Heart, Volume2, SkipForward, SkipBack, Sparkles, User, LogOut, Lock, Mail, X, Check, Eye, EyeOff } from 'lucide-react';

// Pre-defined premium color gradients for song album covers
const GRADIENTS = [
  'from-purple-600 to-indigo-600',
  'from-pink-500 to-rose-500',
  'from-cyan-500 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-500',
  'from-fuchsia-500 to-purple-600',
  'from-violet-600 to-purple-900',
  'from-blue-500 to-indigo-500',
  'from-rose-400 to-red-600',
  'from-teal-500 to-emerald-700',
  'from-indigo-500 to-purple-500',
  'from-cyan-600 to-teal-500',
  'from-yellow-400 to-amber-600',
  'from-pink-600 to-purple-600',
  'from-blue-600 to-cyan-500',
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  // Global catalog
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auth & Protected features
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  
  // Navigation & filter state
  const [currentView, setCurrentView] = useState('explore'); // 'explore' | 'favorites' | 'recommendations'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  
  // Player state
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackQueue, setPlaybackQueue] = useState([]);
  const [playbackNotification, setPlaybackNotification] = useState(null); // { message, type }
  const [likedSongs, setLikedSongs] = useState({});
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('museai_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });

  // Helper to show custom premium notifications
  const showNotification = (message, type = 'info') => {
    setPlaybackNotification({ message, type });
  };

  // HTML5 Audio Reference
  const audioRef = useRef(new Audio());

  // Refs for tracking latest state inside event listeners to avoid stale closure issues
  const currentPlayingRef = useRef(null);
  const playbackQueueRef = useRef([]);
  const filteredSongsRef = useRef([]);
  const handleNextTrackRef = useRef(null);
  const handlePrevTrackRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (playbackNotification) {
      const timer = setTimeout(() => {
        setPlaybackNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [playbackNotification]);

  // Auth modal & form states
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(null);
  const [authMessage, setAuthMessage] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch initial songs catalog
  useEffect(() => {
    fetchSongs();
  }, []);

  // Sync token-based data on startup or state change
  useEffect(() => {
    if (token) {
      fetchUserProfile();
      fetchFavorites();
    } else {
      setUser(null);
      setFavorites([]);
      setRecommendations([]);
      if (currentView !== 'explore') {
        setCurrentView('explore');
      }
    }
  }, [token]);

  // Sync favorites mapped dictionary
  useEffect(() => {
    const likedMap = {};
    favorites.forEach((song) => {
      likedMap[song.id] = true;
    });
    setLikedSongs(likedMap);
  }, [favorites]);

  // Fetch recommendations when view shifts to recommendations tab, or when favorites update
  useEffect(() => {
    if (token && currentView === 'recommendations') {
      fetchRecommendations();
    }
  }, [token, currentView, favorites]);

  // Listeners for HTML5 Audio events to synchronize real playback progress
  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;

    const handleTimeUpdate = () => {
      setAudioProgress(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration || 0);
      consecutiveErrorsRef.current = 0; // Reset consecutive error count on successful load
    };

    const handleEnded = () => {
      if (handleNextTrackRef.current) {
        handleNextTrackRef.current();
      }
    };

    const handleError = (e) => {
      console.error("HTML5 Audio Error event:", e);
      if (!audio.src || !currentPlayingRef.current) return;
      
      consecutiveErrorsRef.current += 1;
      
      const queue = playbackQueueRef.current.length > 0 ? playbackQueueRef.current : filteredSongsRef.current;
      if (consecutiveErrorsRef.current >= Math.min(5, queue.length)) {
        showNotification("Multiple tracks failed to load. Playback stopped.", "error");
        audio.pause();
        setIsPlaying(false);
        consecutiveErrorsRef.current = 0;
        return;
      }
      
      showNotification(`Failed to load audio for '${currentPlayingRef.current.title}'. Skipping...`, "error");
      
      if (handleNextTrackRef.current) {
        handleNextTrackRef.current();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // React effect that monitors currentPlaying (currentTrack) and updates audioRef.current.src
  useEffect(() => {
    if (currentPlaying) {
      console.log("currentTrack.title:", currentPlaying.title);
      console.log("currentTrack.audio_url:", currentPlaying.audio_url);

      const audio = audioRef.current;
      const playUrl = currentPlaying.audio_url.startsWith('http')
        ? currentPlaying.audio_url
        : `${API_URL}${currentPlaying.audio_url}`;

      // Update the src if it doesn't match the playUrl
      if (audio.src !== playUrl) {
        audio.src = playUrl;
        audio.load();
        if (isPlaying) {
          audio.play().catch(err => console.error("Error playing audio on track change:", err));
        }
      }
    }
  }, [currentPlaying]);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/songs`);
      if (!response.ok) {
        throw new Error('Failed to fetch songs from the backend');
      }
      const data = await response.json();
      setSongs(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(`Could not connect to FastAPI server. Make sure the backend is running at ${API_URL}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load user profile');
      }
      const data = await response.json();
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFavorites = async () => {
    try {
      const response = await fetch(`${API_URL}/favorites`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch favorites');
      }
      const data = await response.json();
      setFavorites(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(`${API_URL}/recommendations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      const data = await response.json();
      setRecommendations(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (authModal === 'login') {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: authForm.username,
            password: authForm.password,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Login failed. Please check your credentials.');
        }

        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        setAuthModal(null);
        setAuthMessage(null);
        setAuthForm({ username: '', email: '', password: '' });
      } else if (authModal === 'register') {
        // Simple client validations
        if (!authForm.username || !authForm.email || !authForm.password) {
          throw new Error('All fields are required.');
        }

        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: authForm.username,
            email: authForm.email,
            password: authForm.password,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Registration failed. Username or email may already be taken.');
        }

        // Auto login on successful registration
        const loginResponse = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: authForm.username,
            password: authForm.password,
          }),
        });

        if (loginResponse.ok) {
          const loginData = await loginResponse.json();
          localStorage.setItem('token', loginData.access_token);
          setToken(loginData.access_token);
          setAuthModal(null);
          setAuthMessage(null);
          setAuthForm({ username: '', email: '', password: '' });
        } else {
          // Switch to login tab with success notice if auto login failed
          setAuthModal('login');
          setAuthSuccess('Registration successful! Please log in below.');
          setAuthForm(prev => ({ ...prev, password: '' }));
        }
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    // Stop audio playback
    const audio = audioRef.current;
    audio.pause();
    setIsPlaying(false);
    setCurrentPlaying(null);

    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setFavorites([]);
    setRecommendations([]);
    setCurrentView('explore');
  };

  // Determine current active catalog list based on Tab view
  const getSongsToDisplay = () => {
    switch (currentView) {
      case 'favorites':
        return favorites;
      case 'recommendations':
        return recommendations;
      case 'explore':
      default:
        return songs;
    }
  };

  // Extract unique genres for filter chips based on current displaying tab list
  const genres = ['All', ...new Set(getSongsToDisplay().map((song) => song.genre))];

  // Filter displaying list based on search query and selected genre
  const filteredSongs = getSongsToDisplay().filter((song) => {
    const matchesSearch =
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'All' || song.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  // Main interactive play/pause actions
  const handlePlayToggle = (song) => {
    if (!song.audio_url) {
      showNotification("This track does not have a playable sample. Try one of the first 25 songs!", "warning");
      return;
    }

    const audio = audioRef.current;
    if (currentPlaying?.id === song.id) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(err => console.error("Error playing audio:", err));
        setIsPlaying(true);
      }
    } else {
      playSongDirectly(song, filteredSongs);
    }
  };

  // Dynamic song switches (Next/Prev track traversal)
  const handleNextTrack = () => {
    const queue = playbackQueueRef.current.length > 0 ? playbackQueueRef.current : filteredSongsRef.current;
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentPlayingRef.current?.id);
    
    let nextSong = null;
    if (currentIndex === -1) {
      nextSong = queue.find(s => s.audio_url);
    } else {
      for (let i = 1; i <= queue.length; i++) {
        const idx = (currentIndex + i) % queue.length;
        if (queue[idx].audio_url) {
          nextSong = queue[idx];
          break;
        }
      }
    }

    if (nextSong) {
      playSongDirectly(nextSong, queue);
    } else {
      showNotification("No more playable songs in the current queue.", "info");
    }
  };

  const handlePrevTrack = () => {
    const queue = playbackQueueRef.current.length > 0 ? playbackQueueRef.current : filteredSongsRef.current;
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentPlayingRef.current?.id);
    if (currentIndex === -1) return;

    let prevSong = null;
    for (let i = 1; i <= queue.length; i++) {
      const idx = (currentIndex - i + queue.length) % queue.length;
      if (queue[idx].audio_url) {
        prevSong = queue[idx];
        break;
      }
    }

    if (prevSong) {
      playSongDirectly(prevSong, queue);
    }
  };

  const playSongDirectly = (song, queue = null) => {
    setCurrentPlaying(song);
    setIsPlaying(true);
    if (queue) {
      setPlaybackQueue(queue);
    }
    const audio = audioRef.current;
    const playUrl = song.audio_url.startsWith('http') 
      ? song.audio_url 
      : `${API_URL}${song.audio_url}`;
    audio.src = playUrl;
    audio.load();
    audio.play().catch(err => console.error("Error playing audio:", err));
  };

  const handlePlayerPlayPause = () => {
    if (!currentPlaying) return;
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(err => console.error("Error playing audio:", err));
      setIsPlaying(true);
    }
  };

  // Keep references updated on every render to ensure event listeners always access the latest values
  currentPlayingRef.current = currentPlaying;
  playbackQueueRef.current = playbackQueue;
  filteredSongsRef.current = filteredSongs;
  handleNextTrackRef.current = handleNextTrack;
  handlePrevTrackRef.current = handlePrevTrack;

  const handleSeekChange = (e) => {
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setAudioProgress(newTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    localStorage.setItem('museai_volume', newVolume);
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Favorites Toggle API Call
  const handleLikeToggle = async (song) => {
    if (!token) {
      setAuthError(null);
      setAuthSuccess(null);
      setAuthMessage('You must be logged in to favorite songs.');
      setAuthForm({ username: '', email: '', password: '' });
      setAuthModal('login');
      return;
    }

    const isFav = !!likedSongs[song.id];

    try {
      if (isFav) {
        const response = await fetch(`${API_URL}/favorites/${song.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          handleLogout();
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to remove favorite');
        }

        setFavorites((prev) => prev.filter((fav) => fav.id !== song.id));
      } else {
        const response = await fetch(`${API_URL}/favorites/${song.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          handleLogout();
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to add favorite');
        }

        setFavorites((prev) => [...prev, song]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getGradientClass = (id) => {
    return GRADIENTS[(id - 1) % GRADIENTS.length];
  };

  // Header dynamic banner text
  const getBannerInfo = () => {
    switch (currentView) {
      case 'favorites':
        return {
          badge: 'My Library',
          title: 'Your Music Oasis.',
          desc: 'Revisit the melodies that move you. All your hand-picked favorites in one synchronized personal catalog.'
        };
      case 'recommendations':
        return {
          badge: 'AI Engine',
          title: 'Curated for you by MuseAI.',
          desc: 'Personalized content-based recommendations calculated via TF-IDF vector similarity on your favorite tracks.'
        };
      case 'explore':
      default:
        return {
          badge: 'Phase 7 Enabled',
          title: 'Discover your next favorite melody.',
          desc: 'Connect the frontend instantly with your custom FastAPI endpoint. Search through artists, toggle genre chips, and see reactive UI states.'
        };
    }
  };

  const bannerInfo = getBannerInfo();

  return (
    <div className="min-h-screen bg-[#0B0D19] bg-gradient-radial from-[#15192E] via-[#0B0D19] to-[#05060C] text-white pb-28">
      {/* Header / Navigation */}
      <header className="border-b border-white/5 bg-[#0B0D19]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('explore')}>
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20">
              <Sparkles className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-purple-200 to-pink-300 bg-clip-text text-transparent">
                MuseAI
              </h1>
              <p className="text-[10px] text-brand-textMuted uppercase font-semibold tracking-wider">
                Recommendation Engine
              </p>
            </div>
          </div>

          {/* Right corner User Authentication Section */}
          <div className="flex items-center space-x-6">
            {token && user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-[#15192E]/90 border border-white/5 px-3.5 py-1.5 rounded-2xl shadow-inner">
                  <div className="p-1 bg-purple-500/20 rounded-lg text-purple-300">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-purple-200">@{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1.5 px-4 py-2 border border-white/5 hover:border-rose-500/30 hover:bg-rose-500/10 text-brand-textMuted hover:text-rose-400 rounded-2xl text-xs font-semibold transition-all duration-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthMessage(null);
                    setAuthForm({ username: '', email: '', password: '' });
                    setAuthModal('login');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-brand-textMuted hover:text-white transition-all"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setAuthError(null);
                    setAuthSuccess(null);
                    setAuthMessage(null);
                    setAuthForm({ username: '', email: '', password: '' });
                    setAuthModal('register');
                  }}
                  className="px-5 py-2.5 bg-gradient-to-tr from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 transition-all rounded-2xl text-xs font-semibold shadow-lg shadow-purple-600/20"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl mb-10 bg-gradient-to-r from-purple-900/40 to-indigo-950/40 border border-white/5 p-8 md:p-12">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute left-1/3 bottom-0 -mb-10 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10 max-w-xl">
            <span className="text-xs text-purple-400 font-bold uppercase tracking-wider bg-purple-950/60 border border-purple-800/40 px-3 py-1 rounded-full">
              {bannerInfo.badge}
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold mt-4 mb-3 tracking-tight text-white leading-tight">
              {bannerInfo.title}
            </h2>
            <p className="text-sm md:text-base text-brand-textMuted leading-relaxed">
              {bannerInfo.desc}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 mb-8">
          <button
            onClick={() => {
              setCurrentView('explore');
              setSelectedGenre('All');
            }}
            className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all duration-300 ${
              currentView === 'explore' ? 'border-purple-500 text-white' : 'border-transparent text-brand-textMuted hover:text-white'
            }`}
          >
            Explore Catalog
          </button>
          <button
            onClick={() => {
              if (!token) {
                setAuthError(null);
                setAuthSuccess(null);
                setAuthMessage('Please log in to view your favorites library.');
                setAuthForm({ username: '', email: '', password: '' });
                setAuthModal('login');
              } else {
                setCurrentView('favorites');
                setSelectedGenre('All');
              }
            }}
            className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all duration-300 relative ${
              currentView === 'favorites' ? 'border-purple-500 text-white' : 'border-transparent text-brand-textMuted hover:text-white'
            }`}
          >
            My Favorites
            {token && favorites.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-[10px] bg-purple-600/90 text-white rounded-full font-bold shadow-inner">
                {favorites.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              if (!token) {
                setAuthError(null);
                setAuthSuccess(null);
                setAuthMessage('Please log in to view your AI recommendations.');
                setAuthForm({ username: '', email: '', password: '' });
                setAuthModal('login');
              } else {
                setCurrentView('recommendations');
                setSelectedGenre('All');
              }
            }}
            className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all duration-300 ${
              currentView === 'recommendations' ? 'border-purple-500 text-white' : 'border-transparent text-brand-textMuted hover:text-white'
            }`}
          >
            Recommended for You
          </button>
        </div>

        {/* Filters and Search Bar Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-textMuted" />
            <input
              type="text"
              placeholder={
                currentView === 'favorites'
                  ? "Search in favorites..."
                  : currentView === 'recommendations'
                  ? "Search recommendations..."
                  : "Search by song name or artist..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#15192E]/70 border border-white/5 rounded-2xl focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/60 placeholder:text-brand-textMuted text-sm transition-all"
            />
          </div>

          {/* Genre Filters Scroll */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedGenre === genre
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-[#15192E]/60 border-white/5 text-brand-textMuted hover:text-white hover:bg-[#242B4C]'
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid / Loading / Empty States */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Disc className="h-12 w-12 text-purple-500 animate-spin mb-4" />
            <p className="text-brand-textMuted text-sm">Loading tracks from FastAPI server...</p>
          </div>
        ) : error ? (
          <div className="glass-card rounded-2xl border-rose-500/20 p-8 text-center max-w-lg mx-auto">
            <p className="text-rose-400 font-medium mb-3">Connection Error</p>
            <p className="text-brand-textMuted text-xs mb-6">{error}</p>
            <button
              onClick={fetchSongs}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 transition-colors rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20"
            >
              Retry Connection
            </button>
          </div>
        ) : currentView === 'favorites' && favorites.length === 0 ? (
          <div className="text-center py-20 border border-white/5 rounded-3xl bg-[#15192E]/20">
            <Heart className="h-12 w-12 text-brand-textMuted/40 mx-auto mb-4" />
            <p className="text-brand-textMuted text-sm mb-1">Your Favorites list is empty.</p>
            <p className="text-xs text-brand-textMuted/60 mb-6">Explore the main catalog and tap the heart icon on songs you enjoy.</p>
            <button
              onClick={() => setCurrentView('explore')}
              className="px-5 py-2.5 bg-[#242B4C] hover:bg-[#2e3760] transition-colors rounded-xl text-xs font-semibold"
            >
              Browse Catalog
            </button>
          </div>
        ) : currentView === 'recommendations' && favorites.length === 0 ? (
          <div className="text-center py-20 border border-white/5 rounded-3xl bg-[#15192E]/20 max-w-xl mx-auto px-6">
            <Sparkles className="h-12 w-12 text-brand-textMuted/40 mx-auto mb-4" />
            <p className="text-brand-textMuted text-sm mb-2 font-semibold">AI Recommendation Engine Inactive</p>
            <p className="text-xs text-brand-textMuted/70 leading-relaxed mb-6">
              MuseAI dynamically vectorizes songs and calculates mathematical similarities using your favorite list as seed data. Please add at least one song to your favorites list to generate recommendation profiles.
            </p>
            <button
              onClick={() => setCurrentView('explore')}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 transition-colors rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20"
            >
              Go to Explore
            </button>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-20">
            <Music className="h-12 w-12 text-brand-textMuted/40 mx-auto mb-4" />
            <p className="text-brand-textMuted text-sm mb-1">No songs found.</p>
            <p className="text-xs text-brand-textMuted/60">Try adjusting your filter settings or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredSongs.map((song) => {
              const isCurrent = currentPlaying?.id === song.id;
              const isLiked = !!likedSongs[song.id];
              return (
                <div
                  key={song.id}
                  className="glass-card glass-card-hover rounded-2xl p-4 flex flex-col group relative animate-[scaleUp_0.3s_ease-out]"
                >
                  {/* Album Cover Art Mock */}
                  <div className={`relative aspect-square rounded-xl bg-gradient-to-tr ${getGradientClass(song.id)} mb-4 overflow-hidden shadow-inner flex items-center justify-center`}>
                    <Music className="h-10 w-10 text-white/30 group-hover:scale-90 transition-transform duration-300" />
                    
                    {/* Playability Badge indicators */}
                    {song.audio_url ? (
                      <span className="absolute top-2.5 left-2.5 text-[8px] font-bold bg-emerald-500/80 text-[#05060C] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Playable
                      </span>
                    ) : (
                      <span className="absolute top-2.5 left-2.5 text-[8px] font-medium bg-[#15192E]/60 text-brand-textMuted px-2 py-0.5 rounded-full border border-white/5 uppercase tracking-wider">
                        No Preview
                      </span>
                    )}

                    {/* Hover Overlay Play Button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                      {song.audio_url ? (
                        <button
                          onClick={() => handlePlayToggle(song)}
                          className="p-3.5 bg-white text-[#0B0D19] rounded-full hover:scale-110 active:scale-95 transition-transform duration-200 shadow-xl"
                        >
                          {isCurrent && isPlaying ? (
                            <Pause className="h-5 w-5 fill-current" />
                          ) : (
                            <Play className="h-5 w-5 fill-current ml-0.5" />
                          )}
                        </button>
                      ) : (
                        <div className="px-3 py-1.5 bg-black/80 border border-white/10 rounded-xl text-[10px] font-semibold text-brand-textMuted/80 tracking-wider">
                          Sample Unavailable
                        </div>
                      )}
                    </div>

                    {/* Active Equalizer animation when playing */}
                    {isCurrent && isPlaying && (
                      <div className="absolute bottom-3 right-3 bg-black/60 px-2 py-1.5 rounded-md flex items-end space-x-0.5">
                        <div className="w-0.5 h-3 bg-purple-400 animate-[bounce_0.8s_infinite]"></div>
                        <div className="w-0.5 h-4 bg-purple-400 animate-[bounce_0.5s_infinite]"></div>
                        <div className="w-0.5 h-2.5 bg-purple-400 animate-[bounce_1s_infinite]"></div>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate group-hover:text-purple-300 transition-colors">
                      {song.title}
                    </h3>
                    <p className="text-xs text-brand-textMuted truncate mt-0.5">
                      {song.artist}
                    </p>
                    {(song.album || song.year) && (
                      <p className="text-[10px] text-brand-textMuted/60 truncate mt-1">
                        {song.album ? `${song.album}` : ''} {song.year ? `• ${song.year}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Badges / Likes */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <span className="text-[10px] font-medium text-purple-300 bg-purple-950/40 border border-purple-900/30 px-2 py-0.5 rounded-md">
                      {song.genre}
                    </span>
                    <button
                      onClick={() => handleLikeToggle(song)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isLiked 
                          ? 'text-rose-500 bg-rose-500/10' 
                          : 'text-brand-textMuted hover:text-rose-500 hover:bg-rose-500/5'
                      }`}
                    >
                      <Heart className={`h-4.5 w-4.5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Active Player Bar */}
      {currentPlaying && (
        <div className="fixed bottom-6 left-6 right-6 md:left-12 md:right-12 glass-card rounded-2xl border border-white/10 px-6 py-4 flex items-center justify-between shadow-2xl z-40 animate-[slideUp_0.4s_ease-out]">
          {/* Song Info */}
          <div className="flex items-center space-x-3 w-1/3 min-w-[150px]">
            <div className={`h-11 w-11 rounded-lg bg-gradient-to-tr ${getGradientClass(currentPlaying.id)} flex items-center justify-center flex-shrink-0`}>
              <Disc className={`h-5 w-5 text-white/80 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold truncate">{currentPlaying.title}</h4>
              <p className="text-[10px] text-brand-textMuted truncate">{currentPlaying.artist}</p>
            </div>
          </div>

          {/* Player Controls (HTML5 Audio Backed) */}
          <div className="flex flex-col items-center w-1/3">
            <div className="flex items-center space-x-4">
              <button 
                onClick={handlePrevTrack}
                className="text-brand-textMuted hover:text-white transition-colors"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={handlePlayerPlayPause}
                className="p-2.5 bg-white text-[#0B0D19] rounded-full hover:scale-105 active:scale-95 transition-transform"
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
              </button>
              <button 
                onClick={handleNextTrack}
                className="text-brand-textMuted hover:text-white transition-colors"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
            {/* Play progress seek bar */}
            <div className="w-full max-w-[280px] flex items-center space-x-2 mt-2">
              <span className="text-[9px] text-brand-textMuted">{formatTime(audioProgress)}</span>
              <input
                type="range"
                min="0"
                max={audioDuration || 100}
                value={audioProgress}
                onChange={handleSeekChange}
                className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500 focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #A855F7 0%, #A855F7 ${(audioProgress / (audioDuration || 1)) * 100}%, rgba(255,255,255,0.1) ${(audioProgress / (audioDuration || 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <span className="text-[9px] text-brand-textMuted">{formatTime(audioDuration)}</span>
            </div>
          </div>

          {/* Volume control slider */}
          <div className="flex items-center justify-end space-x-2 w-1/3 text-brand-textMuted">
            <Volume2 className="h-4 w-4 flex-shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500 focus:outline-none hidden sm:block"
              style={{
                background: `linear-gradient(to right, #A855F7 0%, #A855F7 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%, rgba(255,255,255,0.1) 100%)`
              }}
            />
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      {authModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {/* Modal Container */}
          <div className="glass-card rounded-3xl p-8 max-w-md w-full border border-white/10 relative shadow-2xl transform scale-100 transition-all duration-300">
            {/* Close Button */}
            <button
              onClick={() => {
                setAuthModal(null);
                setAuthError(null);
                setAuthSuccess(null);
                setAuthMessage(null);
              }}
              className="absolute right-6 top-6 p-1.5 text-brand-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <h3 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                {authModal === 'login' ? 'Welcome Back' : 'Create Account'}
              </h3>
              <p className="text-xs text-brand-textMuted mt-1">
                {authModal === 'login'
                  ? 'Access your favorite tunes and custom recommendations.'
                  : 'Join MuseAI to build your custom recommendations profile.'}
              </p>
            </div>

            {/* Notification/Information Banner */}
            {authMessage && (
              <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-3 mb-4 text-purple-200 text-xs flex items-start space-x-2">
                <Sparkles className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>{authMessage}</span>
              </div>
            )}

            {/* Error Message */}
            {authError && (
              <div className="bg-rose-950/30 border border-rose-900/40 rounded-xl p-3 mb-4 text-rose-300 text-xs">
                {authError}
              </div>
            )}

            {/* Success Message */}
            {authSuccess && (
              <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-3 mb-4 text-emerald-300 text-xs flex items-center space-x-2">
                <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>{authSuccess}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-textMuted mb-2 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-textMuted" />
                  <input
                    type="text"
                    required
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    placeholder="Enter your username"
                    className="w-full pl-11 pr-4 py-3 bg-[#15192E]/60 border border-white/5 rounded-xl focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/60 placeholder:text-brand-textMuted/60 text-sm text-white"
                  />
                </div>
              </div>

              {authModal === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-brand-textMuted mb-2 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-textMuted" />
                    <input
                      type="email"
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="Enter your email"
                      className="w-full pl-11 pr-4 py-3 bg-[#15192E]/60 border border-white/5 rounded-xl focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/60 placeholder:text-brand-textMuted/60 text-sm text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-brand-textMuted mb-2 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-textMuted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    placeholder={authModal === 'login' ? '••••••••' : 'At least 6 characters'}
                    className="w-full pl-11 pr-12 py-3 bg-[#15192E]/60 border border-white/5 rounded-xl focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/60 placeholder:text-brand-textMuted/60 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-textMuted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 mt-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-purple-600/20 active:scale-98 flex items-center justify-center space-x-2"
              >
                {authLoading ? (
                  <Disc className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <span>{authModal === 'login' ? 'Login' : 'Create Account'}</span>
                )}
              </button>
            </form>

            {/* Switch Mode Footer */}
            <div className="mt-6 text-center border-t border-white/5 pt-4 text-xs text-brand-textMuted">
              {authModal === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthError(null);
                      setAuthSuccess(null);
                      setAuthMessage(null);
                      setAuthForm({ username: '', email: '', password: '' });
                      setAuthModal('register');
                    }}
                    className="text-purple-400 font-semibold hover:text-purple-300 hover:underline transition-colors"
                  >
                    Sign up free
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthError(null);
                      setAuthSuccess(null);
                      setAuthMessage(null);
                      setAuthForm({ username: '', email: '', password: '' });
                      setAuthModal('login');
                    }}
                    className="text-purple-400 font-semibold hover:text-purple-300 hover:underline transition-colors"
                  >
                    Log in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {playbackNotification && (
        <div className="fixed top-6 right-6 z-50 animate-[slideIn_0.3s_ease-out] max-w-sm w-full bg-[#15192E]/90 border border-white/10 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-start space-x-3">
          <div className={`p-2 rounded-xl flex-shrink-0 ${
            playbackNotification.type === 'error' ? 'bg-rose-500/20 text-rose-400' :
            playbackNotification.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
            playbackNotification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
            'bg-purple-500/20 text-purple-400'
          }`}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white">
              {playbackNotification.type === 'error' ? 'System Notice' : 'Notification'}
            </h4>
            <p className="text-[11px] text-brand-textMuted mt-0.5 leading-relaxed">
              {playbackNotification.message}
            </p>
          </div>
          <button
            onClick={() => setPlaybackNotification(null)}
            className="text-brand-textMuted hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
