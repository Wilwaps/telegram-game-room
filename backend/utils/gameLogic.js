/**
 * ============================================
 * LÓGICA DE JUEGO - TIC TAC TOE
 * ============================================
 * 
 * Contiene toda la lógica del juego Tic Tac Toe:
 * - Validación de movimientos
 * - Detección de victoria
 * - Detección de empate
 * - Algoritmo Minimax para IA
 * 
 * @module utils/gameLogic
 */

/**
 * Combinaciones ganadoras para Tic Tac Toe (3x3)
 */
const WINNING_COMBINATIONS = [
  // Filas
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // Columnas
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // Diagonales
  [0, 4, 8],
  [2, 4, 6]
];

class GameLogic {
  /**
   * Verificar si hay un ganador en el tablero
   * @param {Array} board - Tablero de juego (9 posiciones)
   * @returns {string|null} - Símbolo del ganador ('X' o 'O') o null
   */
  checkWinner(board) {
    for (const combination of WINNING_COMBINATIONS) {
      const [a, b, c] = combination;
      
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    
    return null;
  }

  /**
   * Verificar si el juego terminó en empate
   * @param {Array} board - Tablero de juego
   * @returns {boolean}
   */
  checkDraw(board) {
    // Empate si todas las celdas están llenas y no hay ganador
    return board.every(cell => cell !== null) && !this.checkWinner(board);
  }

  /**
   * Obtener la línea ganadora
   * @param {Array} board - Tablero de juego
   * @param {string} symbol - Símbolo del ganador ('X' o 'O')
   * @returns {Array|null} - Array con los índices de la línea ganadora o null
   */
  getWinningLine(board, symbol) {
    for (const combination of WINNING_COMBINATIONS) {
      const [a, b, c] = combination;
      
      if (board[a] === symbol && board[b] === symbol && board[c] === symbol) {
        return combination;
      }
    }
    
    return null;
  }

  /**
   * Validar si un movimiento es legal
   * @param {Array} board - Tablero de juego
   * @param {number} position - Posición del movimiento (0-8)
   * @returns {boolean}
   */
  isValidMove(board, position) {
    // Verificar que la posición esté en rango
    if (position < 0 || position >= board.length) {
      return false;
    }
    
    // Verificar que la celda esté vacía
    return board[position] === null;
  }

  /**
   * Obtener todas las posiciones vacías del tablero
   * @param {Array} board - Tablero de juego
   * @returns {Array} - Array de índices de posiciones vacías
   */
  getEmptyPositions(board) {
    return board
      .map((cell, index) => (cell === null ? index : null))
      .filter(index => index !== null);
  }

  /**
   * Verificar si el juego ha terminado
   * @param {Array} board - Tablero de juego
   * @returns {Object} - { finished: boolean, winner: string|null, isDraw: boolean }
   */
  checkGameStatus(board) {
    const winner = this.checkWinner(board);
    const isDraw = this.checkDraw(board);
    
    return {
      finished: winner !== null || isDraw,
      winner: winner,
      isDraw: isDraw,
      winningLine: winner ? this.getWinningLine(board, winner) : null
    };
  }

  /**
   * Evaluar el tablero para el algoritmo Minimax
   * @param {Array} board - Tablero de juego
   * @param {string} aiSymbol - Símbolo de la IA
   * @param {string} humanSymbol - Símbolo del humano
   * @returns {number} - Puntuación del tablero
   */
  evaluateBoard(board, aiSymbol, humanSymbol) {
    const winner = this.checkWinner(board);
    
    if (winner === aiSymbol) {
      return 10;
    } else if (winner === humanSymbol) {
      return -10;
    } else {
      return 0;
    }
  }

  /**
   * Algoritmo Minimax para IA
   * @param {Array} board - Tablero de juego
   * @param {number} depth - Profundidad actual
   * @param {boolean} isMaximizing - True si es turno de maximizar
   * @param {string} aiSymbol - Símbolo de la IA
   * @param {string} humanSymbol - Símbolo del humano
   * @returns {number} - Mejor puntuación posible
   */
  minimax(board, depth, isMaximizing, aiSymbol, humanSymbol) {
    // Verificar estado terminal
    const score = this.evaluateBoard(board, aiSymbol, humanSymbol);
    
    // Si hay un ganador, retornar puntuación ajustada por profundidad
    if (score === 10) {
      return score - depth;
    }
    if (score === -10) {
      return score + depth;
    }
    
    // Si es empate
    if (this.checkDraw(board)) {
      return 0;
    }
    
    const emptyPositions = this.getEmptyPositions(board);
    
    // Turno de maximizar (IA)
    if (isMaximizing) {
      let bestScore = -Infinity;
      
      for (const position of emptyPositions) {
        // Hacer movimiento
        board[position] = aiSymbol;
        
        // Llamada recursiva
        const currentScore = this.minimax(board, depth + 1, false, aiSymbol, humanSymbol);
        
        // Deshacer movimiento
        board[position] = null;
        
        bestScore = Math.max(bestScore, currentScore);
      }
      
      return bestScore;
    }
    // Turno de minimizar (Humano)
    else {
      let bestScore = Infinity;
      
      for (const position of emptyPositions) {
        // Hacer movimiento
        board[position] = humanSymbol;
        
        // Llamada recursiva
        const currentScore = this.minimax(board, depth + 1, true, aiSymbol, humanSymbol);
        
        // Deshacer movimiento
        board[position] = null;
        
        bestScore = Math.min(bestScore, currentScore);
      }
      
      return bestScore;
    }
  }

  /**
   * Obtener el mejor movimiento para la IA usando Minimax
   * @param {Array} board - Tablero de juego
   * @param {string} aiSymbol - Símbolo de la IA
   * @param {string} difficulty - Dificultad ('easy', 'medium', 'hard')
   * @returns {number} - Índice del mejor movimiento
   */
  getBestMove(board, aiSymbol, difficulty = 'hard') {
    const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';
    const emptyPositions = this.getEmptyPositions(board);
    
    // Si no hay movimientos disponibles
    if (emptyPositions.length === 0) {
      return -1;
    }
    
    // Dificultad fácil: movimiento aleatorio
    if (difficulty === 'easy') {
      return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    }
    
    // Dificultad media: 50% aleatorio, 50% óptimo
    if (difficulty === 'medium' && Math.random() < 0.5) {
      return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    }
    
    // Dificultad difícil: siempre óptimo (Minimax)
    let bestScore = -Infinity;
    let bestMove = emptyPositions[0];
    
    for (const position of emptyPositions) {
      // Hacer movimiento
      board[position] = aiSymbol;
      
      // Calcular puntuación
      const score = this.minimax(board, 0, false, aiSymbol, humanSymbol);
      
      // Deshacer movimiento
      board[position] = null;
      
      // Actualizar mejor movimiento
      if (score > bestScore) {
        bestScore = score;
        bestMove = position;
      }
    }
    
    return bestMove;
  }

  /**
   * Obtener coordenadas de la línea ganadora para dibujar
   * @param {Array} winningLine - Array con índices de la línea ganadora
   * @param {number} cellSize - Tamaño de cada celda en píxeles
   * @returns {Object} - { x1, y1, x2, y2 }
   */
  getWinningLineCoordinates(winningLine, cellSize = 100) {
    if (!winningLine || winningLine.length !== 3) {
      return null;
    }
    
    const [start, , end] = winningLine;
    
    // Calcular posición del centro de cada celda
    const getCenter = (index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      return {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2
      };
    };
    
    const startPos = getCenter(start);
    const endPos = getCenter(end);
    
    return {
      x1: startPos.x,
      y1: startPos.y,
      x2: endPos.x,
      y2: endPos.y
    };
  }

  /**
   * Clonar tablero
   * @param {Array} board - Tablero original
   * @returns {Array} - Copia del tablero
   */
  cloneBoard(board) {
    return [...board];
  }

  /**
   * Convertir índice a coordenadas (fila, columna)
   * @param {number} index - Índice (0-8)
   * @returns {Object} - { row, col }
   */
  indexToCoordinates(index) {
    return {
      row: Math.floor(index / 3),
      col: index % 3
    };
  }

  /**
   * Convertir coordenadas a índice
   * @param {number} row - Fila (0-2)
   * @param {number} col - Columna (0-2)
   * @returns {number} - Índice (0-8)
   */
  coordinatesToIndex(row, col) {
    return row * 3 + col;
  }

  /**
   * Obtener estadísticas del tablero
   * @param {Array} board - Tablero de juego
   * @returns {Object} - Estadísticas del tablero
   */
  getBoardStats(board) {
    const xCount = board.filter(cell => cell === 'X').length;
    const oCount = board.filter(cell => cell === 'O').length;
    const emptyCount = board.filter(cell => cell === null).length;
    
    return {
      xCount,
      oCount,
      emptyCount,
      totalMoves: xCount + oCount,
      percentageFilled: ((xCount + oCount) / board.length) * 100
    };
  }
}

module.exports = new GameLogic();
