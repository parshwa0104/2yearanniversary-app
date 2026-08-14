import { useState } from 'react';
import DailyDrop from './DailyDrop';
import QandA from './QandA';
import './Connect.css';

const Connect = () => {
  const [activeTab, setActiveTab] = useState('daily');

  return (
    <div className="page-container connect-page">
      <div className="editorial-tabs">
        <button 
          className={`ed-tab ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          Daily Drop
        </button>
        <button 
          className={`ed-tab ${activeTab === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          Q&A
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'daily' ? <DailyDrop /> : <QandA />}
      </div>
    </div>
  );
};

export default Connect;
