import { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Send } from 'lucide-react';
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import './DailyDrop.css';

const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DailyDrop = () => {
  const [message, setMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [partnerDrop, setPartnerDrop] = useState(null);
  const [myDrop, setMyDrop] = useState(null);

  const [history, setHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';

  useEffect(() => {
    // Simplify query to avoid any Firebase index or orderBy crashes
    const q = query(collection(db, "dailyDrops"));
    const unsub = onSnapshot(q, (snapshot) => {
      const today = getLocalToday();
      let hist = [];
      let todayMyDrop = null;
      let todayPartnerDrop = null;
      let todayDoc = null;

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id === today) {
          todayDoc = data;
          if (data[role]) todayMyDrop = data[role];
          if (data[partnerRole]) todayPartnerDrop = data[partnerRole];
        } else {
          hist.push({ id: docSnap.id, ...data });
        }
      });

      // Sort history descending by date string
      hist.sort((a, b) => b.id.localeCompare(a.id));
      hist = hist.slice(0, 30); // Keep max 30 past drops

      // Calculate Streak
      let currentStreak = 0;
      let checkDate = new Date();
      
      if (todayDoc && todayDoc['parshwa'] && todayDoc['diya']) {
        currentStreak += 1;
      }
      checkDate.setDate(checkDate.getDate() - 1);
      
      while (true) {
        const histDayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        const histDoc = hist.find(h => h.id === histDayStr);
        if (histDoc && histDoc['parshwa'] && histDoc['diya']) {
          currentStreak += 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      setStreak(currentStreak);
      setMyDrop(todayMyDrop);
      setPartnerDrop(todayPartnerDrop);
      setHistory(hist);
    });
    return () => unsub();
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height *= MAX_WIDTH / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width *= MAX_HEIGHT / height);
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          if (compressedBase64.length > 900000) {
            alert("This image is still too large even after compression! Please try a different photo.");
            return;
          }
          setPhotoPreview(compressedBase64);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message && !photoPreview) return;
    
    const today = getLocalToday();
    const dropData = {
      message: message,
      photo: photoPreview,
      timestamp: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "dailyDrops", today), {
        [role]: dropData
      }, { merge: true });
      
      setMessage('');
      setPhotoPreview(null);

      // Trigger Web Push Notification
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      fetch(`${BACKEND_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: role,
          title: "New Daily Drop! 📸",
          body: `${role === 'parshwa' ? 'Parshwa' : 'Diya'} just sent you a photo. Tap to see it!`
        })
      }).catch(err => console.error("Notification trigger failed:", err));

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="daily-drop-section animate-fade-in">
      <div className="editorial-header">
        <h2 className="section-title">Share a moment</h2>
        <span className="editorial-meta">{streak} {streak === 1 ? 'Day' : 'Days'} Streak</span>
      </div>

      {!myDrop ? (
        <form className="drop-form" onSubmit={handleSubmit}>
          <div className="polaroid-frame">
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Preview" className="polaroid-photo" />
                <button 
                  type="button" 
                  className="change-photo-text"
                  onClick={() => setPhotoPreview(null)}
                >
                  Change photo
                </button>
              </>
            ) : (
              <label className="upload-label">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                  style={{ display: 'none' }} 
                />
                <div className="polaroid-placeholder">
                  <Camera size={28} color="var(--text-blush)" strokeWidth={1.5} />
                  <span>Tap to add photo</span>
                </div>
              </label>
            )}
          </div>

          <div className="editorial-input-group">
            <textarea
              className="editorial-textarea"
              placeholder="Write something sweet..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="3"
            />
          </div>

          <button type="submit" className="editorial-text-btn" disabled={!message && !photoPreview}>
            <Send size={18} />
            <span>Send to {partnerRole === 'parshwa' ? 'Parshwa' : 'Diya'}</span>
          </button>
        </form>
      ) : (
        <div className="drop-form">
          <div className="polaroid-frame">
            {myDrop.photo && <img src={myDrop.photo} alt="My Drop" className="polaroid-photo" />}
            <div className="change-photo-text">Sent today</div>
          </div>
          <p style={{fontSize: '1.2rem', color: 'var(--text-pearl)', fontStyle: 'italic', textAlign: 'center'}}>"{myDrop.message}"</p>
        </div>
      )}

      <div className="partner-waiting">
        <div className="waiting-line"></div>
        {partnerDrop ? (
          <div className="partner-drop-view animate-fade-in">
             <h3 style={{color: 'var(--text-blush)', fontFamily: 'var(--font-display)', marginBottom: '16px'}}>{partnerRole === 'parshwa' ? 'Parshwa' : 'Diya'}'s Drop</h3>
             <div className="polaroid-frame">
               {partnerDrop.photo && <img src={partnerDrop.photo} alt="Partner Drop" className="polaroid-photo" />}
             </div>
             <p style={{fontSize: '1.2rem', color: 'var(--text-pearl)', fontStyle: 'italic', textAlign: 'center', marginTop: '16px'}}>"{partnerDrop.message}"</p>
          </div>
        ) : (
          <div className="waiting-content">
            <ImageIcon size={24} color="var(--border-plum)" strokeWidth={1.5} />
            <p>Waiting for {partnerRole === 'parshwa' ? 'Parshwa' : 'Diya'}'s drop...</p>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-section" style={{ marginTop: '60px', padding: '20px 0', borderTop: '1px dashed var(--border-plum)' }}>
          <h2 className="section-title" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>Past Memories</h2>
          <div className="history-feed" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {history.map(day => (
              <div key={day.id} className="history-day" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-plum)' }}>
                <h3 style={{ color: 'var(--text-blush)', fontSize: '0.9rem', marginBottom: '16px', textAlign: 'center', letterSpacing: '0.1em' }}>
                  {new Date(day.id).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                  {['parshwa', 'diya'].map(r => {
                    const drop = day[r];
                    if (!drop) return null;
                    return (
                      <div key={r} style={{ flex: '1 1 200px', maxWidth: '300px' }}>
                        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-pearl)', opacity: 0.6, marginBottom: '8px', textAlign: 'center', textTransform: 'capitalize' }}>{r}</h4>
                        <div className="polaroid-frame" style={{ padding: '8px', paddingBottom: '24px' }}>
                          {drop.photo && <img src={drop.photo} alt={`${r}'s drop`} className="polaroid-photo" loading="lazy" />}
                        </div>
                        <p style={{ fontSize: '1rem', color: 'var(--text-pearl)', fontStyle: 'italic', textAlign: 'center', marginTop: '12px' }}>"{drop.message}"</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyDrop;
