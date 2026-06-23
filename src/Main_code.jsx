import { useState, useRef, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

import PgnNode from './components/UI/PgnNode';
import EvalBar from './components/UI/EvalBar';
import EnginePanel from './components/UI/EnginePanel';
import ImportModal from './components/Modals/ImportModal';
import SaveModal from './components/Modals/SaveModal';
import LibraryModal from './components/Modals/LibraryModal';

// ── Color scheme – DO NOT change these values ─────────────────────────────
const DARK_SQUARE_BG  = 'rgb(48, 50, 52)';
const LIGHT_SQUARE_BG = '#f0d9b5';

const SELECTED_BG  = 'rgba(255, 215, 0, 0.45)';
const MOVE_DOT     = 'radial-gradient(circle, rgba(0,0,0,0.25) 27%, transparent 27%)';
const CAPTURE_RING = 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.25) 58%)';

export default function Main_code() {
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
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [savedGames, setSavedGames] = useState([]);
  const [enginePath, setEnginePath] = useState('');
  const [engineName, setEngineName] = useState('No Engine Selected');
  const engineProcessRef = useRef(null);
  const [dbFilePath, setDbFilePath] = useState('');

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('chess_engine_path');
      if (storedTheme) setEnginePath(storedTheme);
      
      const storedDbPath = localStorage.getItem('chess_db_file_path');
      if (storedDbPath) {
        setDbFilePath(storedDbPath);
        const fs = window.require('fs');
        if (fs.existsSync(storedDbPath)) {
          const fileData = fs.readFileSync(storedDbPath, 'utf8');
          setSavedGames(JSON.parse(fileData));
        } else {
           localStorage.removeItem('chess_db_file_path');
           setDbFilePath('');
           const storedItems = localStorage.getItem('chess_saved_games');
           if (storedItems) setSavedGames(JSON.parse(storedItems));
        }
      } else {
        const storedItems = localStorage.getItem('chess_saved_games');
        if (storedItems) setSavedGames(JSON.parse(storedItems));
      }
    } catch { /* Ignore error */ }
  }, []);

  // Initialize Native Engine CPU stream
  useEffect(() => {
    if (workerRef.current) workerRef.current.terminate();
    if (engineProcessRef.current) {
        try { engineProcessRef.current.kill(); } catch { /* Ignore error */ }
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
          } catch {
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
        try { if (engine.stdin.writable) engine.stdin.write(msg + '\n'); } catch { /* Ignore error */ }
      },
      terminate: () => {
        try { engine.kill(); } catch { /* Ignore error */ }
      }
   };

   workerRef.current = mockWorker;
   mockWorker.postMessage('uci');

   } catch {
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
  // Handle an actual move being played on the board and updating the timeline

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
    boardOrientation: boardFlipped ? 'black' : 'white',
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
     } catch {
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
     
     if (dbFilePath) {
       try {
         const fs = window.require('fs');
         fs.writeFileSync(dbFilePath, JSON.stringify(updated, null, 2));
       } catch (e) {
         console.error("Failed to write to DB file", e);
       }
     } else {
       localStorage.setItem('chess_saved_games', JSON.stringify(updated));
     }
     
     setIsSaveOpen(false);
     setSaveName("");
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
      <EvalBar engineLines={engineLines} boardFlipped={boardFlipped} />

      {/* LEFT: Chess Board */}
      <div className="board-section" style={{ position: 'relative' }}>
        <Chessboard options={boardOptions} />

        {/* Win Percentage Overlays */}
        {engineLines.filter(line => line.rawPv).sort((a,b)=>a.multipv-b.multipv).map((line, idx) => {
            const m = line.rawPv.split(' ')[0];
            const from = m.slice(0,2);
            const to = m.slice(2,4);
            const fileIdx = to.charCodeAt(0) - 97; // 'a' = 0
            const rankNum  = parseInt(to[1], 10);   // 1-8

            // Mirror coordinates when board is flipped
            const col = boardFlipped ? (7 - fileIdx) : fileIdx;
            const row = boardFlipped ? (rankNum - 1)  : (8 - rankNum);
            
            return (
               <div 
                 key={`overlay-${idx}`} 
                 style={{
                   position: 'absolute',
                   top: `${row * 12.5}%`,
                   left: `${col * 12.5}%`,
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
        <EnginePanel 
          engineName={engineName}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          enginePath={enginePath}
          setEnginePath={setEnginePath}
          searchDepth={searchDepth}
          setSearchDepth={setSearchDepth}
          multiPv={multiPv}
          setMultiPv={setMultiPv}
          threads={threads}
          setThreads={setThreads}
          hashMb={hashMb}
          setHashMb={setHashMb}
          engineLines={engineLines}
          isEngineThinking={isEngineThinking}
        />

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
              <button
                className="settings-toggle-btn"
                onClick={() => setBoardFlipped(f => !f)}
                title="Flip board orientation"
                style={{ borderColor: boardFlipped ? '#aaa' : undefined, color: boardFlipped ? '#fff' : undefined }}
              >
                {boardFlipped ? '⇅ BLACK' : '⇅ WHITE'}
              </button>
            </div>
          </div>
          <div className="history-grid">
             {/* Render from root's first child if it exists */}
             {treeNodes[rootId].childrenIds.length > 0 ? (
                <PgnNode nodeId={treeNodes[rootId].childrenIds[0]} showTurn={true} treeNodes={treeNodes} activeNodeId={activeNodeId} setActiveNodeId={setActiveNodeId} rootId={rootId} />
             ) : (
                <div style={{color: '#888', fontStyle: 'italic', fontSize: '13px'}}>No moves played yet.</div>
             )}
             
             {/* If user branches explicitly from root e.g., plays e4, goes back to start, plays d4 */}
             {treeNodes[rootId].childrenIds.slice(1).map(childId => (
                <span key={childId} className="variation-block">
                  <span className="variation-paren">(</span>
                  <PgnNode nodeId={childId} showTurn={true} treeNodes={treeNodes} activeNodeId={activeNodeId} setActiveNodeId={setActiveNodeId} rootId={rootId} />
                  <span className="variation-paren">)</span>
                </span>
             ))}
          </div>
        </div>
      </div>

      <ImportModal isImportOpen={isImportOpen} setIsImportOpen={setIsImportOpen} importText={importText} setImportText={setImportText} handleImport={handleImport} />
      <SaveModal isSaveOpen={isSaveOpen} setIsSaveOpen={setIsSaveOpen} saveName={saveName} setSaveName={setSaveName} handleSaveGame={handleSaveGame} />
      <LibraryModal isLibraryOpen={isLibraryOpen} setIsLibraryOpen={setIsLibraryOpen} savedGames={savedGames} setSavedGames={setSavedGames} handleImport={handleImport} dbFilePath={dbFilePath} setDbFilePath={setDbFilePath} />
    </div>
  );
}