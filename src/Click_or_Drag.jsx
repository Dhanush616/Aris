import { useState, useRef, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

// ── Color scheme – DO NOT change these values ─────────────────────────────
const DARK_SQUARE_BG  = 'rgb(48, 50, 52)';
const LIGHT_SQUARE_BG = '#f0d9b5';

const SELECTED_BG  = 'rgba(255, 215, 0, 0.45)';
const MOVE_DOT     = 'radial-gradient(circle, rgba(0,0,0,0.25) 27%, transparent 27%)';
const CAPTURE_RING = 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 58%)';

export default function Click_or_Drag() {
  const chessGameRef = useRef(new Chess());
  const chessGame    = chessGameRef.current;

  // ── PGN Variation Tree State ──────────────────────────────────────────────
  const rootId = 'root';
  const [treeNodes, setTreeNodes] = useState({
    [rootId]: { id: rootId, fen: chessGame.fen(), san: 'Start', parentId: null, childrenIds: [], depth: 0 }
  });
  const [activeNodeId, setActiveNodeId] = useState(rootId);
  const treeNodesRef = useRef(treeNodes);
  treeNodesRef.current = treeNodes;

  const [position,     setPosition]     = useState(chessGame.fen());
  const [moveFrom,     setMoveFrom]     = useState('');
  const [squareStyles, setSquareStyles] = useState({});

  // ── Engine State ──────────────────────────────────────────────────────────
  const workerRef = useRef(null);
  const [engineLines, setEngineLines] = useState([]);
  const [searchDepth, setSearchDepth] = useState(15);
  const [multiPv, setMultiPv] = useState(5);
  const [threads, setThreads] = useState(1);
  const [hashMb, setHashMb] = useState(16);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [savedGames, setSavedGames] = useState([]);
  const [enginePath, setEnginePath] = useState('');
  const [engineName, setEngineName] = useState('No Engine Selected');
  const engineProcessRef = useRef(null);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('chess_engine_path');
      if (storedTheme) setEnginePath(storedTheme);
      const storedItems = localStorage.getItem('chess_saved_games');
      if (storedItems) setSavedGames(JSON.parse(storedItems));
    } catch(e){}
  }, []);

  // Initialize Native Engine CPU stream
  useEffect(() => {
    if (workerRef.current) workerRef.current.terminate();
    if (engineProcessRef.current) {
        try { engineProcessRef.current.kill(); } catch (e) {}
    }

    if (!enginePath) return; // Block evaluation if no native binary assigned

    try {
      const cp = window.require('child_process');
      const engine = cp.spawn(enginePath);
      engineProcessRef.current = engine;

      engine.on('error', (err) => {
         alert("ENGINE OS ERROR: " + err.message + "\n\nMake sure you selected a real .exe file!");
      });

      let stdoutBuffer = '';
      engine.stdout.on('data', (data) => {
        stdoutBuffer += data.toString();
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop(); // Keep incomplete trailing chunk

        lines.forEach(line => {
          if (!line.trim()) return;
          
          // Debug line if needed
          // console.log("[NATIVE ENGINE]: ", line); 
          
          if (line.startsWith('id name ')) {
             setEngineName(line.substring(8).trim());
          }
      
      if (line.startsWith('info depth') && line.includes(' pv ')) {
        const depthMatch = line.match(/depth (\d+)/);
        const multipvMatch = line.match(/multipv (\d+)/);
        const scoreCpMatch = line.match(/score cp (-?\d+)/);
        const scoreMateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/ pv (.*)$/); 

        if (depthMatch && multipvMatch && (scoreCpMatch || scoreMateMatch) && pvMatch) {
          const depth = parseInt(depthMatch[1], 10);
          const multipv = parseInt(multipvMatch[1], 10);
          
          let score = '';
          let winPercent = 50;
          
          if (scoreCpMatch) {
             let cp = parseInt(scoreCpMatch[1], 10);
             // Logistic probability formula for active player winning
             winPercent = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

             let cpAbs = cp / 100;
             if (chessGame.turn() === 'b') cpAbs = -cpAbs;
             score = cpAbs > 0 ? `+${cpAbs.toFixed(2)}` : cpAbs.toFixed(2);
          } else if (scoreMateMatch) {
             let mateIn = parseInt(scoreMateMatch[1], 10);
             winPercent = mateIn > 0 ? 100 : 0;

             if (chessGame.turn() === 'b') mateIn = -mateIn;
             score = mateIn > 0 ? `+M${mateIn}` : `-M${Math.abs(mateIn)}`;
          }

          const nodesMatch = line.match(/nodes (\d+)/);
          const timeMatch = line.match(/time (\d+)/);
          const npsMatch = line.match(/nps (\d+)/);

          const nodes = nodesMatch ? parseInt(nodesMatch[1], 10) : 0;
          const time = timeMatch ? parseInt(timeMatch[1], 10) : 0;
          const nps = npsMatch ? parseInt(npsMatch[1], 10) : 0;

          const rawPv = pvMatch[1];
          let formattedMoves = [];
          
          try {
             const c = new Chess(chessGame.fen());
             const moves = rawPv.split(' ').slice(0, 15);
             for (const m of moves) {
               const moveObj = c.move({ from: m.slice(0,2), to: m.slice(2,4), promotion: m[4] || 'q' });
               if (!moveObj) break;
               formattedMoves.push(moveObj.san);
             }
          } catch(err) {
             formattedMoves = rawPv.split(' ').slice(0, 15); 
          }

          setEngineLines(prev => {
            const next = [...prev];
            const filtered = next.filter(l => l.depth >= depth); // Clear shallower lines
            const existingIdx = filtered.findIndex(l => l.multipv === multipv);
            const newLine = { depth, multipv, score, winPercent, moves: formattedMoves, rawPv, nodes, time, nps };
            if (existingIdx !== -1) {
              filtered[existingIdx] = newLine;
            } else {
              filtered.push(newLine);
            }
            return filtered.sort((a,b) => a.multipv - b.multipv).slice(0, 5);
          });
        }
      }


      if (line.startsWith('bestmove')) {
        setIsEngineThinking(false);
      }
    });
   });

   const mockWorker = {
      postMessage: (msg) => {
        try { if (engine.stdin.writable) engine.stdin.write(msg + '\n'); } catch (e) {}
      },
      terminate: () => {
        try { engine.kill(); } catch (e) {}
      }
   };

   workerRef.current = mockWorker;
   mockWorker.postMessage('uci');

   } catch (err) {
      alert("NATIVE ENGINE ERROR: " + err.message);
      console.error("Failed to spawn native engine: " + err.message);
   }

   return () => {
      workerRef.current?.terminate();
      if (engineProcessRef.current) engineProcessRef.current.kill();
   };
  }, [chessGame, enginePath]);

  // ── View Sync for Timeline Navigation ────────────────────────────────────
  useEffect(() => {
     const handleKeyDown = (e) => {
        if (e.key === 'ArrowLeft') {
          setActiveNodeId(prev => {
             const parent = treeNodesRef.current[prev]?.parentId;
             return parent ? parent : prev;
          });
        } else if (e.key === 'ArrowRight') {
          setActiveNodeId(prev => {
             const children = treeNodesRef.current[prev]?.childrenIds;
             return children && children.length > 0 ? children[0] : prev;
          });
        }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
     const fen = treeNodes[activeNodeId].fen;
     if (chessGame.fen() !== fen) {
       chessGame.load(fen);
       setPosition(fen);
       setSquareStyles({});
       setMoveFrom('');
     }
  }, [activeNodeId, treeNodes, chessGame]);

  // Request analysis when position or depth changes
  useEffect(() => {
    if (chessGame.isGameOver() || !workerRef.current) return;
    
    setEngineLines([]);
    setIsEngineThinking(true);
    
    workerRef.current.postMessage('stop');
    workerRef.current.postMessage(`setoption name MultiPV value ${multiPv}`);
    workerRef.current.postMessage(`setoption name Threads value ${threads}`);
    workerRef.current.postMessage(`setoption name Hash value ${hashMb}`);
    workerRef.current.postMessage('ucinewgame');
    workerRef.current.postMessage(`position fen ${chessGame.fen()}`);
    workerRef.current.postMessage(`go depth ${searchDepth}`);
  }, [position, searchDepth, multiPv, threads, hashMb, chessGame, enginePath]);

  // ── UI Actions ────────────────────────────────────────────────────────────

  function handleActualMove(moveObj) {
    if (activeNodeId !== rootId) {
      chessGame.load(treeNodes[activeNodeId].fen);
    } else {
      // Clean slate jump to start
      chessGame.load(treeNodes[rootId].fen);
    }
    
    try {
      const result = chessGame.move(moveObj);
      if (!result) return false;
      const newFen = chessGame.fen();
      
      const newId = Date.now().toString() + Math.random().toString(36).substring(2, 6);
      
      setTreeNodes(prev => {
         const next = { ...prev };
         // Check if this identical move branch already exists in this node!
         const existingChildId = next[activeNodeId].childrenIds.find(cId => next[cId].san === result.san);
         if (existingChildId) {
            // Already an existing branch, just leap to it
            setActiveNodeId(existingChildId);
            return prev;
         }
         
         // Physically inject the new timeline branch non-destructively
         const newNode = {
           id: newId,
           fen: newFen,
           san: result.san,
           parentId: activeNodeId,
           childrenIds: [],
           depth: next[activeNodeId].depth + 1
         };
         next[newId] = newNode;
         next[activeNodeId] = {
           ...next[activeNodeId],
           childrenIds: [...next[activeNodeId].childrenIds, newId]
         };
         return next;
      });
      
      setActiveNodeId(newId);
      setPosition(newFen);
      
      setSquareStyles({});
      setMoveFrom('');
      return true;
    } catch {
      return false;
    }
  }

  function getMoveOptions(square) {
    const moves = chessGame.moves({ square, verbose: true });
    if (moves.length === 0) { setSquareStyles({}); return false; }

    const styles = {};
    for (const move of moves) {
      const occupant  = chessGame.get(move.to);
      const isCapture = occupant && occupant.color !== chessGame.get(square).color;
      styles[move.to] = {
        background: isCapture ? CAPTURE_RING : MOVE_DOT,
        borderRadius: '50%',
      };
    }
    styles[square] = { background: SELECTED_BG };
    setSquareStyles(styles);
    return true;
  }

  function onSquareClick({ piece, square }) {
    if (!moveFrom) {
      if (!piece) return;
      if (getMoveOptions(square)) setMoveFrom(square);
      return;
    }
    const success = handleActualMove({ from: moveFrom, to: square, promotion: 'q' });
    if (!success) {
      const hasMoves = getMoveOptions(square);
      setMoveFrom(hasMoves ? square : '');
      if (!hasMoves) setSquareStyles({});
    }
  }

  function onPieceDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false;
    return handleActualMove({ from: sourceSquare, to: targetSquare, promotion: 'q' });
  }

  function onPieceDrag({ square }) {
    getMoveOptions(square);
    setMoveFrom(square);
  }

  // ── Build Arrows ──────────────────────────────────────────────────────────
  const arrows = engineLines
    .filter(line => line.rawPv)
    .sort((a,b) => a.multipv - b.multipv) // Line 1 is best
    .map((line, idx) => {
        const m = line.rawPv.split(' ')[0];
        const startSquare = m.slice(0,2);
        const endSquare = m.slice(2,4);
        
        // Advantage difference: compare line's score to the best line's score.
        // Assuming lines are sorted by multipv (1 is best).
        const bestLine = engineLines.find(l => l.multipv === 1);
        let color = 'rgba(235, 97, 80, 0.8)'; // Muted Red (Bad/Losing)
        
        if (bestLine) {
            // Using winPercent difference for a normalized scale (0 to 100)
            const diff = bestLine.winPercent - line.winPercent;
            
            if (idx === 0 || diff < 2) {
                color = 'rgba(130, 151, 105, 0.9)'; // Muted Green (Best or equal)
            } else if (diff < 10) {
                color = 'rgba(104, 155, 204, 0.8)'; // Muted Blue (Good alternative)
            } else if (diff < 20) {
                color = 'rgba(230, 143, 80, 0.8)'; // Muted Orange (Inaccuracy)
            } else {
                color = 'rgba(235, 97, 80, 0.8)'; // Muted Red (Mistake/Blunder)
            }
        }
        
        return {
          startSquare,
          endSquare,
          color
        };
    });

  const boardOptions = {
    position,
    darkSquareStyle:  { backgroundColor: DARK_SQUARE_BG },
    lightSquareStyle: { backgroundColor: LIGHT_SQUARE_BG },
    squareStyles,
    arrows,
    onSquareClick,
    onPieceDrop,
    onPieceDrag,
    customBoardStyle: {
      borderRadius: '8px',
      overflow: 'hidden',
    },
  };

  // ── Import / Export Logic ───────────────────────────────────────────────
  const getPgnString = (nodeId, isMainLine = true) => {
     const node = treeNodesRef.current[nodeId];
     if (!node) return '';

     let str = '';
     if (node.id !== rootId) {
        const isWhite = node.depth % 2 !== 0;
        const turnNum = Math.ceil(node.depth / 2);
        const needsTurn = isWhite || (!isWhite && !isMainLine);
        
        if (needsTurn) {
           str += isWhite ? `${turnNum}. ` : `${turnNum}... `;
        }
        str += `${node.san} `;
     }

     if (node.childrenIds.length > 0) {
        str += getPgnString(node.childrenIds[0], true);
        for (let i = 1; i < node.childrenIds.length; i++) {
           str += `( ${getPgnString(node.childrenIds[i], false).trim()} ) `;
        }
     }
     
     return str;
  };

  const exportPgn = () => {
    const yyyyMmDd = new Date().toISOString().split('T')[0];
    const header = `[Event "Local Analysis"]\n[Site "Analysis Board"]\n[Date "${yyyyMmDd}"]\n[White "Player"]\n[Black "Player"]\n[Result "*"]\n\n`;
    const body = getPgnString(rootId, true).trim() || "*";
    const blob = new Blob([header + body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analysis.pgn";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (overridePgn = null) => {
     try {
       const textToLoad = (typeof overridePgn === 'string') ? overridePgn : importText;
       const tempChess = new Chess();
       tempChess.loadPgn(textToLoad);
       const moves = tempChess.history();
       
       chessGame.reset();
       let currentMap = {
         [rootId]: { id: rootId, fen: chessGame.fen(), san: 'Start', parentId: null, childrenIds: [], depth: 0 }
       };
       let currentParentId = rootId;
       
       for (const m of moves) {
         chessGame.move(m);
         const newId = Date.now().toString() + Math.random().toString(36).substring(2,6);
         const node = {
           id: newId,
           fen: chessGame.fen(),
           san: m,
           parentId: currentParentId,
           childrenIds: [],
           depth: currentMap[currentParentId].depth + 1
         };
         currentMap[newId] = node;
         currentMap[currentParentId].childrenIds.push(newId);
         currentParentId = newId;
       }
       
       setTreeNodes(currentMap);
       setActiveNodeId(currentParentId);
       setPosition(chessGame.fen());
       setIsImportOpen(false);
       setImportText("");
     } catch (err) {
       alert("Invalid PGN Format! Cannot import.");
     }
  };

  const handleNewGame = () => {
     chessGame.reset();
     setTreeNodes({
       [rootId]: { id: rootId, fen: chessGame.fen(), san: 'Start', parentId: null, childrenIds: [], depth: 0 }
     });
     setActiveNodeId(rootId);
     setPosition(chessGame.fen());
     setEngineLines([]);
  };

  const handleSaveGame = () => {
     if (!saveName.trim()) return;
     const pgn = getPgnString(rootId, true).trim() || "*";
     const newGame = {
        id: Date.now().toString(),
        name: saveName.trim(),
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        pgn: pgn
     };
     const updated = [newGame, ...savedGames];
     setSavedGames(updated);
     localStorage.setItem('chess_saved_games', JSON.stringify(updated));
     setIsSaveOpen(false);
     setSaveName("");
  };

// ── Recursive PGN Component ───────────────────────────────────────────────
  const PgnNode = ({ nodeId, showTurn = true }) => {
     const node = treeNodes[nodeId];
     if (!node) return null;

     const isWhite = node.depth % 2 !== 0;
     const turnNum = Math.ceil(node.depth / 2);
     const isActive = node.id === activeNodeId;
     
     const turnStr = isWhite ? `${turnNum}.` : `${turnNum}...`;
     const forceShowTurn = showTurn || isWhite;

     return (
       <>
         {node.id !== rootId && (
            <span className={`history-move-cell ${isActive ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveNodeId(node.id); }}>
               {forceShowTurn && <span className="turn-label">{turnStr}</span>}
               <span className="san-text">{node.san}</span>
            </span>
         )}
         
         {node.childrenIds.length > 0 && (
             <>
                <PgnNode nodeId={node.childrenIds[0]} showTurn={false} />
            
                {node.childrenIds.slice(1).map((childId) => (
                   <span key={childId} className="variation-block">
                     <span className="variation-paren">(</span>
                     <PgnNode nodeId={childId} showTurn={true} />
                     <span className="variation-paren">)</span>
                   </span>
                ))}
             </>
         )}
       </>
     );
  };

  const bestLine = engineLines.find(l => l.multipv === 1);
  let whiteWinPercent = 50;
  let evalText = '0.00';
  if (bestLine) {
     evalText = bestLine.score;
     if (evalText.includes('M')) {
         whiteWinPercent = evalText.startsWith('+') ? 100 : 0;
     } else {
         const cpAbs = parseFloat(evalText) * 100;
         whiteWinPercent = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cpAbs)) - 1);
     }
  }

  return (
    <div className="chess-layout">
      {/* Eval Bar */}
      <div 
        className="eval-bar-container"
        style={{
           width: '32px',
           height: '650px',
           backgroundColor: '#111',
           border: '2px solid #333',
           borderRadius: '6px',
           display: 'flex',
           flexDirection: 'column',
           position: 'relative',
           overflow: 'hidden',
           userSelect: 'none'
        }}
      >
        {/* Black progress (top) */}
        <div style={{
           position: 'absolute',
           top: 0,
           left: 0,
           right: 0,
           height: `${100 - whiteWinPercent}%`,
           backgroundColor: '#2b2b2b',
           transition: 'height 0.4s ease-out'
        }}></div>

        {/* White progress (bottom) */}
        <div style={{
           position: 'absolute',
           bottom: 0,
           left: 0,
           right: 0,
           height: `${whiteWinPercent}%`,
           backgroundColor: '#e6e6e6',
           transition: 'height 0.4s ease-out'
        }}></div>

        {/* Eval text badge */}
        <div style={{
           position: 'absolute',
           width: '100%',
           top: whiteWinPercent >= 50 ? 'initial' : '10px',
           bottom: whiteWinPercent >= 50 ? '10px' : 'initial',
           color: whiteWinPercent >= 50 ? '#111' : '#e6e6e6',
           textAlign: 'center',
           fontFamily: 'monospace',
           fontSize: '12px',
           fontWeight: 'bold',
           zIndex: 5,
           lineHeight: '1.2',
           padding: '4px 0'
        }}>
           {evalText}
        </div>
      </div>

      {/* LEFT: Chess Board */}
      <div className="board-section" style={{ position: 'relative' }}>
        <Chessboard options={boardOptions} />

        {/* Win Percentage Overlays */}
        {engineLines.filter(line => line.rawPv).sort((a,b)=>a.multipv-b.multipv).map((line, idx) => {
            const m = line.rawPv.split(' ')[0];
            const from = m.slice(0,2);
            const to = m.slice(2,4); 
            const fileIdx = to.charCodeAt(0) - 97; // 'a'
            const rankIdx = 8 - parseInt(to[1], 10);
            
            return (
               <div 
                 key={`overlay-${idx}`} 
                 style={{
                   position: 'absolute',
                   top: `${rankIdx * 12.5}%`,
                   left: `${fileIdx * 12.5}%`,
                   width: '12.5%',
                   height: '12.5%',
                   pointerEvents: 'auto',
                   cursor: 'pointer',
                   display: 'flex',
                   alignItems: 'flex-start',
                   justifyContent: 'flex-end',
                   padding: '2px 4px',
                   boxSizing: 'border-box',
                   zIndex: 10
                 }}
                 onClick={(e) => {
                   e.stopPropagation();
                   handleActualMove({ from, to, promotion: 'q' });
                 }}
                 title="Play this suggested move"
               >
                  <div style={{
                     background: 'rgba(0,0,0,0.85)',
                     color: '#fff',
                     fontSize: '11px',
                     fontFamily: 'monospace',
                     fontWeight: 'bold',
                     borderRadius: '4px',
                     padding: '2px 5px',
                     border: '1px solid rgba(255,255,255,0.1)',
                     transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#ccc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.85)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                  >
                     {line.winPercent.toFixed(1)}% W
                  </div>
               </div>
            )
        })}
      </div>

      {/* RIGHT: Engine Panel & History */}
      <div className="side-column">
        {/* ENGINE */}
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

        {/* MOVE HISTORY TREE */}
        <div className="history-section">
          <div className="history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span>Variation PGN</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="settings-toggle-btn" onClick={handleNewGame}>NEW</button>
              <button className="settings-toggle-btn" onClick={() => setIsSaveOpen(true)}>SAVE</button>
              <button className="settings-toggle-btn" onClick={() => setIsLibraryOpen(true)}>LOAD</button>
              <button className="settings-toggle-btn" onClick={() => setIsImportOpen(true)}>IMPORT</button>
              <button className="settings-toggle-btn" onClick={exportPgn}>EXPORT</button>
            </div>
          </div>
          <div className="history-grid">
             {/* Render from root's first child if it exists */}
             {treeNodes[rootId].childrenIds.length > 0 ? (
                <PgnNode nodeId={treeNodes[rootId].childrenIds[0]} showTurn={true} />
             ) : (
                <div style={{color: '#888', fontStyle: 'italic', fontSize: '13px'}}>No moves played yet.</div>
             )}
             
             {/* If user branches explicitly from root e.g., plays e4, goes back to start, plays d4 */}
             {treeNodes[rootId].childrenIds.slice(1).map(childId => (
                <span key={childId} className="variation-block">
                  <span className="variation-paren">(</span>
                  <PgnNode nodeId={childId} showTurn={true} />
                  <span className="variation-paren">)</span>
                </span>
             ))}
          </div>
        </div>
      </div>

      {/* IMPORT MODAL */}
      {isImportOpen && (
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
                 <button className="settings-toggle-btn" onClick={handleImport} style={{ borderColor: '#aaa' }}>LOAD GAME</button>
              </div>
           </div>
        </div>
      )}

      {/* SAVE MODAL */}
      {isSaveOpen && (
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
      )}

      {/* LIBRARY MODAL */}
      {isLibraryOpen && (
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
                          localStorage.setItem('chess_saved_games', JSON.stringify(updated));
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
      )}
    </div>
  );
}