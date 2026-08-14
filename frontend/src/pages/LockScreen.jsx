import { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import './LockScreen.css';

// Read the passcode securely from env variables
const PASSCODE = import.meta.env.VITE_APP_PASSCODE;

const LockScreen = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleKeyPress = async (num) => {
    if (isAuthenticating) return;
    
    setError(false);
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        if (newPin === PASSCODE) {
          // Success, authenticate with Firebase
          setIsAuthenticating(true);
          try {
            await signInAnonymously(auth);
            // Wait a moment for a smooth transition
            setTimeout(() => onUnlock(), 400);
          } catch (err) {
            console.error("Auth failed:", err);
            setError(true);
            setIsAuthenticating(false);
            setTimeout(() => setPin(''), 600);
          }
        } else {
          // Error, shake and reset
          setError(true);
          setTimeout(() => setPin(''), 600);
        }
      }
    }
  };

  const handleDelete = () => {
    if (isAuthenticating) return;
    setPin(pin.slice(0, -1));
    setError(false);
  };

  return (
    <div className="lock-screen animate-fade-in">
      <div className="lock-header">
        <h2 className="lock-title">Enter Passcode</h2>
        <p className="lock-subtitle">Diya's Birthday</p>
      </div>

      <div className={`pin-dots ${error ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`dot ${pin.length > i ? 'filled' : ''}`}></div>
        ))}
      </div>

      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button 
            key={num} 
            className="key-btn" 
            onClick={() => handleKeyPress(num)}
            disabled={isAuthenticating}
          >
            {num}
          </button>
        ))}
        <button className="key-btn empty"></button>
        <button className="key-btn" onClick={() => handleKeyPress(0)} disabled={isAuthenticating}>0</button>
        <button className="key-btn action-key" onClick={handleDelete} disabled={isAuthenticating}>del</button>
      </div>
    </div>
  );
};

export default LockScreen;
