import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Edit2, Check, Lock } from 'lucide-react';
import { doc, onSnapshot, setDoc, collection, addDoc, updateDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './Fun.css';

const defaultEnvelopes = [
  { id: 'env_1', label: "Open when you miss me", message: "I miss you too! Remember that time we went to Nariman Point...", isOpen: false },
  { id: 'env_2', label: "Open when you've had a bad day", message: "Everything will be okay. You are amazing and I love you, Diya.", isOpen: false },
  { id: 'env_3', label: "Open when we are eating our favorite food", message: "Bon appetit! Nothing beats eating this with you.", isOpen: false },
  { id: 'env_4', label: "Open when you can't sleep", message: "Close your eyes and think of our next vacation.", isOpen: false },
];

const Fun = () => {
  const navigate = useNavigate();
  const [envelopes, setEnvelopes] = useState([]);
  const [selectedEnvelope, setSelectedEnvelope] = useState(null);
  const [isEditingEnvelope, setIsEditingEnvelope] = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  
  const [showAddEnvelope, setShowAddEnvelope] = useState(false);
  const [newEnvLabel, setNewEnvLabel] = useState('');
  const [newEnvMessage, setNewEnvMessage] = useState('');
  
  const [bucketList, setBucketList] = useState([]);
  const [newItem, setNewItem] = useState('');

  // Fetch Envelopes
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appData", "envelopes"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().items) {
        setEnvelopes(docSnap.data().items);
      } else {
        // Initialize default envelopes if none exist
        setDoc(doc(db, "appData", "envelopes"), { items: defaultEnvelopes }).catch(e => console.error("setDoc error:", e));
        setEnvelopes(defaultEnvelopes);
      }
    }, (error) => {
      console.error("Snapshot error:", error);
      setEnvelopes(defaultEnvelopes);
    });
    return () => unsub();
  }, []);

  // Fetch Bucket List
  useEffect(() => {
    const q = query(collection(db, "bucketList"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setBucketList(items);
    });
    return () => unsub();
  }, []);

  const openEnvelope = async (env) => {
    setSelectedEnvelope(env);
    setEditedMessage(env.message);
    setIsEditingEnvelope(false);
    
    // Mark as open in DB
    if (!env.isOpen) {
      const updatedEnvs = envelopes.map(e => e.id === env.id ? { ...e, isOpen: true } : e);
      try {
        await setDoc(doc(db, "appData", "envelopes"), { items: updatedEnvs });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const closeEnvelope = () => {
    setSelectedEnvelope(null);
    setIsEditingEnvelope(false);
  };

  const saveEnvelope = async () => {
    const updatedEnvs = envelopes.map(e => e.id === selectedEnvelope.id ? { ...e, message: editedMessage } : e);
    setIsEditingEnvelope(false);
    setSelectedEnvelope({ ...selectedEnvelope, message: editedMessage });
    
    try {
      await setDoc(doc(db, "appData", "envelopes"), { items: updatedEnvs });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleBucketItem = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, "bucketList", id), { completed: !currentStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const addBucketItem = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await addDoc(collection(db, "bucketList"), {
        text: newItem,
        completed: false,
        timestamp: new Date()
      });
      setNewItem('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateEnvelope = async (e) => {
    e.preventDefault();
    if (!newEnvLabel.trim()) return;
    
    const newEnv = {
      id: 'env_' + Date.now(),
      label: newEnvLabel,
      message: newEnvMessage,
      isOpen: false
    };
    
    const updatedEnvs = [...envelopes, newEnv];
    try {
      await setDoc(doc(db, "appData", "envelopes"), { items: updatedEnvs });
      setNewEnvLabel('');
      setNewEnvMessage('');
      setShowAddEnvelope(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-container fun-page">
      
      {/* Mini Game Section */}
      <div className="editorial-section" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 className="section-title">Couples Quiz 🎮</h2>
        <p style={{ color: 'var(--text-pearl)', opacity: 0.8, marginBottom: '16px', fontSize: '0.95rem' }}>
          Test how well you know each other's preferences.
        </p>
        <button 
          className="editorial-text-btn" 
          onClick={() => navigate('/quiz')}
          style={{ width: '100%', padding: '16px', fontSize: '1.1rem', background: 'rgba(255,126,179,0.1)', borderColor: 'var(--accent-neon)', boxShadow: '0 0 15px rgba(255,126,179,0.2)' }}
        >
          Start Mini Game
        </button>
      </div>

      {/* Envelopes Section */}
      <div className="editorial-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Open When...</h2>
          <button className="icon-btn" onClick={() => setShowAddEnvelope(!showAddEnvelope)}>
            {showAddEnvelope ? <X size={18} /> : <Plus size={18} />}
          </button>
        </div>
        
        {showAddEnvelope && (
          <form className="add-timeline-form animate-fade-in" onSubmit={handleCreateEnvelope} style={{ marginBottom: '24px' }}>
            <div className="editorial-input-group">
              <input
                type="text"
                className="editorial-input"
                placeholder="Condition (e.g. Open when you are mad at me)"
                value={newEnvLabel}
                onChange={(e) => setNewEnvLabel(e.target.value)}
                required
              />
            </div>
            <div className="editorial-input-group">
              <textarea
                className="editorial-textarea"
                placeholder="The secret message inside..."
                value={newEnvMessage}
                onChange={(e) => setNewEnvMessage(e.target.value)}
                rows="3"
                required
              />
            </div>
            <button type="submit" className="editorial-text-btn">Seal Envelope</button>
          </form>
        )}
        
        <div className="physical-envelopes">
          {envelopes.map(env => (
            <div 
              key={env.id} 
              className={`paper-envelope ${env.isOpen ? 'opened' : 'locked'}`}
              onClick={() => openEnvelope(env)}
            >
              {!env.isOpen && (
                <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--bg-deep)', borderRadius: '50%', padding: '6px', border: '1px solid var(--border-plum)', color: 'var(--text-pearl)' }}>
                  <Lock size={14} />
                </div>
              )}
              <div className="envelope-flap"></div>
              <span className="envelope-text">{env.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shared Bucket List Section */}
      <div className="editorial-section">
        <h2 className="section-title">Things to do together</h2>
        
        <form className="minimal-add-form" onSubmit={addBucketItem}>
          <input 
            type="text" 
            className="editorial-input" 
            placeholder="Add to our list..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button type="submit" className="editorial-text-btn add-btn" disabled={!newItem.trim()}>
            <Plus size={18} />
          </button>
        </form>

        <div className="minimal-bucket-list">
          {bucketList.map(item => (
            <div 
              key={item.id} 
              className={`minimal-bucket-item ${item.completed ? 'completed' : ''}`}
              onClick={() => toggleBucketItem(item.id, item.completed)}
            >
              <div className="check-line"></div>
              <span className="item-text">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Envelope Modal (The Signature Animation Moment) */}
      {selectedEnvelope && (
        <div className="signature-modal-overlay" onClick={closeEnvelope}>
          <div className="signature-letter" onClick={e => e.stopPropagation()}>
            <button className="letter-close-btn" onClick={closeEnvelope}>
              <X size={24} color="var(--bg-deep)" />
            </button>
            
            <div className="letter-header">
               <h3 className="letter-title">{selectedEnvelope.label}</h3>
               {!isEditingEnvelope ? (
                 <button className="letter-icon-btn" onClick={() => setIsEditingEnvelope(true)}>
                   <Edit2 size={16} />
                 </button>
               ) : (
                 <button className="letter-icon-btn neon-active" onClick={saveEnvelope}>
                   <Check size={16} />
                 </button>
               )}
            </div>

            <div className="letter-body">
              {isEditingEnvelope ? (
                <textarea
                  className="letter-textarea"
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  rows="8"
                  autoFocus
                />
              ) : (
                <p>{selectedEnvelope.message}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fun;
