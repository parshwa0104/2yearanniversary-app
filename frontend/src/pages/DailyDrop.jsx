import { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Send } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './DailyDrop.css';

const DailyDrop = () => {
  const [message, setMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [partnerDrop, setPartnerDrop] = useState(null);
  const [myDrop, setMyDrop] = useState(null);

  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';

  useEffect(() => {
    // Listen for today's drop
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const unsub = onSnapshot(doc(db, "dailyDrops", today), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data[role]) setMyDrop(data[role]);
        if (data[partnerRole]) setPartnerDrop(data[partnerRole]);
      }
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
    
    const today = new Date().toLocaleDateString('en-CA');
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
        <span className="editorial-meta">0 Days Streak</span>
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
    </div>
  );
};

export default DailyDrop;
