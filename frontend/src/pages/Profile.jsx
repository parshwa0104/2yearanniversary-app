import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
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
  const [role, setRole] = useState(localStorage.getItem('appRole') || 'parshwa');

  useEffect(() => {
    if (Notification.permission === 'granted') {
      setPushStatus('Enabled');
    } else if (Notification.permission === 'denied') {
      setPushStatus('Blocked by Browser');
    }
  }, []);

  const handleRoleChange = (newRole) => {
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
            <button className="editorial-text-btn">Download</button>
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
