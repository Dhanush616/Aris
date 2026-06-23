import React from 'react';

const PgnNode = React.memo(({ nodeId, showTurn = true, treeNodes, activeNodeId, setActiveNodeId, rootId }) => {
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
             <PgnNode 
               nodeId={node.childrenIds[0]} 
               showTurn={false} 
               treeNodes={treeNodes}
               activeNodeId={activeNodeId}
               setActiveNodeId={setActiveNodeId}
               rootId={rootId}
             />
         
             {node.childrenIds.slice(1).map((childId) => (
                <span key={childId} className="variation-block">
                  <span className="variation-paren">(</span>
                  <PgnNode 
                    nodeId={childId} 
                    showTurn={true} 
                    treeNodes={treeNodes}
                    activeNodeId={activeNodeId}
                    setActiveNodeId={setActiveNodeId}
                    rootId={rootId}
                  />
                  <span className="variation-paren">)</span>
                </span>
             ))}
          </>
      )}
    </>
  );
});

export default PgnNode;
