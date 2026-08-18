import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import contentData from '../data/content.json';
import './Profile.css';

// We will use the Vercel deployed backend URL or localhost for testing
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const Profile = () => {
  const [pushStatus, setPushStatus] = useState('Enable Notifications');
  const [role, setRole] = useState(localStorage.getItem('appRole') || null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      
      // 1. Fetch Daily Drops (Photos)
      const dropsSnap = await getDocs(collection(db, "dailyDrops"));
      const photosFolder = zip.folder("Photos");
      
      dropsSnap.forEach(docSnap => {
        const dateId = docSnap.id;
        const data = docSnap.data();
        
        ['parshwa', 'diya'].forEach(r => {
          if (data[r] && data[r].photo) {
            const base64Data = data[r].photo.split(',')[1];
            if (base64Data) {
              photosFolder.file(`${dateId}_${r}.jpg`, base64Data, { base64: true });
            }
          }
        });
      });

      // 2. Fetch Story (Dates)
      const datesSnap = await getDocs(collection(db, "dates"));
      let storyText = "OUR STORY SO FAR\n================\n\n";
      const datesList = [];
      datesSnap.forEach(d => datesList.push({ id: d.id, ...d.data() }));
      datesList.sort((a, b) => b.id.localeCompare(a.id));
      
      datesList.forEach(d => {
        storyText += `[${d.id}]\n`;
        storyText += `${d.title || 'Date'}\n`;
        storyText += `Parshwa: ${d.parshwa ? d.parshwa.text : '...'}\n`;
        storyText += `Diya: ${d.diya ? d.diya.text : '...'}\n`;
        storyText += `\n-------------------\n\n`;
      });
      zip.file("Our_Story.txt", storyText);

      // 3. Fetch Q&A
      const qaSnap = await getDocs(collection(db, "qanda"));
      let qaText = "DAILY QUESTIONS\n===============\n\n";
      const qaList = [];
      qaSnap.forEach(q => qaList.push({ id: q.id, ...q.data() }));
      qaList.sort((a, b) => a.id.localeCompare(b.id));

      qaList.forEach(q => {
        const parts = q.id.split('_'); 
        const qId = parseInt(parts[1], 10);
        const questionObj = contentData.questions.find(item => item.id === qId);
        const qText = questionObj ? questionObj.text : 'Question';

        qaText += `Date: ${parts[2]}\n`;
        qaText += `Q: ${qText}\n`;
        qaText += `Parshwa: ${q.parshwa || '...'}\n`;
        qaText += `Diya: ${q.diya || '...'}\n`;
        qaText += `\n-------------------\n\n`;
      });
      zip.file("Daily_Questions.txt", qaText);

      // 4. Generate & Save
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "Parshwa_and_Diya_Memories.zip");

    } catch (err) {
      console.error(err);
      alert("Failed to export memories.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (Notification.permission === 'granted') {
      setPushStatus('Enabled');
    } else if (Notification.permission === 'denied') {
      setPushStatus('Blocked by Browser');
    }
  }, []);

  const handleRoleChange = (newRole) => {
    if (localStorage.getItem('appRole')) {
      alert(`This phone is permanently locked to ${role === 'parshwa' ? 'Parshwa' : 'Diya'}. You cannot switch profiles!`);
      return;
    }
    setRole(newRole);
    localStorage.setItem('appRole', newRole);
  };

  const enableNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }

    try {
      setPushStatus('Registering...');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('Permission Denied');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      // Send to Render Backend
      await fetch(`${BACKEND_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subscription,
          userRole: role 
        })
      });

      setPushStatus('Enabled');
      alert("Notifications successfully enabled!");
    } catch (err) {
      console.error(err);
      setPushStatus('Error (Try again)');
    }
  };

  return (
    <div className="page-container profile-page">
      <div className="profile-header">
        <h2 className="title-display">Us</h2>
      </div>

      <div className="couple-profiles">
        <div className={`profile-column ${role === 'parshwa' ? 'active-role' : ''}`} onClick={() => handleRoleChange('parshwa')}>
          <div className="avatar-circle">P</div>
          <h3 className="profile-name">Parshwa</h3>
        </div>
        
        <div className="heart-divider">
          <Heart size={20} color="var(--text-blush)" strokeWidth={1.5} />
          <div className="divider-line"></div>
        </div>

        <div className={`profile-column ${role === 'diya' ? 'active-role' : ''}`} onClick={() => handleRoleChange('diya')}>
          <div className="avatar-circle">D</div>
          <h3 className="profile-name">Diya (Tingu)</h3>
        </div>
      </div>
      <p style={{textAlign: 'center', color: 'var(--text-blush)', fontSize: '0.9rem', marginTop: '-10px', marginBottom: '20px'}}>Tap your name to select who is using this phone.</p>

      <div className="app-settings">
        <h3 className="settings-title">App Settings</h3>
        
        <div className="settings-list">
          <div className="setting-item">
            <span className="setting-label">Push Notifications</span>
            <button 
              className="editorial-text-btn" 
              onClick={enableNotifications}
              disabled={pushStatus === 'Enabled'}
            >
              {pushStatus}
            </button>
          </div>
          <div className="setting-item">
            <span className="setting-label">Passcode Lock</span>
            <button className="editorial-text-btn">Enabled (2011)</button>
          </div>
          <div className="setting-item">
            <span className="setting-label">Export Memories</span>
            <button 
              className="editorial-text-btn" 
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Packaging...' : 'Download ZIP'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="logout-section">
        <button className="editorial-text-btn logout-btn" onClick={async () => {
          localStorage.removeItem('appUnlocked');
          await signOut(auth);
          window.location.href = '/';
        }}>Sign Out</button>
      </div>
    </div>
  );
};

export default Profile;
