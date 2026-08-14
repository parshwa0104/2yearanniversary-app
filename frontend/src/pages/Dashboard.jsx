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
  const [daysTogether, setDaysTogether] = useState(0);
  const [jarMessage, setJarMessage] = useState('');
  
  const [reasons, setReasons] = useState(defaultReasons);
  const [isEditingJar, setIsEditingJar] = useState(false);
  const [editedReasonsText, setEditedReasonsText] = useState('');

  useEffect(() => {
    // Start date: 7th September 2024
    const startDate = new Date('2024-09-07T00:00:00');
    const calculateDays = () => {
      const now = new Date();
      const diffTime = now - startDate;
      const diffDays = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
      setDaysTogether(diffDays);
    };

    calculateDays();
    const timer = setInterval(calculateDays, 1000 * 60 * 60);
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
        <span className="days-number">{daysTogether}</span>
        <span className="days-label">Days together</span>
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
