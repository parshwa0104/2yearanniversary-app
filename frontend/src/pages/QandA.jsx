import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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
  const startDate = new Date('2024-08-15T00:00:00');
  const diffDays = Math.floor(Math.abs(today - startDate) / (1000 * 60 * 60 * 24));
  const currentQIndex = diffDays % questions.length;
  
  const currentQ = questions[currentQIndex];
  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';

  useEffect(() => {
    // Listen for current question answers
    const todayStr = today.toLocaleDateString('en-CA');
    // Using both question ID and today's date so answers don't carry over if questions loop
    const docId = `q_${currentQ.id}_${todayStr}`;
    
    const unsub = onSnapshot(doc(db, "qanda", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[role]) {
          setMyAnswer(data[role]);
          setSubmitted(true);
        } else {
          setMyAnswer('');
          setSubmitted(false);
        }
        if (data[partnerRole]) {
          setPartnerAnswer(data[partnerRole]);
        } else {
          setPartnerAnswer('');
        }
      } else {
        setMyAnswer('');
        setPartnerAnswer('');
        setSubmitted(false);
      }
    });
    return () => unsub();
  }, [currentQ.id, today.toLocaleDateString('en-CA')]);

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
        <h2 className="section-title">Question of the day</h2>
        <span className="editorial-meta">Daily Prompt</span>
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
    </div>
  );
};

export default QandA;
