/**
 * ============================================
 * SERVICIO DE BINGO
 * ============================================
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const logger = require('../config/logger');

class BingoService {
  /**
   * Generar orden de números aleatorio (1-75) con Fisher-Yates
   */
  generateDrawOrder(seed = null) {
    const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
    
    // Si no hay seed, generar uno
    if (!seed) {
      seed = crypto.randomBytes(16).toString('hex');
    }
    
    // Usar seed para RNG determinista
    let seedNum = parseInt(seed.substring(0, 8), 16);
    const seededRandom = () => {
      seedNum = (seedNum * 9301 + 49297) % 233280;
      return seedNum / 233280;
    };
    
    // Fisher-Yates shuffle
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    return { drawOrder: numbers, seed };
  }

  /**
   * Generar cartón de Bingo (5x5 con centro libre)
   * B: 1-15, I: 16-30, N: 31-45 (centro libre), G: 46-60, O: 61-75
   */
  generateCard(userId) {
    const card = {
      id: uuidv4(),
      userId,
      numbers: [],
      marked: new Set(),
      patterns: {
        line: false,
        double: false,
        full: false
      }
    };

    // Rangos por columna
    const ranges = [
      [1, 15],   // B
      [16, 30],  // I
      [31, 45],  // N
      [46, 60],  // G
      [61, 75]   // O
    ];

    // Generar números por columna
    for (let col = 0; col < 5; col++) {
      const [min, max] = ranges[col];
      const available = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      
      // Shuffle y tomar 5
      for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
      }
      
      card.numbers.push(available.slice(0, 5));
    }

    // Centro libre (columna N, fila 2)
    card.marked.add(card.numbers[2][2]);

    return card;
  }

  /**
   * Validar si un cartón tiene Bingo según el modo
   */
  validateBingo(card, drawnSet, mode = 'line') {
    const numbers = card.numbers;
    // Unir números cantados (drawnSet) con los marcados del cartón
    const marked = new Set(card.marked || []);
    if (drawnSet && typeof drawnSet.forEach === 'function') {
      drawnSet.forEach(n => marked.add(n));
    }

    // Verificar que todos los números marcados estén en drawnSet
    for (const num of marked) {
      if (!drawnSet.has(num) && num !== numbers[2][2]) { // excepto centro libre
        return { valid: false, reason: 'Número no cantado' };
      }
    }

    switch (mode) {
      case 'line':
        return this.validateLine(numbers, marked);
      case 'double':
        return this.validateDoubleLine(numbers, marked);
      case 'full':
        return this.validateFullCard(numbers, marked);
      default:
        return { valid: false, reason: 'Modo inválido' };
    }
  }

  /**
   * Validar línea (horizontal, vertical o diagonal)
   */
  validateLine(numbers, marked) {
    // Horizontales
    for (let row = 0; row < 5; row++) {
      let complete = true;
      for (let col = 0; col < 5; col++) {
        if (!marked.has(numbers[col][row])) {
          complete = false;
          break;
        }
      }
      if (complete) {
        return { valid: true, pattern: 'horizontal', row };
      }
    }

    // Verticales
    for (let col = 0; col < 5; col++) {
      let complete = true;
      for (let row = 0; row < 5; row++) {
        if (!marked.has(numbers[col][row])) {
          complete = false;
          break;
        }
      }
      if (complete) {
        return { valid: true, pattern: 'vertical', col };
      }
    }

    // Diagonal principal (\)
    let diag1 = true;
    for (let i = 0; i < 5; i++) {
      if (!marked.has(numbers[i][i])) {
        diag1 = false;
        break;
      }
    }
    if (diag1) {
      return { valid: true, pattern: 'diagonal', type: 'main' };
    }

    // Diagonal secundaria (/)
    let diag2 = true;
    for (let i = 0; i < 5; i++) {
      if (!marked.has(numbers[i][4 - i])) {
        diag2 = false;
        break;
      }
    }
    if (diag2) {
      return { valid: true, pattern: 'diagonal', type: 'secondary' };
    }

    return { valid: false, reason: 'No hay línea completa' };
  }

  /**
   * Validar doble línea
   */
  validateDoubleLine(numbers, marked) {
    let linesCount = 0;

    // Contar horizontales
    for (let row = 0; row < 5; row++) {
      let complete = true;
      for (let col = 0; col < 5; col++) {
        if (!marked.has(numbers[col][row])) {
          complete = false;
          break;
        }
      }
      if (complete) linesCount++;
    }

    // Contar verticales
    for (let col = 0; col < 5; col++) {
      let complete = true;
      for (let row = 0; row < 5; row++) {
        if (!marked.has(numbers[col][row])) {
          complete = false;
          break;
        }
      }
      if (complete) linesCount++;
    }

    if (linesCount >= 2) {
      return { valid: true, pattern: 'double', linesCount };
    }

    return { valid: false, reason: 'No hay dos líneas completas' };
  }

  /**
   * Validar cartón completo
   */
  validateFullCard(numbers, marked) {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) {
        if (!marked.has(numbers[col][row])) {
          return { valid: false, reason: 'Cartón incompleto' };
        }
      }
    }

    return { valid: true, pattern: 'full' };
  }

  /**
   * Calcular distribución del pot (70% ganador, 20% host, 10% sponsor)
   */
  calculateDistribution(pot) {
    const winner = Math.floor(pot * 0.7);
    const host = Math.floor(pot * 0.2);
    const sponsor = pot - winner - host; // resto al sponsor para suma exacta

    return { winner, host, sponsor };
  }

  /**
   * Generar hash del seed para auditoría
   */
  hashSeed(seed) {
    return crypto.createHash('sha256').update(seed).digest('hex');
  }
}

module.exports = new BingoService();
