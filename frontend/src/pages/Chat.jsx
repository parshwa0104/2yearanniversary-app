import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Send, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneCall, Check, CheckCheck } from 'lucide-react';
import { collection, doc, addDoc, onSnapshot, query, orderBy, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './Chat.css';

const AGORA_APP_ID = '822b1425eaf8493b8758347766f08469';
const CHANNEL_NAME = 'parshwa-diya-love';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Agora client (module-level singleton)
let agoraClient = null;

const Chat = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';
  const partnerName = partnerRole === 'parshwa' ? 'Parshwa' : 'Diya';
  const myName = role === 'parshwa' ? 'Parshwa' : 'Diya';
  const uid = role === 'parshwa' ? 1 : 2;

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  // --- CALL STATE ---
  const [callState, setCallState] = useState(null); // null | 'ringing' | 'incoming' | 'connected'
  const [isVideo, setIsVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  const localTracksRef = useRef([]); // [micTrack] or [micTrack, cameraTrack]
  const callStateRef = useRef(null); // shadow ref for use inside Agora callbacks

  // Keep ref in sync
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Load messages
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Mark messages as read
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.sender !== role && !msg.read) {
        updateDoc(doc(db, 'messages', msg.id), { read: true }).catch(console.error);
      }
    });
  }, [messages, role]);

  // Listen to call signaling doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'calls', 'primary'), (snapshot) => {
      const data = snapshot.data();

      if (!data) {
        // Call was ended/deleted by partner
        if (callStateRef.current) cleanupCall();
        return;
      }

      // Show incoming call to the callee
      if (data.status === 'ringing' && data.callee === role && callStateRef.current !== 'incoming' && callStateRef.current !== 'connected') {
        setCallState('incoming');
        setIsVideo(data.video);
      }

      // Partner rejected/ended
      if (data.status === 'ended') {
        cleanupCall();
      }
    });
    return () => unsub();
  }, [role]);

  // Cleanup Agora on unmount
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  // --- SEND MESSAGE ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const msg = text;
    setText('');

    await addDoc(collection(db, 'messages'), {
      text: msg,
      sender: role,
      timestamp: serverTimestamp()
    });

    fetch(`${BACKEND_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderRole: role,
        title: `💬 ${myName}`,
        body: msg
      })
    }).catch(() => {});
  };

  // --- JOIN AGORA CHANNEL ---
  const joinAgoraChannel = async (videoEnabled) => {
    // Fetch dynamic token from backend
    let token = null;
    try {
      const response = await fetch(`${BACKEND_URL}/rtcToken?channelName=${CHANNEL_NAME}&uid=${uid}`);
      const data = await response.json();
      if (data.token) {
        token = data.token;
      } else {
        console.error("Token fetch failed:", data.error);
        alert('Could not fetch call token. Error: ' + (data.error || 'Unknown error'));
        handleEndCall();
        return;
      }
    } catch (err) {
      console.error("Error fetching token:", err);
      alert('Network error fetching call token.');
      handleEndCall();
      return;
    }

    agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    // Remote user published (partner joined / published tracks)
    agoraClient.on('user-published', async (user, mediaType) => {
      await agoraClient.subscribe(user, mediaType);

      if (mediaType === 'video') {
        setRemoteHasVideo(true);
        setCallState('connected');
        // Play into the remote-video div
        setTimeout(() => {
          user.videoTrack?.play('agora-remote-video');
        }, 100);
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
        setCallState('connected');
      }
    });

    agoraClient.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') setRemoteHasVideo(false);
    });

    agoraClient.on('user-left', () => {
      // Partner left the channel = call ended
      cleanupCall();
    });

    await agoraClient.join(AGORA_APP_ID, CHANNEL_NAME, token, uid);

    // Publish local tracks
    if (videoEnabled) {
      const [micTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localTracksRef.current = [micTrack, cameraTrack];
      await agoraClient.publish([micTrack, cameraTrack]);
      // Play local camera preview
      setTimeout(() => {
        cameraTrack.play('agora-local-video', { mirror: false });
      }, 100);
    } else {
      const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localTracksRef.current = [micTrack];
      await agoraClient.publish([micTrack]);
    }
  };

  // --- START CALL (initiator) ---
  const handleStartCall = async (videoEnabled) => {
    try {
      setIsVideo(videoEnabled);
      setCallState('ringing');

      // Write signaling doc
      await setDoc(doc(db, 'calls', 'primary'), {
        caller: role,
        callee: partnerRole,
        video: videoEnabled,
        status: 'ringing',
        createdAt: serverTimestamp()
      });

      // Join Agora — wait in channel for partner
      await joinAgoraChannel(videoEnabled);

      // Push notification to partner
      fetch(`${BACKEND_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: role,
          title: videoEnabled ? '📹 Incoming Video Call' : '📞 Incoming Call',
          body: `${myName} is calling you! Open the app to answer.`
        })
      }).catch(() => {});

    } catch (err) {
      console.error('Start call failed:', err);
      alert('Could not start call. Error: ' + (err.message || err));
      handleEndCall();
    }
  };

  // --- ACCEPT CALL (callee) ---
  const handleAcceptCall = async () => {
    try {
      setCallState('connected');

      // Update signaling doc
      await updateDoc(doc(db, 'calls', 'primary'), { status: 'accepted' });

      // Join Agora
      await joinAgoraChannel(isVideo);

    } catch (err) {
      console.error('Accept call failed:', err);
      alert('Could not join call. Error: ' + (err.message || err));
      handleEndCall();
    }
  };

  // --- END / REJECT CALL ---
  const handleEndCall = async () => {
    await setDoc(doc(db, 'calls', 'primary'), { status: 'ended' }, { merge: true })
      .catch(() => {});
    setTimeout(() => deleteDoc(doc(db, 'calls', 'primary')).catch(() => {}), 500);
    cleanupCall();
  };

  // --- CLEANUP ---
  const cleanupCall = async () => {
    // Stop local tracks
    localTracksRef.current.forEach(track => {
      try { track.stop(); track.close(); } catch {}
    });
    localTracksRef.current = [];

    // Leave Agora channel
    if (agoraClient) {
      try { await agoraClient.leave(); } catch {}
      agoraClient = null;
    }

    setCallState(null);
    setIsVideo(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setRemoteHasVideo(false);
  };

  // --- TOGGLE MIC ---
  const toggleMute = async () => {
    const micTrack = localTracksRef.current[0];
    if (micTrack) {
      await micTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  // --- TOGGLE CAMERA ---
  const toggleVideo = async () => {
    const cameraTrack = localTracksRef.current[1];
    if (cameraTrack) {
      await cameraTrack.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  // --- RENDER ---
  return (
    <div className="chat-container">
      {/* ── Header ── */}
      <div className="chat-header">
        <div className="chat-title">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <div className="chat-partner-info">
            <div className="chat-partner-avatar">{partnerName[0]}</div>
            <h2 className="chat-name">{partnerName}</h2>
          </div>
        </div>
        <div className="chat-actions">
          <button className="call-btn" onClick={() => handleStartCall(false)} title="Voice Call">
            <Phone size={20} />
          </button>
          <button className="call-btn" onClick={() => handleStartCall(true)} title="Video Call">
            <Video size={22} />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="messages-area">
        {messages.length === 0 && (
          <div className="empty-chat">
            <span>💌</span>
            <p>Say something sweet...</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender === role ? 'mine' : 'theirs'}`}>
            <span className="message-text">{msg.text}</span>
            <div className="message-meta">
              <span className="message-time">
                {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
              </span>
              {msg.sender === role && (
                <span className="read-receipt">
                  {msg.read ? <CheckCheck size={13} color="var(--accent-neon)" /> : <Check size={13} />}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <form className="chat-input-area" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="send-btn" disabled={!text.trim()}>
          <Send size={20} strokeWidth={2} />
        </button>
      </form>

      {/* ── Call Overlay ── */}
      {callState && (
        <div className="call-overlay animate-fade-in">

          {/* Incoming call screen */}
          {callState === 'incoming' && (
            <div className="incoming-call-screen">
              <div className="incoming-avatar-ring">
                <div className="incoming-ring r1" />
                <div className="incoming-ring r2" />
                <div className="incoming-ring r3" />
                <div className="incoming-avatar">{partnerName[0]}</div>
              </div>
              <h2 className="incoming-name">{partnerName}</h2>
              <p className="incoming-label">
                {isVideo ? '📹 Incoming video call' : '📞 Incoming voice call'}
              </p>
              <div className="incoming-actions">
                <div className="incoming-action-wrap">
                  <button className="ctrl-btn reject" onClick={handleEndCall}>
                    <PhoneOff size={26} />
                  </button>
                  <span>Decline</span>
                </div>
                <div className="incoming-action-wrap">
                  <button className="ctrl-btn accept" onClick={handleAcceptCall}>
                    <PhoneCall size={26} />
                  </button>
                  <span>Accept</span>
                </div>
              </div>
            </div>
          )}

          {/* Ringing / Connected screen */}
          {(callState === 'ringing' || callState === 'connected') && (
            <>
              {/* Remote video (fills screen) */}
              {isVideo && (
                <div
                  id="agora-remote-video"
                  className="agora-remote-video"
                  style={{ background: remoteHasVideo ? '#000' : '#0d0d0d' }}
                />
              )}

              {/* Audio-only or waiting: show avatar */}
              {(!isVideo || !remoteHasVideo) && (
                <div className="call-waiting-center">
                  <div className={`call-avatar-pulse ${callState === 'ringing' ? 'pulsing' : ''}`}>
                    <div className="pulse-ring pr1" />
                    <div className="pulse-ring pr2" />
                    <div className="call-avatar-inner">{partnerName[0]}</div>
                  </div>
                  <h2 className="call-partner-name">{partnerName}</h2>
                  <p className="call-status-label">
                    {callState === 'ringing' ? 'Calling...' : 'Connected'}
                  </p>
                </div>
              )}

              {/* Local video PiP */}
              {isVideo && (
                <div id="agora-local-video" className="agora-local-video" />
              )}

              {/* Controls */}
              <div className="call-controls">
                <button className={`ctrl-btn ${isMuted ? 'off' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                {isVideo && (
                  <button className={`ctrl-btn ${isVideoOff ? 'off' : ''}`} onClick={toggleVideo} title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}>
                    {isVideoOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
                  </button>
                )}

                <button className="ctrl-btn end-call" onClick={handleEndCall} title="End call">
                  <PhoneOff size={24} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
