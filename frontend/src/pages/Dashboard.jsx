import { useState, useEffect } from 'react';
import { Edit2, Check } from 'lucide-react';
import { doc, onSnapshot, setDoc, collection, query } from 'firebase/firestore';
import { db } from '../firebase';
import './Dashboard.css';

const defaultReasons = [
  "I love your laugh, Tingu.",
  "You always know how to make me smile.",
  "Because you are my best friend.",
  "I love the way we can talk about absolutely nothing for hours."
];

const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'loved', emoji: '🥰', label: 'Loved' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'angry', emoji: '😡', label: 'Angry' },
  { id: 'stressed', emoji: '🤯', label: 'Stressed' }
];

const Dashboard = () => {
  const [timeTogether, setTimeTogether] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [jarMessage, setJarMessage] = useState('');
  
  const [reasons, setReasons] = useState(defaultReasons);
  const [isEditingJar, setIsEditingJar] = useState(false);
  const [editedReasonsText, setEditedReasonsText] = useState('');

  const [myMood, setMyMood] = useState(null);
  const [partnerMood, setPartnerMood] = useState(null);
  const [isNudgeCooldown, setIsNudgeCooldown] = useState(false);

  const [photoStreak, setPhotoStreak] = useState(0);
  const [qaStreak, setQaStreak] = useState(0);

  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';

  useEffect(() => {
    // Start date: 15th August 2024
    const startDate = new Date('2024-08-15T00:00:00');
    
    const updateTimer = () => {
      const now = new Date();
      const diffTime = now - startDate;
      
      if (diffTime > 0) {
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffTime / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diffTime / 1000 / 60) % 60);
        const seconds = Math.floor((diffTime / 1000) % 60);
        setTimeTogether({ days, hours, minutes, seconds });
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appData", "reasons"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().list) {
        setReasons(docSnap.data().list);
        setEditedReasonsText(docSnap.data().list.join('\n'));
      } else {
        setEditedReasonsText(defaultReasons.join('\n'));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appData", "moods"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[role]) setMyMood(data[role]);
        if (data[partnerRole]) setPartnerMood(data[partnerRole]);
      }
    });
    return () => unsub();
  }, [role, partnerRole]);

  useEffect(() => {
    const unsubDrops = onSnapshot(query(collection(db, "dailyDrops")), (snapshot) => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const todayDoc = docs.find(d => d.id === todayStr);

      let currentStreak = 0;
      let checkDate = new Date();
      
      if (todayDoc && todayDoc['parshwa'] && todayDoc['diya']) {
        currentStreak += 1;
      }
      checkDate.setDate(checkDate.getDate() - 1);
      
      while (true) {
        const histDayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        const histDoc = docs.find(h => h.id === histDayStr);
        if (histDoc && histDoc['parshwa'] && histDoc['diya']) {
          currentStreak += 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      setPhotoStreak(currentStreak);
    });

    const unsubQa = onSnapshot(query(collection(db, "qanda")), (snapshot) => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const docs = snapshot.docs.map(d => {
        const parts = d.id.split('_');
        return { dateStr: parts[parts.length - 1], ...d.data() };
      });
      const todayDoc = docs.find(d => d.dateStr === todayStr);

      let currentStreak = 0;
      let checkDate = new Date();
      
      if (todayDoc && todayDoc['parshwa'] && todayDoc['diya']) {
        currentStreak += 1;
      }
      checkDate.setDate(checkDate.getDate() - 1);
      
      while (true) {
        const histDayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        const histDoc = docs.find(h => h.dateStr === histDayStr);
        if (histDoc && histDoc['parshwa'] && histDoc['diya']) {
          currentStreak += 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      setQaStreak(currentStreak);
    });

    return () => {
      unsubDrops();
      unsubQa();
    };
  }, []);

  const handleMoodSelect = async (moodId) => {
    try {
      await setDoc(doc(db, "appData", "moods"), {
        [role]: moodId
      }, { merge: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleNudge = async () => {
    if (isNudgeCooldown) return;
    setIsNudgeCooldown(true);
    setTimeout(() => setIsNudgeCooldown(false), 60000); // 60 sec cooldown

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    try {
      await fetch(`${BACKEND_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: role,
          title: "Thinking of You ❤️",
          body: `${role === 'parshwa' ? 'Parshwa' : 'Diya'} is thinking about you right now!`
        })
      });
    } catch (err) {
      console.error("Nudge failed:", err);
    }
  };

  const openJar = () => {
    if (isEditingJar || reasons.length === 0) return;
    setJarMessage(reasons[Math.floor(Math.random() * reasons.length)]);
  };

  const handleSaveReasons = async () => {
    const newReasons = editedReasonsText.split('\n').filter(r => r.trim() !== '');
    setIsEditingJar(false);
    try {
      await setDoc(doc(db, "appData", "reasons"), { list: newReasons });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-container dashboard">
      <div className="days-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <span className="days-number">{timeTogether.days}</span>
            <span className="days-label">Days together</span>
            
            <div className="time-details animate-fade-in" style={{ justifyContent: 'flex-start' }}>
              <div className="time-unit">
                <span className="time-val">{timeTogether.hours}</span>
                <span className="time-lbl">hrs</span>
              </div>
              <div className="time-sep">:</div>
              <div className="time-unit">
                <span className="time-val">{timeTogether.minutes}</span>
                <span className="time-lbl">min</span>
              </div>
              <div className="time-sep">:</div>
              <div className="time-unit">
                <span className="time-val">{timeTogether.seconds}</span>
                <span className="time-lbl">sec</span>
              </div>
            </div>
          </div>
          
          <button 
            className="nudge-btn animate-fade-in" 
            onClick={handleNudge}
            disabled={isNudgeCooldown}
          >
            {isNudgeCooldown ? 'Sent!' : 'Nudge ❤️'}
          </button>
        </div>
      </div>

      <div className="mood-ring-section animate-fade-in">
        <div className="mood-display">
          <div className="mood-partner">
            <span className="mood-name">{partnerRole === 'parshwa' ? 'Parshwa' : 'Diya'}'s Mood</span>
            <div className="mood-emoji-big">
              {partnerMood ? MOODS.find(m => m.id === partnerMood)?.emoji : '❔'}
            </div>
          </div>
          <div className="mood-divider"></div>
          <div className="mood-me">
            <span className="mood-name">Your Mood</span>
            <div className="mood-emoji-big">
              {myMood ? MOODS.find(m => m.id === myMood)?.emoji : '❔'}
            </div>
          </div>
        </div>
        
        <div className="mood-selector">
          {MOODS.map(m => (
            <button 
              key={m.id} 
              className={`mood-btn ${myMood === m.id ? 'active' : ''}`}
              onClick={() => handleMoodSelect(m.id)}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="jar-wrapper">
        <div className="jar-actions">
          {!isEditingJar ? (
            <button className="icon-btn" onClick={() => setIsEditingJar(true)} title="Edit Reasons">
              <Edit2 size={18} color="var(--text-blush)" />
            </button>
          ) : (
            <button className="icon-btn" onClick={handleSaveReasons} title="Save Reasons">
              <Check size={18} color="var(--accent-neon)" />
            </button>
          )}
        </div>

        {isEditingJar ? (
          <div className="jar-edit-mode animate-fade-in">
            <h3 className="edit-title">Edit Reasons</h3>
            <p className="edit-subtitle">One reason per line. (Syncs to cloud)</p>
            <textarea 
              className="reasons-textarea"
              value={editedReasonsText}
              onChange={(e) => setEditedReasonsText(e.target.value)}
              rows="10"
            />
          </div>
        ) : (
          <div className="jar-display animate-fade-in" onClick={openJar}>
            <div className="tactile-jar">
              <div className="jar-cork"></div>
              <div className="jar-glass">
                <div className="jar-label">Reasons</div>
                <div className="paper-slip p1"></div>
                <div className="paper-slip p2"></div>
                <div className="paper-slip p3"></div>
              </div>
            </div>
            <p className="jar-instruction">Tap the jar</p>
          </div>
        )}
      </div>

      {!isEditingJar && jarMessage && (
        <div className="pulled-reason animate-fade-in">
          "{jarMessage}"
        </div>
      )}

      <div className="tasks-section">
        <h2 className="section-title">For us today</h2>
        <ul className="elegant-list">
          <li className="elegant-item">
            <span className="item-name">Daily Photo Drop</span>
            <span className="item-meta">{photoStreak} {photoStreak === 1 ? 'Day' : 'Days'} Streak</span>
          </li>
          <li className="elegant-item">
            <span className="item-name">Daily Question</span>
            <span className="item-meta">{qaStreak} {qaStreak === 1 ? 'Day' : 'Days'} Streak</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
