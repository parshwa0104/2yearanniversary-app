import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection, query } from 'firebase/firestore';
import { db } from '../firebase';
import contentData from '../data/content.json';
import './QandA.css';

const questions = contentData.questions;

const QandA = () => {
  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Calculate question of the day based on date
  const today = new Date();
  const startDate = new Date('2026-08-15T00:00:00');
  const diffDays = Math.floor(Math.abs(today - startDate) / (1000 * 60 * 60 * 24));
  const currentQIndex = diffDays % questions.length;
  
  const currentQ = questions[currentQIndex];
  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';

  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(0);
  const [missingDaysCount, setMissingDaysCount] = useState(0);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appData", "stats"), (docSnap) => {
      if (docSnap.exists()) {
        setHearts(docSnap.data().hearts || 0);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "qanda"));
    const unsub = onSnapshot(q, (snapshot) => {
      let hist = [];
      snapshot.forEach(docSnap => {
        const parts = docSnap.id.split('_');
        if (parts.length >= 3) {
          const dateStr = parts.slice(2).join('_');
          hist.push({ id: dateStr, docId: docSnap.id, ...docSnap.data() });
        }
      });
      
      const todayStr = today.toLocaleDateString('en-CA');
      const todayDoc = hist.find(h => h.id === todayStr);

      if (todayDoc) {
        if (todayDoc[role]) {
          setMyAnswer(todayDoc[role]);
          setSubmitted(true);
        } else {
          setMyAnswer('');
          setSubmitted(false);
        }
        if (todayDoc[partnerRole]) {
          setPartnerAnswer(todayDoc[partnerRole]);
        } else {
          setPartnerAnswer('');
        }
      } else {
        setMyAnswer('');
        setPartnerAnswer('');
        setSubmitted(false);
      }

      let missingCount = 0;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      for (let d = new Date(startDate); d <= yesterday; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toLocaleDateString('en-CA');
        const histDoc = hist.find(h => h.id === dayStr);
        if (!histDoc || !histDoc['parshwa'] || !histDoc['diya']) {
          missingCount++;
        }
      }
      setMissingDaysCount(missingCount);

      let currentStreak = 0;
      let checkDate = new Date();
      
      if (todayDoc && todayDoc['parshwa'] && todayDoc['diya']) {
        currentStreak += 1;
      }
      checkDate.setDate(checkDate.getDate() - 1);
      
      while (true) {
        const histDayStr = checkDate.toLocaleDateString('en-CA');
        const histDoc = hist.find(h => h.id === histDayStr);
        if (histDoc && histDoc['parshwa'] && histDoc['diya']) {
          currentStreak += 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      setStreak(currentStreak);
      setHistory(hist);
    });
    return () => unsub();
  }, [currentQ.id, today.toLocaleDateString('en-CA')]);

  const handleRestoreStreak = async () => {
    if (hearts < missingDaysCount) return;
    setIsRestoring(true);
    try {
      await setDoc(doc(db, "appData", "stats"), { hearts: hearts - missingDaysCount }, { merge: true });
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      for (let d = new Date(startDate); d <= yesterday; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toLocaleDateString('en-CA');
        const histDoc = history.find(h => h.id === dayStr);
        
        let updated = false;
        const data = histDoc ? { ...histDoc } : {};
        const dummyAnswer = "Streak restored! ❤️";
        
        if (!data.parshwa) { data.parshwa = dummyAnswer; updated = true; }
        if (!data.diya) { data.diya = dummyAnswer; updated = true; }
        
        if (updated) {
          const dDiffDays = Math.floor(Math.abs(d - startDate) / (1000 * 60 * 60 * 24));
          const qIndex = dDiffDays % questions.length;
          const qId = questions[qIndex].id;
          
          const docId = `q_${qId}_${dayStr}`;
          const docRef = doc(db, 'qanda', docId);
          delete data.id;
          delete data.docId;
          await setDoc(docRef, data, { merge: true });
        }
      }
      setShowRestoreModal(false);
    } catch (e) {
      console.error(e);
    }
    setIsRestoring(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!myAnswer.trim()) return;
    
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const docId = `q_${currentQ.id}_${todayStr}`;
      
      await setDoc(doc(db, "qanda", docId), {
        [role]: myAnswer
      }, { merge: true });
      setSubmitted(true);

      // Check and award heart
      const { checkAndAwardHeart } = await import('../utils/heartAward');
      const awarded = await checkAndAwardHeart(role);
      if (awarded) {
        alert("❤️ +1 Heart! Thank you for remembering our love today.");
      }

      // Trigger Web Push Notification
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      fetch(`${BACKEND_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: role,
          title: "Question Answered! ✍️",
          body: `${role === 'parshwa' ? 'Parshwa' : 'Diya'} just answered today's question. Answer yours to see it!`
        })
      }).catch(err => console.error("Notification trigger failed:", err));

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="qa-section animate-fade-in">
      <div className="editorial-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Question of the day</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span className="editorial-meta" style={{ color: 'var(--text-blush)' }}>❤️ {hearts}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span className="editorial-meta">{streak} {streak === 1 ? 'Day' : 'Days'} Streak</span>
              {missingDaysCount > 0 && (
                <button 
                  onClick={() => setShowRestoreModal(true)}
                  style={{ background: 'rgba(255,126,179,0.1)', color: 'var(--text-blush)', border: '1px solid var(--border-plum)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px' }}
                >
                  Restore ({missingDaysCount} ❤️)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="qa-content">
        <h3 className="qa-question">{currentQ.text}</h3>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="qa-form">
            <textarea
              className="editorial-textarea"
              rows="2"
              placeholder="Your honest answer..."
              value={myAnswer}
              onChange={(e) => setMyAnswer(e.target.value)}
            />
            <div className="qa-actions">
              <button type="submit" className="editorial-text-btn" disabled={!myAnswer.trim()}>
                Save answer
              </button>
            </div>
          </form>
        ) : (
          <div className="qa-results animate-fade-in">
            <div className="answer-row">
              <span className="answer-author">{role === 'parshwa' ? 'Parshwa' : 'Diya'}</span>
              <p className="answer-text">{myAnswer}</p>
            </div>
            <div className={`answer-row ${!partnerAnswer ? 'waiting' : ''}`}>
              <span className="answer-author">{partnerRole === 'parshwa' ? 'Parshwa' : 'Diya'}</span>
              <p className="answer-text">{partnerAnswer || "Waiting for partner to answer..."}</p>
            </div>
          </div>
        )}
      </div>

      {showRestoreModal && (
        <div className="signature-modal-overlay" onClick={() => setShowRestoreModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="signature-letter" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-deep)', borderRadius: '16px', border: '1px solid var(--border-plum)', maxWidth: '300px' }}>
            <h3 style={{ color: 'var(--text-blush)', marginBottom: '16px', fontFamily: 'var(--font-display)' }}>Restore Streak?</h3>
            <p style={{ color: 'var(--text-pearl)', marginBottom: '24px', fontSize: '0.95rem' }}>
              You missed {missingDaysCount} {missingDaysCount === 1 ? 'day' : 'days'}. It will cost {missingDaysCount} ❤️ to restore your perfect streak since Aug 15, 2026.
            </p>
            {hearts >= missingDaysCount ? (
              <button 
                className="editorial-text-btn" 
                onClick={handleRestoreStreak}
                disabled={isRestoring}
                style={{ width: '100%' }}
              >
                {isRestoring ? 'Restoring...' : `Spend ${missingDaysCount} ❤️`}
              </button>
            ) : (
              <p style={{ color: '#ff3b30' }}>You don't have enough Hearts!</p>
            )}
            <button 
              onClick={() => setShowRestoreModal(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-pearl)', marginTop: '16px', fontSize: '0.85rem', cursor: 'pointer', opacity: 0.7 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QandA;
