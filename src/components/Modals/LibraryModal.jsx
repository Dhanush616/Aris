import React, { useEffect } from 'react';

export default function LibraryModal({ isLibraryOpen, setIsLibraryOpen, savedGames, setSavedGames, handleImport, dbFilePath, setDbFilePath }) {
  useEffect(() => {
    if (isLibraryOpen && dbFilePath) {
      try {
        const fs = window.require('fs');
        if (!fs.existsSync(dbFilePath)) {
          setDbFilePath('');
          localStorage.removeItem('chess_db_file_path');
          
          const storedItems = localStorage.getItem('chess_saved_games');
          if (storedItems) {
            setSavedGames(JSON.parse(storedItems));
          } else {
            setSavedGames([]);
          }
        }
      } catch { /* Ignore error */ }
    }
  }, [isLibraryOpen, dbFilePath, setDbFilePath, setSavedGames]);

  if (!isLibraryOpen) return null;

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
          maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px',
          fontFamily: 'var(--sans)'
       }}>
          <h3 style={{ margin: 0, color: '#fff', fontFamily: 'var(--heading)', letterSpacing: '2px' }}>SAVED GAMES</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
             <div style={{ fontSize: '11px', color: '#888' }}>
                Database File: {dbFilePath || 'None (Using Local Storage)'}
             </div>
             <div style={{ display: 'flex', gap: '8px' }}>
               <button className="settings-toggle-btn" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={async () => {
                  try {
                    const ipc = window.require('electron').ipcRenderer;
                    const fs = window.require('fs');
                    const path = await ipc.invoke('dialog:openDbFile');
                    if (path) {
                      setDbFilePath(path);
                      localStorage.setItem('chess_db_file_path', path);
                      
                      if (fs.existsSync(path)) {
                         try {
                           const data = fs.readFileSync(path, 'utf8');
                           setSavedGames(JSON.parse(data));
                         } catch(e) {
                           alert("Failed to parse DB file: " + e.message);
                         }
                      }
                    }
                  } catch (e) {
                    alert("Failed to open DB file: " + e.message);
                  }
               }}>OPEN EXISTING DB</button>
               
               <button className="settings-toggle-btn" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={async () => {
                  try {
                    const ipc = window.require('electron').ipcRenderer;
                    const fs = window.require('fs');
                    const path = await ipc.invoke('dialog:selectDbFile');
                    if (path) {
                      setDbFilePath(path);
                      localStorage.setItem('chess_db_file_path', path);
                      
                      if (fs.existsSync(path)) {
                         try {
                           const data = fs.readFileSync(path, 'utf8');
                           setSavedGames(JSON.parse(data));
                         } catch(e) {
                           fs.writeFileSync(path, JSON.stringify(savedGames, null, 2));
                         }
                      } else {
                         fs.writeFileSync(path, JSON.stringify(savedGames, null, 2));
                      }
                    }
                  } catch (e) {
                    alert("Failed to create DB file: " + e.message);
                  }
               }}>CREATE NEW DB</button>
             </div>
          </div>

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
            {savedGames.length === 0 && <span style={{ color: '#888', fontStyle: 'italic', fontSize: '13px' }}>No games saved yet.</span>}
            {savedGames.map(sg => (
              <div key={sg.id} style={{ 
                 background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '4px',
                 border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                   <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{sg.name}</span>
                   <span style={{ color: '#888', fontSize: '11px', fontFamily: 'var(--mono)' }}>{sg.date}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <button className="settings-toggle-btn" style={{ fontSize: '10px', padding: '2px 6px' }} onClick={() => {
                      const updated = savedGames.filter(g => g.id !== sg.id);
                      setSavedGames(updated);
                      if (dbFilePath) {
                         try {
                           const fs = window.require('fs');
                           fs.writeFileSync(dbFilePath, JSON.stringify(updated, null, 2));
                         } catch { /* Ignore error */ }
                      } else {
                         localStorage.setItem('chess_saved_games', JSON.stringify(updated));
                      }
                   }}>DELETE</button>
                   <button className="settings-toggle-btn" style={{ borderColor: '#aaa', color: '#fff' }} onClick={() => {
                      handleImport(sg.pgn);
                      setIsLibraryOpen(false);
                   }}>LOAD</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
             <button className="settings-toggle-btn" onClick={() => setIsLibraryOpen(false)}>CLOSE</button>
          </div>
       </div>
    </div>
  );
}
