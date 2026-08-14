import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Edit2, Check } from 'lucide-react';
import { db } from '../firebase';
import DateLog from './DateLog';
import './Dates.css';

const dateIdeas = [
  // 📍 Midpoint Meetups (Bandra, Andheri, Juhu - Best for splitting the travel)
  "Bandra Hill Road thrift shopping followed by lunch at Candies",
  "Walk at Juhu Beach and getting street food at the Juhu Chowpatty stalls",
  "Catch a weekend afternoon movie at Citi Mall, Andheri",
  "Cafe hopping in Bandra starting at a cute bakery",
  "Arcade showdown at Timezone or Smaaash in Andheri/Lower Parel",
  "Take a walk at Carter Road promenade and grab shawarmas",
  "Try the momo stalls at Lokhandwala market, Andheri",
  "Explore Jio World Drive (BKC) just for window shopping and a fancy coffee",
  "Sunday brunch at a pretty aesthetic cafe in Bandra",
  "Go bowling at an arcade and loser buys the dessert afterwards",
  "Try a completely new cuisine (like Korean or Japanese) in Andheri",
  "Book a 1-hour badminton slot at a midpoint turf and grab juice after",
  "Find a cat or dog cafe in the suburbs and play with pets for 2 hours",
  "Get tickets to a weekend afternoon stand-up comedy show in Bandra",
  "Go to a board game cafe in Juhu and play high-stakes games",

  // 📍 South Bombay Dates (She takes the fast train to you)
  "Sunset sitting at Marine Drive followed by pizza at Churchgate",
  "Walk around Kala Ghoda and take aesthetic photos of each other",
  "Explore the CSMVS Museum for 2 hours and get ice cream at K Rustoms",
  "Sunday morning breakfast at Kyani & Co. or a classic Irani Cafe",
  "Window shopping for tailored clothes or dresses at Palladium/Phoenix Mall",
  "Take the afternoon ferry from Gateway of India (quick 1-hour round trip)",
  "Walk around Horniman Circle and get coffee at a quiet Fort cafe",
  "Colaba Causeway street shopping followed by lunch at Leopold Cafe",
  "Book tickets for an afternoon play or show at NCPA",
  "Find the best street sandwiches near Charni Road/Marine Lines",
  "Walk through Taraporewala Aquarium (if open) or just chill at Girgaon Chowpatty",
  "Go on a SoBo dessert crawl (waffles, ice cream, pastries)",
  "Visit an art gallery in Kala Ghoda like Jehangir Art Gallery",
  "Have a 'tourist in our own city' day walking around South Bombay architecture",
  "Get matching aesthetic sunglasses at a Colaba street stall",

  // 📍 Borivali / North Mumbai Dates (You travel to her area)
  "Early morning cycling at Sanjay Gandhi National Park (SGNP)",
  "Spend the afternoon at Inorbit or Infinity Mall Malad (Food court + Arcade)",
  "Food walk through IC Colony in Borivali",
  "Take the ferry to Gorai Beach for a quick afternoon sunset trip",
  "Go to Snow World or a trampoline park in the northern suburbs",
  "Explore the cafes in Mindspace, Malad",
  "Catch a movie at a theatre near her so she doesn't have to travel",
  "Try the best street dosas outside Borivali West station",
  "Find a rooftop cafe in Borivali/Kandivali for a late afternoon lunch",
  "Walk around a quiet park in her neighborhood with iced coffees",
  "Go plant shopping at a local nursery",
  "Find a local flea market or pop-up exhibition in the suburbs",

  // 🍕 4-Hour Food-Focused Outings (Meals that take time)
  "Go to Barbeque Nation or Global Fusion and see who can eat the most",
  "DIY dessert date: Go to a place where we can build our own ice cream sundaes",
  "The 3-Course challenge: App at one place, Main at another, Dessert at a third",
  "Food critic date: Try a new street food stall and rate it out of 10",
  "Blind taste test: Order for each other at a restaurant without telling",
  "Find the most aesthetic cafe purely for Instagram photos and good drinks",
  "Go to a 5-star hotel coffee shop just to split one expensive dessert",
  "Find the best authentic Vada Pav spot on the Western line",
  "Try a heavy, authentic unlimited Thali place",
  "Buy random snacks from a supermarket and have an indoor picnic",

  // 🎡 4-Hour Activities & Experiences
  "Go to a pottery-making workshop on a Saturday afternoon",
  "Paint and sip (canvas painting at a cafe/workshop)",
  "Try an Escape Room and see if we can break out in 60 minutes",
  "Take a 1-day weekend workshop (baking, resin art, photography)",
  "Go to a photo booth and get physical strip photos taken",
  "Create a personalized fragrance for each other at a perfume workshop",
  "Visit a local animal shelter and volunteer for a few hours",
  "Go to a gaming lounge and play PS5/PC games side-by-side",
  "Have a 'no phones allowed' 4-hour date",
  "Pick out outfits for each other at a mall and try them on (without buying)",

  // 💻 Virtual (For the weekends we just can't meet)
  "Discord movie night with screen share and snacks at home",
  "Stream me playing GTA V or RDR2 while we talk on Discord",
  "Watch the Marvel's Spider-Man story cutscenes together like a movie on stream",
  "Order Zomato to each other's houses and eat together on FaceTime",
  "Play online chess, Skribbl.io, or a co-op web game",
  "Do an online couples' compatibility or personality test together",
  "Make a collaborative Spotify playlist for our 3rd year together",
  "Watch a stand-up comedy special via WatchParty",
  "Plan our dream post-graduation trip on Google Maps while on call",
  "Send each other a random song to listen to at the exact same time",

  // 🚀 Fun & Spontaneous 4-Hour Blocks
  "Take the local train to a random station we've never been to and explore",
  "Write letters to our future selves at a cafe to open next year",
  "Recreate our first date exactly how it happened",
  "Go to Crossword/bookstore, split up, and pick a book for each other",
  "Discuss our 5-year goals over a heavy lunch",
  "Scroll through our 2 years of photos together at a cafe corner",
  "Buy a cheap disposable camera/film app and use it up in one afternoon",
  "Write down 10 things we love about each other and read them on the train ride home",
  "Map out all the cafes in Mumbai we want to visit in an Excel sheet",
  "Give each other honest style/fashion advice for upcoming family weddings",
  "Try a completely new hairstyle idea or grooming routine consultation for me",
  "Play 20 questions on the train ride home together",
  "Go to a luxury car showroom just to look at the cars and pretend we are buying",
  "Find a local carnival or mela happening in the city",
  "Buy cheap matching phone covers at a street market",
  "Sit in a park and rank our top 5 memories from the last 2 years",
  "Exchange physical anniversary gifts at a quiet, hidden cafe",
  "Share a single umbrella during a heavy Mumbai monsoon walk",
  "Take a BEST double-decker bus ride (if we can find one) on the front seat",
  "Just sit in silence, holding hands, enjoying each other's presence after a long week"
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
