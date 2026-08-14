import { useState } from 'react';
import DateLog from './DateLog';
import './Dates.css';

const dateIdeas = [
  "Cozy movie night with homemade popcorn",
  "Try a new restaurant we've never been to",
  "Late night drive with our favorite playlist",
  "Cook a complex meal together",
  "Go for a walk in a new park",
  "Have a living room picnic",
  "Visit an art gallery or museum",
  "Stargazing with blankets",
  "Bake something sweet together"
];

const Dates = () => {
  const [randomDate, setRandomDate] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);

  const generateDate = () => {
    setIsSpinning(true);
    setRandomDate('');
    
    let spins = 0;
    const interval = setInterval(() => {
      setRandomDate(dateIdeas[Math.floor(Math.random() * dateIdeas.length)]);
      spins++;
      if (spins > 10) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  };

  return (
    <div className="page-container dates-page">
      <div className="generator-section">
        <h2 className="section-title">Can't decide?</h2>
        
        <div className="roulette-container">
          <div className={`roulette-text ${isSpinning ? 'spinning' : ''}`}>
            {randomDate || "Tap below to let fate decide"}
          </div>
        </div>
        
        <button 
          className="editorial-text-btn center-btn" 
          onClick={generateDate}
          disabled={isSpinning}
        >
          Generate Idea
        </button>
      </div>

      <div className="timeline-section">
        <h2 className="section-title">Our story so far</h2>
        <DateLog />
      </div>
    </div>
  );
};

export default Dates;
