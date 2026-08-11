
import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '@/lib/apiClient';
import { fetchMusicFiles, fetchOrInitMediaPlayerSettings, syncPlaybackState, updatePlaybackPosition, updateShuffleEnabled } from '@/lib/mediaPlayerAdapters';

export const useMediaPlayer = () => {
    const [playlist, setPlaylist] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isShuffle, setIsShuffle] = useState(() => localStorage.getItem('mp_shuffle') === 'true');
    const [isLoop, setIsLoop] = useState(() => localStorage.getItem('mp_loop') === 'true');
    const [isCrossfade, setIsCrossfade] = useState(() => localStorage.getItem('mp_crossfade') === 'true');
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [settingsId, setSettingsId] = useState(null);
    const audioRef = useRef(new Audio());
    const handleNextTrackRef = useRef(null);

    // Fetch Playlist
    const fetchPlaylist = useCallback(async () => {
        try {
            const tracks = await fetchMusicFiles();
            setPlaylist(tracks);
            setCurrentTrackIndex((prev) => (tracks.length > 0 && prev === -1 ? 0 : prev));
        } catch {
            setPlaylist([]);
            setCurrentTrackIndex(-1);
        }
    }, [currentTrackIndex]);

    useEffect(() => {
        fetchPlaylist();

        // Fetch saved settings
        const fetchSettings = async () => {
        const user = await apiClient.get('/api/auth/me').catch(() => null);
            if (!user) return;
            try {
                const settings = await fetchOrInitMediaPlayerSettings(user.id);
                if (settings) {
                    setSettingsId(settings.id);
                    if (settings.shuffle_enabled !== null) setIsShuffle(settings.shuffle_enabled);
                    if (settings.playback_position) {
                        audioRef.current.currentTime = settings.playback_position;
                        setProgress(settings.playback_position);
                    }
                }
            } catch { /* non-critical, silently ignore */ }
        };
        fetchSettings();

        // Audio Event Listeners
        const audio = audioRef.current;

        const updateProgress = () => {
            setProgress(audio.currentTime);
            setDuration(audio.duration || 0);
        };

        const handleEnded = () => {
            handleNextTrackRef.current?.(true);
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('loadedmetadata', updateProgress);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('loadedmetadata', updateProgress);
            audio.pause();
        };
    }, []);

    // Sync progress to DB periodically (throttled)
    useEffect(() => {
        const syncInterval = setInterval(() => {
            if (settingsId && isPlaying) {
                syncPlaybackState(settingsId, { position: progress, isPlaying });
            }
        }, 10000);
        return () => clearInterval(syncInterval);
    }, [progress, isPlaying, settingsId]);

    // Handle Playback Change
    useEffect(() => {
        const audio = audioRef.current;
        if (currentTrackIndex >= 0 && playlist[currentTrackIndex]) {
            const track = playlist[currentTrackIndex];
            if (audio.src !== track.file_url) {
                audio.src = track.file_url;
                audio.load();
                if (isPlaying) {
                    audio.play().catch(e => console.error("Play failed", e));
                }
            }
        }
    }, [currentTrackIndex, playlist]);

    // Handle Play/Pause State
    useEffect(() => {
        const audio = audioRef.current;
        if (currentTrackIndex >= 0 && playlist.length > 0) {
            if (isPlaying) {
                audio.play().catch(e => console.error("Play failed", e));
            } else {
                audio.pause();
            }
        }
    }, [isPlaying, currentTrackIndex]);

    // Handle Volume (for Crossfade or general use)
    useEffect(() => {
        audioRef.current.volume = volume;
    }, [volume]);

    const play = () => setIsPlaying(true);
    const pause = () => setIsPlaying(false);
    const togglePlay = () => setIsPlaying(!isPlaying);

    const seek = (time) => {
        audioRef.current.currentTime = time;
        setProgress(time);

        if (settingsId) {
            updatePlaybackPosition(settingsId, time);
        }
    };

    const handleNextTrack = (auto = false) => {
        if (playlist.length === 0) return;

        let nextIndex;
        if (isShuffle) {
            do {
                nextIndex = Math.floor(Math.random() * playlist.length);
            } while (playlist.length > 1 && nextIndex === currentTrackIndex);
        } else {
            nextIndex = currentTrackIndex + 1;
            if (nextIndex >= playlist.length) {
                if (isLoop) nextIndex = 0;
                else {
                    setIsPlaying(false);
                    return;
                }
            }
        }

        if (isCrossfade && auto) {
            const fadeOut = setInterval(() => {
                if (audioRef.current.volume > 0.1) {
                    audioRef.current.volume -= 0.1;
                } else {
                    clearInterval(fadeOut);
                    setCurrentTrackIndex(nextIndex);
                    audioRef.current.volume = 1;
                }
            }, 200);
        } else {
            setCurrentTrackIndex(nextIndex);
        }

        if (!isPlaying) setIsPlaying(true);
    };

    handleNextTrackRef.current = handleNextTrack;

    const previous = () => {
        if (playlist.length === 0) return;

        if (audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }

        let prevIndex;
        if (isShuffle) {
             do {
                prevIndex = Math.floor(Math.random() * playlist.length);
            } while (playlist.length > 1 && prevIndex === currentTrackIndex);
        } else {
            prevIndex = currentTrackIndex - 1;
            if (prevIndex < 0) prevIndex = playlist.length - 1;
        }

        setCurrentTrackIndex(prevIndex);
        if (!isPlaying) setIsPlaying(true);
    };

    const next = () => handleNextTrack(false);

    const toggleShuffle = () => {
        const newVal = !isShuffle;
        setIsShuffle(newVal);
        localStorage.setItem('mp_shuffle', newVal);
        if (settingsId) {
            updateShuffleEnabled(settingsId, newVal);
        }
    };

    const toggleLoop = () => {
        const newVal = !isLoop;
        setIsLoop(newVal);
        localStorage.setItem('mp_loop', newVal);
    };

    const toggleCrossfade = () => {
        const newVal = !isCrossfade;
        setIsCrossfade(newVal);
        localStorage.setItem('mp_crossfade', newVal);
    };

    return {
        currentTrack: playlist[currentTrackIndex],
        isPlaying,
        isShuffle,
        isLoop,
        isCrossfade,
        progress,
        duration,
        playlist,
        play,
        pause,
        togglePlay,
        next,
        previous,
        seek,
        toggleShuffle,
        toggleLoop,
        toggleCrossfade,
        refreshPlaylist: fetchPlaylist
    };
};
