import React from 'react';

export default function ImportModal({ isImportOpen, setIsImportOpen, importText, setImportText, handleImport }) {
  if (!isImportOpen) return null;

  return (
    <div style={{
       position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
       background: 'rgba(0,0,0,0.8)', zIndex: 100, 
       display: 'flex', alignItems: 'center', justifyContent: 'center',
       backdropFilter: 'blur(4px)'
    }}>
       <div style={{
          background: '#121212', border: '1px solid #333', 
          padding: '24px', borderRadius: '8px', width: '500px', 
          display: 'flex', flexDirection: 'column', gap: '16px',
          fontFamily: 'var(--sans)'
       }}>
          <h3 style={{ margin: 0, color: '#fff', fontFamily: 'var(--heading)', letterSpacing: '2px' }}>IMPORT PGN</h3>
          <textarea 
            style={{
              height: '250px', background: '#0b0b0b', color: '#ccc',
              border: '1px solid #333', padding: '12px',
              fontFamily: 'var(--mono)', fontSize: '13px', resize: 'none',
              outline: 'none', borderRadius: '4px'
            }}
            placeholder="Paste external PGN game history here..."
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
             <button className="settings-toggle-btn" onClick={() => setIsImportOpen(false)}>CANCEL</button>
             <button className="settings-toggle-btn" onClick={() => handleImport()} style={{ borderColor: '#aaa' }}>LOAD GAME</button>
          </div>
       </div>
    </div>
  );
}
