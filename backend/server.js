require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
let db = null;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Used in production (Render)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Used locally
    serviceAccount = require('./serviceAccountKey.json');
  }
  
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  db = getFirestore();
} catch (error) {
  console.log("Waiting for Firebase credentials or error parsing:", error.message);
}

// Configure Web Push VAPID Keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails('mailto:test@test.com', publicVapidKey, privateVapidKey);
}

// 1. Subscribe Endpoint (saves the user's subscription to Firestore)
app.post('/subscribe', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not initialized' });
  const subscription = req.body.subscription;
  const userRole = req.body.userRole; // 'parshwa' or 'diya'
  
  try {
    await db.collection('subscriptions').doc(userRole).set({ subscription });
    res.status(201).json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// 2. Notify Endpoint (triggers a push notification to the partner)
app.post('/notify', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not initialized' });
  const { senderRole, title, body } = req.body;
  const targetRole = senderRole === 'parshwa' ? 'diya' : 'parshwa';

  try {
    const doc = await db.collection('subscriptions').doc(targetRole).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Target user not subscribed' });
    }
    
    const subscription = doc.data().subscription;
    const payload = JSON.stringify({ title, body });
    
    await webpush.sendNotification(subscription, payload);
    res.status(200).json({ message: 'Notification sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Keep-Alive Endpoint
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Agora Token Generation Endpoint
app.get('/rtcToken', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  
  const channelName = req.query.channelName;
  if (!channelName) {
    return res.status(400).json({ error: 'channelName is required' });
  }

  let uid = req.query.uid;
  if (!uid || uid === '') {
    return res.status(400).json({ error: 'uid is required' });
  }
  // Convert uid to integer (Agora requires integer UIDs for their standard tokens)
  uid = parseInt(uid, 10);

  const role = RtcRole.PUBLISHER;
  const expireTime = 3600; // 1 hour token validity
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const appID = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appID || !appCertificate) {
    return res.status(500).json({ error: 'Agora App ID and Certificate must be set in environment' });
  }

  try {
    const token = RtcTokenBuilder.buildTokenWithUid(appID, appCertificate, channelName, uid, role, privilegeExpireTime);
    return res.json({ token });
  } catch (err) {
    console.error("Error generating token:", err);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Self-ping to prevent Render from sleeping (every 14 mins)
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(`${RENDER_EXTERNAL_URL}/ping`)
      .then(res => console.log(`Self-ping: ${res.status}`))
      .catch(err => console.error(`Self-ping error:`, err));
  }, 14 * 60 * 1000);
}

app.get('/repair-streak', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not initialized' });
  try {
    const startDate = new Date('2026-08-15T00:00:00');
    const today = new Date();
    let count = 0;
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const docRef = db.collection('dailyDrops').doc(dayStr);
      const docSnap = await docRef.get();
      let data = docSnap.exists ? docSnap.data() : {};
      let updated = false;
      const dummyDrop = {
        message: "Streak restored! ❤️",
        photo: null, 
        timestamp: new Date().toISOString()
      };
      if (!data.parshwa) { data.parshwa = dummyDrop; updated = true; }
      if (!data.diya) { data.diya = dummyDrop; updated = true; }
      if (updated) {
        await docRef.set(data, { merge: true });
        count++;
      }
    }
    res.status(200).json({ message: `Streak repaired successfully! Fixed ${count} days.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
