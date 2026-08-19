import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, HeartHandshake, CalendarHeart, Sparkles, User, Play, Pause } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import Dashboard from './pages/Dashboard';
import Connect from './pages/Connect';
import Dates from './pages/Dates';
import Fun from './pages/Fun';
import Profile from './pages/Profile';
import LockScreen from './pages/LockScreen';
import Quiz from './pages/Quiz';
import Chat from './pages/Chat';
import './App.css';

const Navigation = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="bottom-nav">
      <div className="nav-inner">
        <Link to="/" className={`nav-item ${isActive('/')}`}>
          <Home size={22} strokeWidth={1.5} />
          <span>Home</span>
        </Link>
        <Link to="/connect" className={`nav-item ${isActive('/connect')}`}>
          <HeartHandshake size={22} strokeWidth={1.5} />
          <span>Connect</span>
        </Link>
        <Link to="/dates" className={`nav-item ${isActive('/dates')}`}>
          <CalendarHeart size={22} strokeWidth={1.5} />
          <span>Story</span>
        </Link>
        <Link to="/fun" className={`nav-item ${isActive('/fun')}`}>
          <Sparkles size={22} strokeWidth={1.5} />
          <span>Fun</span>
        </Link>
        <Link to="/profile" className={`nav-item ${isActive('/profile')}`}>
          <User size={22} strokeWidth={1.5} />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
};

const PLAYLIST = [
  '/Beloved(chosic.com).mp3',
  '/scott-buckley-reverie(chosic.com).mp3',
  '/Warm-Memories-Emotional-Inspiring-Piano(chosic.com).mp3',
  '/Winter-Long-Version(chosic.com).mp3'
];

const MainLayout = ({ musicPlaying, setMusicPlaying }) => {
  const location = useLocation();
  const isChat = location.pathname === '/chat';

  return (
    <div className="app-container" style={isChat ? { paddingBottom: 0, height: '100dvh', overflow: 'hidden' } : {}}>
      {!isChat && (
        <header className="app-header">
          <div className="logo">
            <span className="brand-name">Parshwa & Diya</span>
          </div>
          <button 
            className="music-toggle"
            onClick={() => setMusicPlaying(!musicPlaying)}
            title={musicPlaying ? "Pause Music" : "Play Music"}
          >
            {musicPlaying ? <Pause size={18} strokeWidth={1.5} /> : <Play size={18} strokeWidth={1.5} />}
          </button>
        </header>
      )}

      <main className={`main-content ${!isChat ? 'container' : ''}`} style={isChat ? { padding: 0 } : {}}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/dates" element={<Dates />} />
          <Route path="/fun" element={<Fun />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/quiz" element={<Quiz />} />
        </Routes>
      </main>

      {!isChat && <Navigation />}
    </div>
  );
};

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audio] = useState(new Audio(PLAYLIST[0]));

  useEffect(() => {
    // Listen to actual Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLocked(false);
      } else {
        setIsLocked(true);
      }
      setAuthChecked(true);
    });
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleEnded = () => {
      setCurrentTrackIndex(prev => (prev + 1) % PLAYLIST.length);
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [audio]);

  useEffect(() => {
    // Prevent double play by checking if the source actually changed
    if (!audio.src.endsWith(PLAYLIST[currentTrackIndex])) {
      audio.src = PLAYLIST[currentTrackIndex];
      if (musicPlaying) {
        audio.play().catch(e => console.error("Audio play failed:", e));
      }
    }
  }, [currentTrackIndex, audio, musicPlaying]);

  useEffect(() => {
    if (musicPlaying) {
      audio.play().catch(e => console.error("Audio play failed:", e));
    } else {
      audio.pause();
    }
  }, [musicPlaying, audio]);

  const handleUnlock = () => {
    // Firebase auth is already triggered in LockScreen, but we can optimistically unlock
    setIsLocked(false);
  };

  // Wait for Firebase to check local indexedDB auth tokens before flashing lock screen
  if (!authChecked) {
    return <div className="app-container" style={{background: 'var(--bg-deep)'}}></div>;
  }

  if (isLocked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  return (
    <Router>
      <MainLayout musicPlaying={musicPlaying} setMusicPlaying={setMusicPlaying} />
    </Router>
  );
}

export default App;
