import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './QandA.css';

const questions = [
  { id: 1, text: "What was your first impression of me?" },
  { id: 2, text: "What is your favorite memory of us together?" },
  { id: 3, text: "Where do you see us in 5 years?" },
  { id: 4, text: "What's the most annoying habit I have?" },
  { id: 5, text: "When did you realize you were falling for me?" },
  { id: 6, text: "What is a small thing I do that makes you smile?" },
  { id: 7, text: "If we could travel anywhere tomorrow, where would we go?" },
  { id: 8, text: "What's a goal you want us to achieve together this year?" },
  { id: 9, text: "What is your favorite physical feature of mine?" },
  { id: 10, text: "What song reminds you of us the most?" },
  { id: 11, text: "What is the funniest thing that has ever happened to us?" },
  { id: 12, text: "What's something you've always wanted to tell me but haven't?" },
  { id: 13, text: "If we had a whole weekend completely free, what would we do?" },
  { id: 14, text: "What is a meal I make (or we eat together) that you love the most?" },
  { id: 15, text: "What is one thing you admire about my personality?" },
  { id: 16, text: "If you had to describe our relationship in three words, what would they be?" },
  { id: 17, text: "What was your favorite date we’ve ever been on?" },
  { id: 18, text: "What is a habit you've picked up from me?" },
  { id: 19, text: "What is something I do that always makes you feel loved?" },
  { id: 20, text: "What was the exact moment you knew you loved me?" },
  { id: 21, text: "If we opened a business together, what would it be?" },
  { id: 22, text: "What is the best gift I’ve ever given you?" },
  { id: 23, text: "What is something you want us to do more often?" },
  { id: 24, text: "What is a movie or TV show that reminds you of us?" },
  { id: 25, text: "What is your favorite picture of us?" },
  { id: 26, text: "What is a challenge we overcame together that made us stronger?" },
  { id: 27, text: "If we were stranded on an island, who would survive longer and why?" },
  { id: 28, text: "What is the best compliment I’ve ever given you?" },
  { id: 29, text: "What is something I’ve taught you?" },
  { id: 30, text: "What are you most looking forward to in our future?" }
];

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
