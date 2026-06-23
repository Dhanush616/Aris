import React from 'react';

export default function SaveModal({ isSaveOpen, setIsSaveOpen, saveName, setSaveName, handleSaveGame }) {
  if (!isSaveOpen) return null;

  return (
    <div style={{
       position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
       background: 'rgba(0,0,0,0.8)', zIndex: 100, 
       display: 'flex', alignItems: 'center', justifyContent: 'center',
       backdropFilter: 'blur(4px)'
    }}>
       <div style={{
          background: '#121212', border: '1px solid #333', 
          padding: '24px', borderRadius: '8px', width: '400px', 
          display: 'flex', flexDirection: 'column', gap: '16px',
          fontFamily: 'var(--sans)'
       }}>
          <h3 style={{ margin: 0, color: '#fff', fontFamily: 'var(--heading)', letterSpacing: '2px' }}>SAVE GAME</h3>
          <input 
            style={{
              background: '#0b0b0b', color: '#ccc', border: '1px solid #333', padding: '12px',
              fontFamily: 'var(--sans)', fontSize: '14px', outline: 'none', borderRadius: '4px'
            }}
            placeholder="Game Title (e.g. My Caro-Kann Study)"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
             <button className="settings-toggle-btn" onClick={() => setIsSaveOpen(false)}>CANCEL</button>
             <button className="settings-toggle-btn" onClick={handleSaveGame} style={{ borderColor: '#aaa' }}>SAVE</button>
          </div>
       </div>
    </div>
  );
}
