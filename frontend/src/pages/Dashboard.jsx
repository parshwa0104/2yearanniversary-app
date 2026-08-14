import { useState, useEffect } from 'react';
import { Edit2, Check } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './Dashboard.css';

const defaultReasons = [
  "I love your laugh, Tingu.",
  "You always know how to make me smile.",
  "Because you are my best friend.",
  "I love the way we can talk about absolutely nothing for hours."
];

const Dashboard = () => {
  const [timeTogether, setTimeTogether] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [jarMessage, setJarMessage] = useState('');
  
  const [reasons, setReasons] = useState(defaultReasons);
  const [isEditingJar, setIsEditingJar] = useState(false);
  const [editedReasonsText, setEditedReasonsText] = useState('');

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
        <span className="days-number">{timeTogether.days}</span>
        <span className="days-label">Days together</span>
        
        <div className="time-details animate-fade-in">
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
            <span className="item-meta">0 Days Streak</span>
          </li>
          <li className="elegant-item">
            <span className="item-name">Daily Question</span>
            <span className="item-meta">0 Days Streak</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
