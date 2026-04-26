# Aris  
  
![Aris Interface](project%20images/Aris.png)

Aris is a minimalist, terminal-styled chess analysis and playing application built with React, Vite, and Electron. It features a highly focused UI that displays the chessboard and real-time engine evaluations from any modern chess engine without unnecessary visual clutter.  
  
## Features  
- **Minimalist Terminal Interface:** A stripped-down, distraction-free chess layout.  
- **Live Engine Analysis:** Capable of running any modern chess engine to calculate top variations and evaluation scores locally. *(Requires a manual engine download - select in settings)* 
- **Advantage Arrows:** Visual indicators on the board that dynamically change color based on the engine's evaluation differential (Green <2%%, Blue <10%%, Orange <20%%, Red >20%%).  
- **Win Probability Bar:** A stylistic evaluation bar mapped to a logistic win curve that intuitively shows the balance of the game.  
- **Desktop Native:** Packaged as an offline Windows executable via Electron Forge.  
  
## Core Technologies  
- **Frontend:** React, Vite, CSS  
- **Chess Logic:** chess.js, react-chessboard  
- **Engine Support:** Any UCI-compatible modern chess engine  
- **Desktop Environment:** Electron, Electron Forge  

## Engine Setup  
To analyze games in Aris, you must link it to a chess engine on your system:
1. **Download an Engine:** Manually download any modern UCI-compatible chess engine executable (for example, [Stockfish](https://stockfishchess.org/download/)).  
2. **Select in Settings:** Open the Aris application, click the **Settings** button, and select the downloaded engine executable file (e.g., `stockfish.exe`). Live analysis will begin immediately.
  
## Development Setup  
  
### 1. Install Dependencies  
```bash  
npm install  
```  
  
### 2. Run the Development Server  
Launch the Vite development server paired with the Electron app window:  
```bash  
npm run electron:dev  
```  
  
## Building the Executable  
  
To package Aris into a standalone Windows installer and portable ZIP file, run:  
```bash  
npm run electron:make  
```  
The generated files will be placed inside the `out/make` directory. 
