import React from 'react';

export default function EvalBar({ engineLines, boardFlipped }) {
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
      <div style={{
         position: 'absolute',
         top: 0,
         left: 0,
         right: 0,
         height: boardFlipped ? `${whiteWinPercent}%` : `${100 - whiteWinPercent}%`,
         backgroundColor: boardFlipped ? '#e6e6e6' : '#2b2b2b',
         transition: 'height 0.4s ease-out'
      }}></div>

      <div style={{
         position: 'absolute',
         bottom: 0,
         left: 0,
         right: 0,
         height: boardFlipped ? `${100 - whiteWinPercent}%` : `${whiteWinPercent}%`,
         backgroundColor: boardFlipped ? '#2b2b2b' : '#e6e6e6',
         transition: 'height 0.4s ease-out'
      }}></div>

      <div style={{
         position: 'absolute',
         width: '100%',
         top:    (!boardFlipped && whiteWinPercent <  50) || (boardFlipped && whiteWinPercent >= 50) ? '10px' : 'initial',
         bottom: (!boardFlipped && whiteWinPercent >= 50) || (boardFlipped && whiteWinPercent <  50) ? '10px' : 'initial',
         color:  whiteWinPercent >= 50 ? '#111' : '#e6e6e6',
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
  );
}
