import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import contentData from '../data/content.json';

export const checkAndAwardHeart = async (role) => {
  try {
    const todayStrDrop = new Date().toLocaleDateString('en-CA');
    const todayDate = new Date();
    const startDateQ = new Date('2026-08-15T00:00:00');
    
    // Check Daily Drop
    const dropDoc = await getDoc(doc(db, 'dailyDrops', todayStrDrop));
    const hasDrop = dropDoc.exists() && dropDoc.data()[role];
    
    // Check QandA
    const questions = contentData.questions;
    const diffDays = Math.floor(Math.abs(todayDate - startDateQ) / (1000 * 60 * 60 * 24));
    const currentQIndex = diffDays % questions.length;
    const currentQ = questions[currentQIndex];
    const docId = `q_${currentQ.id}_${todayStrDrop}`;
    
    const qaDoc = await getDoc(doc(db, 'qanda', docId));
    const hasQA = qaDoc.exists() && qaDoc.data()[role];

    if (hasDrop && hasQA) {
      const statsRef = doc(db, 'appData', 'stats');
      const statsDoc = await getDoc(statsRef);
      const data = statsDoc.exists() ? statsDoc.data() : { hearts: 10, awarded: {} };
      
      const awardKey = `${role}_${todayStrDrop}`;
      if (!data.awarded || !data.awarded[awardKey]) {
        const newHearts = (data.hearts || 0) + 1;

        // Prune awarded keys older than 7 days to keep the document small
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = cutoff.toLocaleDateString('en-CA');
        const pruned = {};
        for (const [key, val] of Object.entries(data.awarded || {})) {
          // Key format: "role_YYYY-MM-DD" — extract date part
          const datePart = key.split('_').slice(1).join('_');
          if (datePart >= cutoffStr) {
            pruned[key] = val;
          }
        }
        pruned[awardKey] = true;

        await setDoc(statsRef, {
          hearts: newHearts,
          awarded: pruned
        }, { merge: true });
        return true; // Awarded!
      }
    }
    return false;
  } catch (err) {
    console.error("Error awarding heart:", err);
    return false;
  }
};
