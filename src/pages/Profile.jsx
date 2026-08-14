import { Heart } from 'lucide-react';
import './Profile.css';

const Profile = () => {
  return (
    <div className="page-container profile-page">
      <div className="profile-header">
        <h2 className="title-display">Us</h2>
      </div>

      <div className="couple-profiles">
        <div className="profile-column">
          <div className="avatar-circle">P</div>
          <h3 className="profile-name">Parshwa</h3>
        </div>
        
        <div className="heart-divider">
          <Heart size={20} color="var(--text-blush)" strokeWidth={1.5} />
          <div className="divider-line"></div>
        </div>

        <div className="profile-column">
          <div className="avatar-circle">D</div>
          <h3 className="profile-name">Diya (Tingu)</h3>
        </div>
      </div>

      <div className="app-settings">
        <h3 className="settings-title">App Settings</h3>
        
        <div className="settings-list">
          <div className="setting-item">
            <span className="setting-label">Notifications</span>
            <button className="editorial-text-btn">Enabled</button>
          </div>
          <div className="setting-item">
            <span className="setting-label">Passcode Lock</span>
            <button className="editorial-text-btn">Set Passcode</button>
          </div>
          <div className="setting-item">
            <span className="setting-label">Export Memories</span>
            <button className="editorial-text-btn">Download</button>
          </div>
        </div>
      </div>
      
      <div className="logout-section">
        <button className="editorial-text-btn logout-btn">Sign Out</button>
      </div>
    </div>
  );
};

export default Profile;
