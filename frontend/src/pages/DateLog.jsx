import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import { db } from '../firebase';
import './DateLog.css';

const DateLog = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState({ title: '', location: '', liked: '', customDate: '' });
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "dates"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const datesData = [];
      snapshot.forEach((doc) => {
        datesData.push({ id: doc.id, ...doc.data() });
      });

      // Add first date manually if empty (or always append it at bottom)
      const firstDate = {
        id: 'first-date',
        title: "Our First Date",
        location: "Nariman Point",
        liked: "My paryushan was going on so I couldn't eat anything outside. We just sat close to each other. I was nervous to hold you close to me, but I finally did when we went back to the station.",
        date: "Sept 07, 2024"
      };

      setDates([...datesData, firstDate]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleAddDate = async (e) => {
    e.preventDefault();
    if (!newDate.title) return;

    let targetDate = new Date();
    if (newDate.customDate) {
      // Split YYYY-MM-DD to avoid timezone shifts when passing to new Date()
      const [y, m, d] = newDate.customDate.split('-');
      targetDate = new Date(y, m - 1, d);
    }

    const dateStr = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    try {
      await addDoc(collection(db, "dates"), {
        title: newDate.title,
        location: newDate.location,
        liked: newDate.liked,
        date: dateStr,
        timestamp: targetDate
      });
      setNewDate({ title: '', location: '', liked: '', customDate: '' });
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDate = async (id) => {
    if (window.confirm("Are you sure you want to delete this memory?")) {
      try {
        await deleteDoc(doc(db, "dates", id));
      } catch (err) {
        console.error("Error deleting document:", err);
      }
    }
  };

  return (
    <div className="timeline-wrapper">
      <div className="timeline-actions">
        <button className="editorial-text-btn" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : 'Add to our story...'}
        </button>
      </div>

      {showAddForm && (
        <form className="add-timeline-form animate-fade-in" onSubmit={handleAddDate}>
          <div className="editorial-input-group">
            <input
              type="text"
              className="editorial-input"
              placeholder="What did we do?"
              value={newDate.title}
              onChange={(e) => setNewDate({ ...newDate, title: e.target.value })}
              required
            />
          </div>

          <div className="editorial-input-group">
            <input
              type="text"
              className="editorial-input"
              placeholder="Where?"
              value={newDate.location}
              onChange={(e) => setNewDate({ ...newDate, location: e.target.value })}
            />
          </div>

          <div className="editorial-input-group">
            <textarea
              className="editorial-textarea"
              placeholder="What made it special?"
              value={newDate.liked}
              onChange={(e) => setNewDate({ ...newDate, liked: e.target.value })}
              rows="3"
            />
          </div>

          <div className="editorial-input-group">
            <label style={{display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-pearl)', opacity: 0.8}}>When did this happen? (Leave blank for today)</label>
            <input
              type="date"
              className="editorial-input"
              value={newDate.customDate}
              onChange={(e) => setNewDate({ ...newDate, customDate: e.target.value })}
            />
          </div>

          <div className="form-submit-row">
            <button type="submit" className="editorial-text-btn">Save memory</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-blush)' }}>Loading memories...</div>
      ) : (
        <div className="true-timeline">
          {dates.map((date, index) => (
            <div key={date.id} className={`timeline-node ${index % 2 === 0 ? 'left' : 'right'} animate-fade-in`}>
              <div className="node-dot"></div>
              <div className="node-content" style={{ position: 'relative' }}>
                {date.id !== 'first-date' && (
                  <button 
                    onClick={() => handleDeleteDate(date.id)}
                    style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-pearl)', opacity: 0.5, cursor: 'pointer', padding: '4px' }}
                    title="Delete memory"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <span className="node-date">{date.date}</span>
                <h3 className="node-title">{date.title}</h3>
                {date.location && <span className="node-location">{date.location}</span>}
                {date.liked && <p className="node-memory">{date.liked}</p>}
              </div>
            </div>
          ))}
          <div className="timeline-node center end-node">
            <div className="node-dot faded"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateLog;
