import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

const THEMES = [
    { id: 'default', name: '🔴 Original Neon' },
    { id: 'cyberpunk', name: '🟡 Cyberpunk' },
    { id: 'synthwave', name: '🟣 Synthwave' },
    { id: 'hacker', name: '🟢 Hacker Grid' },
    { id: 'ocean', name: '🔵 Ocean' },
    { id: 'sunset', name: '🟠 Sunset' }
];

const SettingsModal = ({ isOpen, onClose, currentProfile, onUpdateProfile }) => {
    const [volume, setVolume] = useState(
        localStorage.getItem('crazy_crack_volume') ? parseFloat(localStorage.getItem('crazy_crack_volume')) : 0.5
    );
    const [theme, setTheme] = useState(
        localStorage.getItem('crazy_crack_theme') || 'default'
    );
    const [animStyle, setAnimStyle] = useState(currentProfile?.animStyle || 'pop');

    useEffect(() => {
        if (currentProfile) setAnimStyle(currentProfile.animStyle || 'pop');
    }, [currentProfile]);

    if (!isOpen) return null;

    const handleVolumeChange = (e) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        window.crazyCrackVolume = v;
        localStorage.setItem('crazy_crack_volume', v.toString());
    };

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('crazy_crack_theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const handleAnimChange = (newAnim) => {
        setAnimStyle(newAnim);
        if (currentProfile) {
            const updated = { ...currentProfile, animStyle: newAnim };
            onUpdateProfile(updated);
            localStorage.setItem('crazy_crack_anim', newAnim);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="settings-modal panel">
                <h2>Settings</h2>
                
                <div className="settings-section">
                    <h3>Theme</h3>
                    <div className="theme-grid">
                        {THEMES.map(t => (
                            <button 
                                key={t.id}
                                className={`theme-btn ${theme === t.id ? 'active' : ''}`}
                                onClick={() => handleThemeChange(t.id)}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="settings-section">
                    <h3>Audio Volume</h3>
                    <input 
                        type="range" 
                        min="0" max="1" step="0.1" 
                        value={volume} 
                        onChange={handleVolumeChange} 
                        className="volume-slider"
                    />
                    <div className="volume-label">{Math.round(volume * 100)}%</div>
                </div>

                {currentProfile && (
                    <div className="settings-section">
                        <h3>Strike Animation</h3>
                        <div className="anim-toggles">
                            <button className={`anim-btn ${animStyle === 'pop' ? 'active' : ''}`} onClick={() => handleAnimChange('pop')}>Pop</button>
                            <button className={`anim-btn ${animStyle === 'burn' ? 'active' : ''}`} onClick={() => handleAnimChange('burn')}>Burn</button>
                            <button className={`anim-btn ${animStyle === 'melt' ? 'active' : ''}`} onClick={() => handleAnimChange('melt')}>Melt</button>
                        </div>
                    </div>
                )}

                <button className="primary-btn close-settings" onClick={onClose}>Done</button>
            </div>
        </div>
    );
};

export default SettingsModal;
