import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Edit2, Check } from 'lucide-react';
import { db } from '../firebase';
import DateLog from './DateLog';
import './Dates.css';

const defaultDateIdeas = [
  // 🚆 Transit & Mid-Point Meetups (To split the 1-hour distance)
  "Meet exactly halfway at a local station just to share a cutting chai",
  "Share a single window seat on the local train going nowhere in particular",
  "Find a cafe halfway between our houses for a quick 1-hour meetup",
  "Meet at Dadar or Andheri station just to eat Vada Pav and leave",
  "Take an AC BEST bus ride from start to finish just to talk in the AC",
  "Quick McDonald's soft-serve date at a midpoint",
  "Commute together for part of the journey and share earphones",
  "Meet for 20 minutes just to hand over a handwritten letter or hoodie",
  "Wait for each other outside the exam center",
  "Share an umbrella walk to the station during the Mumbai monsoons",

  // 💻 Virtual Dates (When 2 hours of travel is too much)
  "Discord movie night with screen share",
  "Stream me playing GTA V or RDR2 while we talk on Discord",
  "Watch the Marvel's Spider-Man story cutscenes together like a movie on stream",
  "Order Zomato to each other's houses and eat together on FaceTime",
  "Fall asleep on a voice call together",
  "Virtual Codeforces or LeetCode race on Google Meet",
  "UI/UX critique date: Roast popular apps together on a video call",
  "Build our tech startup idea on a shared Notion page while on call",
  "Play online chess, Skribbl.io, or a co-op web game",
  "Send each other 3 random Pinterest memes that sum up our day",
  "Do an online couples' compatibility or personality test together",
  "Make a collaborative Spotify playlist while on a call",
  "Late-night WhatsApp debate about a completely ridiculous hypothetical scenario",
  "Watch a stand-up comedy special via WatchParty",
  "Video call while I meal-prep my high-protein food and you study",

  // ☀️ Daytime & Curfew-Friendly Dates
  "Afternoon cinema show so we are both home by 7 PM",
  "Sunday morning breakfast at a classic Irani cafe (Bun Maska and Chai)",
  "Morning walk at Marine Drive before the sun gets too hot",
  "Daytime thrift shopping at Bandra Hill Road or Colaba Causeway",
  "Afternoon bowling at Smaaash or Timezone",
  "Ferry ride from Gateway of India (back before sunset)",
  "Explore Kala Ghoda cafes for a late Sunday brunch",
  "Go to a cat or dog cafe for a couple of hours in the afternoon",
  "Window shopping for aesthetic clothes at a luxury mall",
  "Bunk one college lecture just to grab breakfast nearby",

  // 🏏 Active & Outdoors (Daytime)
  "Sunday morning badminton at Hotfut Monte South",
  "Go to the local cricket nets and let her try batting",
  "Challenge each other to a plank contest on video call (loser Buys Swiggy)",
  "Early morning trek to a nearby fort (Vasai or Karnala)",
  "Day trip to Lonavala for Maggi (strictly returning before dark)",
  "Rent bicycles at SGNP (Sanjay Gandhi National Park) early in the morning",
  "Attend a live sports match or local cricket tournament during the day",
  "Walk along Juhu beach and get Bhutta (roasted corn)",
  "Teach her a basic calisthenics move at a local park",
  "Step-count challenge: Whoever walks more in a day wins a treat",

  // ☕ Cafes, Food & Sneaky Hangouts
  "Co-working cafe session: I code my MERN app, you do your work",
  "Go on a momo-tasting hunt around the city",
  "Find the best Shawarma spot near college",
  "Try a completely new cuisine (like Korean or Lebanese) for lunch",
  "Go to a buffet and see who can eat the most plates",
  "Drink tapri chai while it rains heavily outside",
  "Make Maggi together on the rare day one of us has an empty house for 2 hours",
  "Get Frankie/Rolls and eat them at a local park bench",
  "Try a fancy dessert parlor for a sugar rush afternoon",
  "Sit at a Starbucks for 3 hours just talking, buying only one coffee",

  // 🎨 Creative, Cheap & Low-key
  "Take a phone and do a photoshoot at Fort/Horniman Circle",
  "Plan our dream post-graduation trip on Google Maps",
  "Play 20 questions on the train ride home",
  "Go to Crossword/bookstore and pick a book for each other",
  "Write letters to our future selves to open next year",
  "Recreate our first date exactly how it happened",
  "Pick out a new signature cologne/perfume for each other at a mall tester section",
  "Browse tailored suits/dresses online and rate each other's choices",
  "Go to an arcade (Timezone/Snow World) for some mindless fun",
  "Do a blindfolded taste test with snacks at a mall food court",

  // 🚀 Quick & Spontaneous
  "Surprise 'I missed you' visit to her area just for 15 minutes",
  "Meet up during a college fest season where parents know we'll be late",
  "Go grocery shopping together for our moms just to have an excuse to hang out",
  "Buy matching cheap phone covers at a street market",
  "Help her with an assignment while on a voice call",
  "Give each other honest style/fashion advice for upcoming family weddings",
  "Try out an escape room in the afternoon",
  "Map out all the cafes in Mumbai we want to visit in an Excel sheet",
  "Buy a cheap disposable camera and use it up in one day",
  "Write down 10 things we love about each other and read them on the train",

  // 🕰️ Extra Ideas for when the stars align
  "Plan an itinerary for a trip we'll take when we finally get our own places",
  "Go to a pottery or art class that runs during the day",
  "Visit the exact place we first met",
  "Discuss our 5-year goals at a quiet cafe",
  "Tell each other a secret we haven't shared yet over a private call",
  "Scroll through our 2 years of photos together at a cafe corner",
  "Share an ice cream at Marine Drive right as the sun sets",
  "Play 3 rounds of online tic-tac-toe when bored in separate lectures",
  "Send each other a random song to listen to at the exact same time",
  "Just sit in silence and enjoy each other's presence after a long week of college"
];

const Dates = () => {
  const [ideas, setIdeas] = useState(defaultDateIdeas);
  const [randomDate, setRandomDate] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appData", "dateIdeas"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().list) {
        setIdeas(docSnap.data().list);
        setEditedText(docSnap.data().list.join('\n'));
      } else {
        setEditedText(defaultDateIdeas.join('\n'));
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    const newIdeas = editedText.split('\n').filter(i => i.trim() !== '');
    setIsEditing(false);
    try {
      await setDoc(doc(db, "appData", "dateIdeas"), { list: newIdeas });
    } catch (err) {
      console.error(err);
    }
  };

  const generateDate = () => {
    if (isEditing || ideas.length === 0) return;
    setIsSpinning(true);
    setRandomDate('');

    let spins = 0;
    const interval = setInterval(() => {
      setRandomDate(ideas[Math.floor(Math.random() * ideas.length)]);
      spins++;
      if (spins > 10) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  };

  return (
    <div className="page-container dates-page">
      <div className="generator-section" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Can't decide?</h2>
          {!isEditing ? (
            <button className="icon-btn" onClick={() => setIsEditing(true)} title="Edit Date Ideas">
              <Edit2 size={18} color="var(--text-blush)" />
            </button>
          ) : (
            <button className="icon-btn" onClick={handleSave} title="Save Ideas">
              <Check size={18} color="var(--accent-neon)" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-blush)', marginBottom: '12px', textAlign: 'left' }}>
              One idea per line. (Syncs to cloud)
            </p>
            <textarea 
              className="reasons-textarea"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows="12"
              style={{ width: '100%', padding: '16px', borderRadius: '8px', background: 'transparent', color: 'var(--text-pearl)', border: '1px solid var(--border-plum)' }}
            />
          </div>
        ) : (
          <>
            <div className="roulette-container">
              <div className={`roulette-text ${isSpinning ? 'spinning' : ''}`}>
                {randomDate || "Tap below to let fate decide"}
              </div>
            </div>

            <button
              className="editorial-text-btn center-btn"
              onClick={generateDate}
              disabled={isSpinning || ideas.length === 0}
            >
              Generate Idea
            </button>
          </>
        )}
      </div>

      <div className="timeline-section">
        <h2 className="section-title">Our story so far</h2>
        <DateLog />
      </div>
    </div>
  );
};

export default Dates;
