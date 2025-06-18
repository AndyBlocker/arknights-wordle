# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Arknights-themed Wordle game with Chinese interface text. Players guess Arknights operators based on various attributes like rarity, stats, and origin information.

## Architecture

### Frontend (Vue.js 3)
- **Location**: `/frontend/`
- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vue CLI
- **Main Components**:
  - `App.vue`: Main application with game state management
  - `GameBoard.vue`: Standard guessing game interface  
  - `PuzzleBoard.vue`: Pixelated image guessing mode
  - `GuessInput.vue`: Operator search/input component
  - `TagSelector.vue`: Game difficulty selection
  - `ResultRow.vue`: Individual guess result display

### Backend (Node.js)
- **Location**: `/server/`
- **Framework**: Express.js with Socket.io
- **Purpose**: Multiplayer room management (not fully implemented in frontend)
- **Port**: 3012

### Game Logic
- **Location**: `/frontend/src/logic/`
- **Key Files**:
  - `gameLogic.js`: Core game mechanics, operator comparison
  - `puzzleService.js`: Pixelated image processing
  - `parseUtils.js`: Data parsing utilities

### Data Structure
- Operator data stored in `/frontend/public/data/operators.json`
- Chinese attribute names throughout (干员, 星级, 职业, etc.)
- Complex stat calculations with potential/trust modifiers

## Development Commands

### Frontend
```bash
cd frontend
npm run serve    # Development server
npm run build    # Production build
npm run lint     # ESLint checking
```

### Backend
```bash
cd server
npm start        # Start server on port 3012
```

## Key Technical Details

### Game Modes
1. **Standard Mode**: Compare attributes with color-coded results
2. **Puzzle Mode**: Progressively reveal pixelated operator artwork

### Theming
- Light/dark theme support via CSS variables
- Theme persistence with cookies
- Theme toggle in header

### Data Processing
- Operators preprocessed on load (rarity→stars, attack speed→interval)
- Potential/trust stat modifiers calculated dynamically
- Chinese text throughout with pinyin search support

### State Management
- Vue 3 Composition API reactive state
- Cookie-based settings persistence
- Game state (guesses, comparisons, target) managed in App.vue

## Important Implementation Notes

- All user-facing text is in Chinese
- Operator search supports full pinyin with spaces
- Complex attribute comparison logic with arrow indicators (↑/↓)
- Image processing for puzzle mode creates pixelated versions
- Multiplayer infrastructure exists but not connected to frontend UI