require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webpush = require('web-push');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

// Self-ping to prevent Render from sleeping (every 14 mins)
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(`${RENDER_EXTERNAL_URL}/ping`)
      .then(res => console.log(`Self-ping: ${res.status}`))
      .catch(err => console.error(`Self-ping error:`, err));
  }, 14 * 60 * 1000);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
