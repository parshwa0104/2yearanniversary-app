import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './QandA.css';

const questions = [
  { id: 1, text: "What was your first impression of me?" },
  { id: 2, text: "What is your favorite memory of us together?" },
  { id: 3, text: "Where do you see us in 5 years?" }
];

const QandA = () => {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [myAnswer, setMyAnswer] = useState('');
  const [partnerAnswer, setPartnerAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const currentQ = questions[currentQIndex];

  useEffect(() => {
    // Listen for current question answers
    const unsub = onSnapshot(doc(db, "qanda", `q_${currentQ.id}`), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.parshwa) {
          setMyAnswer(data.parshwa);
          setSubmitted(true);
        }
        if (data.diya) {
          setPartnerAnswer(data.diya);
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
  }, [currentQ.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!myAnswer.trim()) return;
    
    try {
      await setDoc(doc(db, "qanda", `q_${currentQ.id}`), {
        parshwa: myAnswer
      }, { merge: true });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  const nextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    }
  };

  return (
    <div className="qa-section animate-fade-in">
      <div className="editorial-header">
        <h2 className="section-title">Question of the day</h2>
        <span className="editorial-meta">{currentQIndex + 1} / {questions.length}</span>
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
              <span className="answer-author">Parshwa</span>
              <p className="answer-text">{myAnswer}</p>
            </div>
            <div className={`answer-row ${!partnerAnswer ? 'waiting' : ''}`}>
              <span className="answer-author">Diya</span>
              <p className="answer-text">{partnerAnswer || "Waiting for her to answer..."}</p>
            </div>

            {currentQIndex < questions.length - 1 && (
              <div className="qa-actions">
                <button onClick={nextQuestion} className="editorial-text-btn">
                  Next Question
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QandA;
