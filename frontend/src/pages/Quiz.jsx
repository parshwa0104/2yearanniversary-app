import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { db } from '../firebase';
import contentData from '../data/content.json';
import './Quiz.css';

const quizQuestions = contentData.quizQuestions;

const Quiz = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [myAnswer, setMyAnswer] = useState(null);
  const [partnerAnswer, setPartnerAnswer] = useState(null);
  const [score, setScore] = useState({ matches: 0, total: 0 });

  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';

  const question = quizQuestions[currentIndex];

  useEffect(() => {
    if (!question) return;
    const docId = `quiz_${question.id}`;
    
    const unsub = onSnapshot(doc(db, "quiz", docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyAnswer(data[role] || null);
        setPartnerAnswer(data[partnerRole] || null);
      } else {
        setMyAnswer(null);
        setPartnerAnswer(null);
      }
    });

    return () => unsub();
  }, [currentIndex, question, role, partnerRole]);

  const handleSelect = async (option) => {
    if (myAnswer) return; // already answered
    
    const docId = `quiz_${question.id}`;
    try {
      await setDoc(doc(db, "quiz", docId), {
        [role]: option
      }, { merge: true });

      // Notify partner
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      fetch(`${BACKEND_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: role,
          title: "Quiz Time! 🎮",
          body: `${role === 'parshwa' ? 'Parshwa' : 'Diya'} locked in an answer. Can you match it?`
        })
      }).catch(e => console.error(e));

    } catch (err) {
      console.error(err);
    }
  };

  const handleNext = () => {
    // Update local score on next
    if (myAnswer && partnerAnswer) {
      setScore(prev => ({
        matches: prev.matches + (myAnswer === partnerAnswer ? 1 : 0),
        total: prev.total + 1
      }));
    }
    setCurrentIndex(prev => prev + 1);
  };

  if (!question) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <button className="back-btn" onClick={() => navigate('/fun')}>
            <ArrowLeft size={24} />
          </button>
          <h2>Quiz Complete!</h2>
        </div>
        <div className="quiz-content" style={{ textAlign: 'center', marginTop: '64px' }}>
          <h1 style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</h1>
          <h3 style={{ color: 'var(--text-pearl)', fontSize: '1.5rem', marginBottom: '8px' }}>
            Final Score: {score.matches} / {score.total} Matches
          </h3>
          <p style={{ color: 'var(--text-blush)' }}>
            {score.matches === score.total ? "A perfect match! Soulmates." : "You know each other pretty well!"}
          </p>
          <button className="editorial-text-btn" style={{ marginTop: '32px' }} onClick={() => navigate('/fun')}>
            Back to Fun
          </button>
        </div>
      </div>
    );
  }

  const bothAnswered = myAnswer && partnerAnswer;
  const isMatch = myAnswer === partnerAnswer;

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <button className="back-btn" onClick={() => navigate('/fun')}>
          <ArrowLeft size={24} />
        </button>
        <span className="quiz-progress">Question {currentIndex + 1} / {quizQuestions.length}</span>
      </div>

      <div className="quiz-content animate-fade-in">
        <h2 className="quiz-question">{question.question}</h2>

        <div className="quiz-options">
          <button 
            className={`quiz-option ${myAnswer === 'A' ? 'selected' : ''} ${bothAnswered && myAnswer !== 'A' ? 'faded' : ''}`}
            onClick={() => handleSelect('A')}
            disabled={!!myAnswer}
          >
            {question.optionA}
            {bothAnswered && partnerAnswer === 'A' && (
              <span className="partner-marker">{partnerRole === 'parshwa' ? 'P' : 'D'}</span>
            )}
            {bothAnswered && myAnswer === 'A' && (
              <span className="my-marker">You</span>
            )}
          </button>

          <div className="quiz-or">VS</div>

          <button 
            className={`quiz-option ${myAnswer === 'B' ? 'selected' : ''} ${bothAnswered && myAnswer !== 'B' ? 'faded' : ''}`}
            onClick={() => handleSelect('B')}
            disabled={!!myAnswer}
          >
            {question.optionB}
            {bothAnswered && partnerAnswer === 'B' && (
              <span className="partner-marker">{partnerRole === 'parshwa' ? 'P' : 'D'}</span>
            )}
            {bothAnswered && myAnswer === 'B' && (
              <span className="my-marker">You</span>
            )}
          </button>
        </div>

        <div className="quiz-status">
          {!myAnswer && <p>Tap your honest choice to lock it in.</p>}
          {myAnswer && !partnerAnswer && (
            <div className="waiting-pulse">
              <div className="dot-flashing"></div>
              <p>Waiting for {partnerRole === 'parshwa' ? 'Parshwa' : 'Diya'} to answer...</p>
            </div>
          )}
          {bothAnswered && (
            <div className="result-banner animate-fade-in">
              {isMatch ? (
                <>
                  <h3>Match! 🎯</h3>
                  <p>You both chose the exact same thing.</p>
                </>
              ) : (
                <>
                  <h3>Mismatch 💔</h3>
                  <p>Looks like you have different tastes!</p>
                </>
              )}
              <button className="editorial-text-btn" onClick={handleNext} style={{ marginTop: '16px' }}>
                Next Question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Quiz;
