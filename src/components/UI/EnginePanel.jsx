import React from 'react';

export default function EnginePanel({
  engineName,
  isSettingsOpen,
  setIsSettingsOpen,
  enginePath,
  setEnginePath,
  searchDepth,
  setSearchDepth,
  multiPv,
  setMultiPv,
  threads,
  setThreads,
  hashMb,
  setHashMb,
  engineLines,
  isEngineThinking
}) {
  return (
    <div className="engine-section">
      <div className="engine-header" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 className="engine-title">{engineName.toUpperCase()}</h3>
        </div>
        
        <button  
           className={`settings-toggle-btn ${isSettingsOpen ? 'open' : ''}`}
           onClick={() => setIsSettingsOpen(!isSettingsOpen)}
           title="Engine Settings"
        >
          SETTINGS
        </button>

        {isSettingsOpen && (
           <div className="settings-dropdown">
              <div className="setting-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                <div className="setting-label" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                   <span>Engine Executable (.exe)</span>
                   {enginePath && (
                     <span style={{ color: '#888', fontSize: '10px', fontFamily: 'monospace', maxWidth: '180px', wordBreak: 'break-all' }}>
                       ...\{enginePath.split('\\').pop()}
                     </span>
                   )}
                </div>
                <div>
                  <button 
                     className="settings-toggle-btn"
                     style={{ fontSize: '11px', padding: '4px 8px', borderColor: '#aaa' }}
                     onClick={async () => {
                        try {
                          const ipc = window.require('electron').ipcRenderer;
                          const path = await ipc.invoke('dialog:openFile');
                          if (path) {
                            setEnginePath(path);
                            localStorage.setItem('chess_engine_path', path);
                          }
                        } catch (err) {
                           alert('Failed to launch OS File Picker natively over IPC: ' + err.message);
                        }
                     }} 
                  >
                     SELECT LOCALLY
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-label">Depth</div>
                <div className="stepper-control">
                  <button onClick={() => setSearchDepth(Math.max(5, searchDepth - 1))}>-</button>
                  <span>{searchDepth}</span>
                  <button onClick={() => setSearchDepth(Math.min(30, searchDepth + 1))}>+</button>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-label">Multi-PV</div>
                <div className="stepper-control">
                  <button onClick={() => setMultiPv(Math.max(1, multiPv - 1))}>-</button>
                  <span>{multiPv}</span>
                  <button onClick={() => setMultiPv(Math.min(5, multiPv + 1))}>+</button>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-label">Threads</div>
                <div className="stepper-control">
                  <button onClick={() => setThreads(Math.max(1, threads - 1))}>-</button>
                  <span>{threads}</span>
                  <button onClick={() => setThreads(Math.min(16, threads + 1))}>+</button>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-label">Hash (MB)</div>
                <div className="pill-group">
                  {[16, 64, 256, 1024].map(val => (
                    <button 
                       key={val}
                       className={`pill-btn ${hashMb === val ? 'active' : ''}`}
                       onClick={() => setHashMb(val)}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
           </div>
        )}
      </div>

      <div className="engine-lines-container">
        {engineLines.length === 0 && isEngineThinking && (
          <div style={{color: '#888', fontStyle: 'italic'}}>
            Analyzing position...
          </div>
        )}
        {engineLines.map(line => (
          <div key={`m${line.multipv}-d${line.depth}`} className="engine-line">
            <div className="engine-main-line">
              <span className="engine-prefix">&lt;-&gt;</span>
              <span className="engine-eval">{line.score}</span>
              {line.moves.map((m, i) => (
                <span key={i} className={`engine-move ${m.includes('x') ? 'capture' : ''}`}>
                  {m}
                </span>
              ))}
            </div>
            <div className="engine-meta">
              (Depth: {line.depth}, N: {(line.nodes / 1000).toFixed(1)}k, NPS: {(line.nps / 1000).toFixed(1)}k, Time: {(line.time / 1000).toFixed(1)}s)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
