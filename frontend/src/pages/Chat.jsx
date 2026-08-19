import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Video, Send, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneCall, Check, CheckCheck } from 'lucide-react';
import { collection, doc, addDoc, onSnapshot, query, orderBy, setDoc, deleteDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './Chat.css';

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

const Chat = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem('appRole') || 'parshwa';
  const partnerRole = role === 'parshwa' ? 'diya' : 'parshwa';
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  // --- WEBRTC STATE ---
  const [callState, setCallState] = useState(null); // 'ringing', 'incoming', 'connected'
  const [isVideo, setIsVideo] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const callDocData = useRef(null); // Store latest call doc data for ICE callbacks
  const processedCandidates = useRef(new Set());

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Sync Video Refs
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.error("Local play err:", e));
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.error("Remote play err:", e));
    }
  }, [remoteStream, callState]);

  // Load Messages
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Mark incoming messages as read
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.sender !== role && !msg.read) {
        updateDoc(doc(db, 'messages', msg.id), { read: true }).catch(console.error);
      }
    });
  }, [messages, role]);

  // Listen to Call Doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'calls', 'primary'), async (snapshot) => {
      const data = snapshot.data();
      callDocData.current = data;

      if (!data) {
        // Call ended
        if (callState) handleCleanup();
        return;
      }

      // 1. INCOMING CALL
      if (data.offer && data.caller !== role && !data.answer && callState !== 'incoming' && callState !== 'connected') {
        setCallState('incoming');
        setIsVideo(data.video);
      }

      // 2. CALLER RECEIVES ANSWER
      if (data.answer && data.caller === role && pc.current && pc.current.signalingState !== 'stable') {
        try {
          const rtcSessionDescription = new RTCSessionDescription(data.answer);
          await pc.current.setRemoteDescription(rtcSessionDescription);
          setCallState('connected');
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      }

      // 3. ICE CANDIDATES SYNC
      if (pc.current && pc.current.remoteDescription) {
        // If I am caller, I read calleeCandidates. If I am callee, I read callerCandidates.
        const candidates = data.caller === role ? (data.calleeCandidates || []) : (data.callerCandidates || []);
        
        candidates.forEach(async (candidateData) => {
          if (!processedCandidates.current.has(candidateData.candidate)) {
            processedCandidates.current.add(candidateData.candidate);
            try {
              const candidate = new RTCIceCandidate(candidateData);
              await pc.current.addIceCandidate(candidate);
            } catch (err) {}
          }
        });
      }
    });
    return () => unsub();
  }, [role, callState]);

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

    // Notify partner
    fetch(`${BACKEND_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderRole: role,
        title: `New Message from ${role === 'parshwa' ? 'Parshwa' : 'Diya'}`,
        body: msg
      })
    }).catch(e => console.error("Notify failed:", e));
  };

  // --- WEBRTC SETUP ---
  const setupMediaAndPC = async (videoEnabled, isCaller) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: true });
    setLocalStream(stream);

    pc.current = new RTCPeerConnection(configuration);

    stream.getTracks().forEach(track => {
      pc.current.addTrack(track, stream);
    });

    pc.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        const field = isCaller ? 'callerCandidates' : 'calleeCandidates';
        setDoc(doc(db, 'calls', 'primary'), {
          [field]: arrayUnion(event.candidate.toJSON())
        }, { merge: true }).catch(e => console.error("Error adding ice candidate:", e));
      }
    };
  };

  const handleStartCall = async (useVideo) => {
    setIsVideo(useVideo);
    setCallState('ringing');
    
    try {
      await setupMediaAndPC(useVideo, true);

      // Safari Transceiver Fix: Explicitly ask to receive audio and video
      const offer = await pc.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      const callData = {
        caller: role,
        video: useVideo,
        offer: { type: offer.type, sdp: offer.sdp },
      };
      await setDoc(doc(db, 'calls', 'primary'), callData);
      
      await pc.current.setLocalDescription(offer);

      // Notify partner
      fetch(`${BACKEND_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderRole: role,
          title: "Incoming Call 📞",
          body: `${role === 'parshwa' ? 'Parshwa' : 'Diya'} is calling you!`
        })
      }).catch(e => console.error("Notify failed:", e));

    } catch (err) {
      console.error(err);
      handleCleanup();
      alert("Failed to start call. Please check microphone/camera permissions.");
    }
  };

  const handleAcceptCall = async () => {
    setCallState('connected');
    const data = callDocData.current;
    
    try {
      await setupMediaAndPC(data.video, false);

      const rtcSessionDescription = new RTCSessionDescription(data.offer);
      await pc.current.setRemoteDescription(rtcSessionDescription);

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      await updateDoc(doc(db, 'calls', 'primary'), {
        answer: { type: answer.type, sdp: answer.sdp }
      });

      // Process any ICE candidates that arrived before the call was accepted
      if (data.callerCandidates) {
        data.callerCandidates.forEach(async (candidateData) => {
          if (!processedCandidates.current.has(candidateData.candidate)) {
            processedCandidates.current.add(candidateData.candidate);
            try {
              await pc.current.addIceCandidate(new RTCIceCandidate(candidateData));
            } catch (err) {}
          }
        });
      }
    } catch (err) {
      console.error(err);
      handleCleanup();
    }
  };

  const handleEndCall = async () => {
    await deleteDoc(doc(db, 'calls', 'primary'));
    handleCleanup();
  };

  const handleCleanup = () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState(null);
    setIsMuted(false);
    setIsVideoOff(false);
    processedCandidates.current.clear();
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // --- RENDER ---
  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-title">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <h2 className="chat-name">{partnerRole}</h2>
        </div>
        <div className="chat-actions">
          <button className="call-btn" onClick={() => handleStartCall(false)}><Phone size={22} /></button>
          <button className="call-btn" onClick={() => handleStartCall(true)}><Video size={24} /></button>
        </div>
      </div>

      <div className="messages-area">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender === role ? 'mine' : 'theirs'}`}>
            <span className="message-text">{msg.text}</span>
            <div className="message-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '4px', opacity: 0.7, fontSize: '0.75rem' }}>
              <span className="message-time">
                {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
              </span>
              {msg.sender === role && (
                <span className="read-receipt">
                  {msg.read ? <CheckCheck size={14} color="var(--accent-neon)" /> : <Check size={14} />}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

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

      {/* CALL OVERLAY */}
      {callState && (
        <div className="call-overlay animate-fade-in">
          <div className="call-header">
            <h2>{partnerRole.toUpperCase()}</h2>
            <div className="call-status">
              {callState === 'ringing' && 'Calling...'}
              {callState === 'incoming' && 'Incoming Call...'}
              {callState === 'connected' && 'Connected'}
            </div>
          </div>

          <div className="video-container">
            {isVideo && (
              <>
                <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
                <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
              </>
            )}
          </div>

          <div className="call-controls">
            {callState === 'incoming' ? (
              <>
                <button className="control-btn end-call" onClick={handleEndCall}>
                  <PhoneOff size={28} />
                </button>
                <button className="control-btn accept-call" onClick={handleAcceptCall}>
                  <PhoneCall size={28} />
                </button>
              </>
            ) : (
              <>
                <button className={`control-btn ${isMuted ? 'off' : ''}`} onClick={toggleMute}>
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
                {isVideo && (
                  <button className={`control-btn ${isVideoOff ? 'off' : ''}`} onClick={toggleVideo}>
                    {isVideoOff ? <VideoOff size={24} /> : <VideoIcon size={24} />}
                  </button>
                )}
                <button className="control-btn end-call" onClick={handleEndCall}>
                  <PhoneOff size={28} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
