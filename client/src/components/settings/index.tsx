import React, { useState } from 'react';
import './style.css';

function Settings() {
  const [textSize, setTextSize] = useState<'normal' | 'large'>('normal');

  const handleToggleTextSize = () => {
    setTextSize((prev) => (prev === 'normal' ? 'large' : 'normal'));
  };

  return (
    <div className={`settings ${textSize === 'large' ? 'large-text' : ''}`}>
      <h1>Settings</h1>
      <div className="settings-content">
        <div className="setting-item">
          <label>Text Size</label>
          <button 
            className="enlarge-text-btn" 
            onClick={handleToggleTextSize}
          >
            {textSize === 'normal' ? 'Enlarge Text' : 'Normal Text'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;
