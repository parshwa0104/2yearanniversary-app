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
  const [pushStatusDetail, setPushStatusDetail] = useState('');
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
    const checkStatus = async () => {
      if (Notification.permission === 'denied') {
        setPushStatus('Blocked by Browser');
        setPushStatusDetail('Go to browser settings to allow notifications.');
      } else if (Notification.permission === 'granted') {
        // Check if there's actually an active subscription
        try {
          const reg = await navigator.serviceWorker.getRegistration('/sw.js');
          const sub = reg ? await reg.pushManager.getSubscription() : null;
          if (sub) {
            setPushStatus('Enabled ✓');
            setPushStatusDetail('Tap to re-subscribe if not receiving notifications.');
          } else {
            setPushStatus('Re-Subscribe');
            setPushStatusDetail('Permission granted but no active subscription. Tap to fix.');
          }
        } catch {
          setPushStatus('Re-Subscribe');
          setPushStatusDetail('Subscription may be broken. Tap to fix.');
        }
      } else {
        setPushStatus('Enable Notifications');
        setPushStatusDetail('');
      }
    };
    checkStatus();
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
      alert('Push notifications are not supported in this browser.');
      return;
    }
    if (!role) {
      alert('Please select your profile (Parshwa or Diya) first!');
      return;
    }
    if (!PUBLIC_VAPID_KEY) {
      alert('VAPID key not configured. Check environment variables.');
      return;
    }

    try {
      setPushStatus('Setting up...');
      setPushStatusDetail('Please wait...');

      // Step 1: Unregister ALL old service workers (cleans up broken calling SW, etc.)
      const existingRegs = await navigator.serviceWorker.getRegistrations();
      for (const reg of existingRegs) {
        // Unsubscribe existing push subscriptions first
        const existingSub = await reg.pushManager.getSubscription().catch(() => null);
        if (existingSub) await existingSub.unsubscribe().catch(() => {});
        await reg.unregister();
      }

      // Step 2: Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('Permission Denied');
        setPushStatusDetail('Allow notifications in your browser settings.');
        return;
      }

      // Step 3: Register the fresh service worker
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Step 4: Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      // Step 5: Send subscription to backend
      const res = await fetch(`${BACKEND_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subscription,
          userRole: role 
        })
      });

      if (!res.ok) throw new Error(`Backend error: ${res.status}`);

      setPushStatus('Enabled ✓');
      setPushStatusDetail('You will now receive nudges and updates!');
      alert(`✅ Notifications enabled for ${role === 'parshwa' ? 'Parshwa' : 'Diya'}!`);
    } catch (err) {
      console.error('Notification setup failed:', err);
      setPushStatus('Error — Tap to retry');
      setPushStatusDetail(err.message || 'Something went wrong.');
    }
  };

  const sendTestNudge = async () => {
    if (!role) {
      alert('Select your profile first!');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: role,
          title: '🔔 Test Notification',
          body: `This is a test from ${role === 'parshwa' ? 'Parshwa' : 'Diya'}. Notifications are working!`
        })
      });
      if (res.ok) {
        alert('✅ Test nudge sent to your partner!');
      } else {
        const err = await res.json();
        alert(`❌ Failed: ${err.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
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
          <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <span className="setting-label">Push Notifications</span>
              <button 
                className="editorial-text-btn" 
                onClick={enableNotifications}
                disabled={pushStatus === 'Setting up...'}
                style={pushStatus.includes('✓') ? { color: 'var(--accent-neon)', borderColor: 'var(--accent-neon)' } : {}}
              >
                {pushStatus}
              </button>
            </div>
            {pushStatusDetail && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-pearl)', opacity: 0.6, lineHeight: 1.4 }}>
                {pushStatusDetail}
              </span>
            )}
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
          <div className="setting-item">
            <span className="setting-label">Test Notifications</span>
            <button 
              className="editorial-text-btn" 
              onClick={sendTestNudge}
              title="Send a test push notification to your partner"
            >
              Send Test Nudge
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
