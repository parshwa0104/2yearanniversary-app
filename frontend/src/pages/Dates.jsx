import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Edit2, Check } from 'lucide-react';
import { db } from '../firebase';
import DateLog from './DateLog';
import contentData from '../data/content.json';
import './Dates.css';

const defaultDateIdeas = contentData.dateIdeas;

const Dates = () => {
  const [ideas, setIdeas] = useState(defaultDateIdeas);
  const [randomDate, setRandomDate] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appData", "dateIdeas"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().list) {
        setIdeas(docSnap.data().list);
        setEditedText(docSnap.data().list.join('\n'));
      } else {
        setEditedText(defaultDateIdeas.join('\n'));
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    const newIdeas = editedText.split('\n').filter(i => i.trim() !== '');
    setIsEditing(false);
    try {
      await setDoc(doc(db, "appData", "dateIdeas"), { list: newIdeas });
    } catch (err) {
      console.error(err);
    }
  };

  const generateDate = () => {
    if (isEditing || ideas.length === 0) return;
    setIsSpinning(true);
    setRandomDate('');

    let spins = 0;
    const interval = setInterval(() => {
      setRandomDate(ideas[Math.floor(Math.random() * ideas.length)]);
      spins++;
      if (spins > 10) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  };

  return (
    <div className="page-container dates-page">
      <div className="generator-section" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Can't decide?</h2>
          {!isEditing ? (
            <button className="icon-btn" onClick={() => setIsEditing(true)} title="Edit Date Ideas">
              <Edit2 size={18} color="var(--text-blush)" />
            </button>
          ) : (
            <button className="icon-btn" onClick={handleSave} title="Save Ideas">
              <Check size={18} color="var(--accent-neon)" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-blush)', marginBottom: '12px', textAlign: 'left' }}>
              One idea per line. (Syncs to cloud)
            </p>
            <textarea
              className="reasons-textarea"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows="12"
              style={{ width: '100%', padding: '16px', borderRadius: '8px', background: 'transparent', color: 'var(--text-pearl)', border: '1px solid var(--border-plum)' }}
            />
          </div>
        ) : (
          <>
            <div className="roulette-container">
              <div className={`roulette-text ${isSpinning ? 'spinning' : ''}`}>
                {randomDate || "Tap below to let fate decide"}
              </div>
            </div>

            <button
              className="editorial-text-btn center-btn"
              onClick={generateDate}
              disabled={isSpinning || ideas.length === 0}
            >
              Generate Idea
            </button>
          </>
        )}
      </div>

      <div className="timeline-section">
        <h2 className="section-title">Our story so far</h2>
        <DateLog />
      </div>
    </div>
  );
};

export default Dates;
