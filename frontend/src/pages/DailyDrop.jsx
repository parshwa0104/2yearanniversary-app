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
  const [fullHistory, setFullHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(0);
  const [missingDaysCount, setMissingDaysCount] = useState(0);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appData", "stats"), (docSnap) => {
      if (docSnap.exists()) {
        setHearts(docSnap.data().hearts || 0);
      } else {
        setDoc(doc(db, "appData", "stats"), { hearts: 10 }, { merge: true });
        setHearts(10);
      }
    });
    return () => unsub();
  }, []);

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

      // Sort history descending by date string FIRST
      hist.sort((a, b) => b.id.localeCompare(a.id));

      // Calculate missing days up to yesterday
      let missingCount = 0;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dynamicStartDate = new Date('2026-08-15T00:00:00');
      if (hist.length > 0) {
        // Oldest date is last item in descending-sorted array
        const oldestDateStr = hist[hist.length - 1].id;
        dynamicStartDate = new Date(oldestDateStr + 'T00:00:00');
      }
      
      for (let d = new Date(dynamicStartDate); d <= yesterday; d.setDate(d.getDate() + 1)) {
        const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const histDoc = hist.find(h => h.id === dayStr);
        if (!histDoc || !histDoc['parshwa'] || !histDoc['diya']) {
          missingCount++;
        }
      }
      setMissingDaysCount(missingCount);

      setFullHistory([...hist]); // keep full history for restore & streak

      // Calculate Streak using FULL history (not truncated):
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
      setHistory(hist.slice(0, 30)); // Only truncate for UI display
    });
    return () => unsub();
  }, []);

  const handleRestoreStreak = async () => {
    if (hearts < missingDaysCount) return;
    setIsRestoring(true);
    try {
      await setDoc(doc(db, "appData", "stats"), { hearts: hearts - missingDaysCount }, { merge: true });
      
      let dynamicStartDate = new Date('2026-08-15T00:00:00');
      if (fullHistory.length > 0) {
        const oldestDateStr = fullHistory[fullHistory.length - 1].id;
        dynamicStartDate = new Date(oldestDateStr + 'T00:00:00');
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      for (let d = new Date(dynamicStartDate); d <= yesterday; d.setDate(d.getDate() + 1)) {
        const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const docRef = doc(db, 'dailyDrops', dayStr);
        
        // We use fullHistory to see what was missing without extra reads
        const histDoc = fullHistory.find(h => h.id === dayStr);
        let updated = false;
        const data = histDoc || {};
        
        const dummyDrop = {
          message: "Streak restored! ❤️",
          photo: null, 
          timestamp: new Date().toISOString()
        };
        
        if (!data.parshwa) { data.parshwa = dummyDrop; updated = true; }
        if (!data.diya) { data.diya = dummyDrop; updated = true; }
        
        if (updated) {
          // Remove the id property if it got copied from history
          delete data.id;
          await setDoc(docRef, data, { merge: true });
        }
      }
      setShowRestoreModal(false);
    } catch (e) {
      console.error(e);
    }
    setIsRestoring(false);
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Share a moment</h2>
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

      {showRestoreModal && (
        <div className="signature-modal-overlay" onClick={() => setShowRestoreModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="signature-letter" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '32px', background: 'var(--bg-deep)', borderRadius: '16px', border: '1px solid var(--border-plum)', maxWidth: '300px' }}>
            <h3 style={{ color: 'var(--text-blush)', marginBottom: '16px', fontFamily: 'var(--font-display)' }}>Restore Streak?</h3>
            <p style={{ color: 'var(--text-pearl)', marginBottom: '24px', fontSize: '0.95rem' }}>
              You missed {missingDaysCount} {missingDaysCount === 1 ? 'day' : 'days'}. It will cost {missingDaysCount} ❤️ to restore your perfect streak from the day you started.
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

export default DailyDrop;
