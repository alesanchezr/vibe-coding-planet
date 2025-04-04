/**
 * GameTimer - Manages game timing including countdown and cooldown phases
 * @class
 */
export class GameTimer {
  /**
   * Create a new game timer
   * @param {Object} options - Timer configuration options
   * @param {number} [options.gameDuration=360] - Game duration in seconds (default 6 minutes)
   * @param {number} [options.cooldownDuration=120] - Cooldown duration in seconds (default 2 minutes)
   * @param {Function} [options.onGameEnd] - Callback when game timer ends
   * @param {Function} [options.onCooldownEnd] - Callback when cooldown timer ends
   */
  constructor(options = {}) {
    // Timer durations (in seconds)
    this.gameDuration = options.gameDuration || 360; // 6 minutes
    this.cooldownDuration = options.cooldownDuration || 120; // 2 minutes
    
    // Current time remaining (in seconds)
    this.timeRemaining = this.gameDuration;
    
    // Timer state
    this.isRunning = false;
    this.inCooldown = false;
    this.lastUpdate = null;
    
    // Game status
    this.status = 'WAITING'; // Default status
    this.statusColor = '#2196F3'; // Blue for waiting
    
    // Status friendly labels
    this.statusLabels = {
      'WAITING': 'Waiting for players to join',
      'ACTIVE': 'Game in progress!',
      'COOLDOWN': 'Game ended. Preparing next round',
      'VICTORY': 'A planet has completed their rocket and won!',
      'ENDED': 'Game session has been terminated'
    };
    
    // Callbacks
    this.onGameEnd = options.onGameEnd || (() => console.log('Game time expired'));
    this.onCooldownEnd = options.onCooldownEnd || (() => console.log('Cooldown ended'));
    
    // DOM elements
    this.timerElement = null;
    this.timerLabelElement = null;
    
    // Create the UI element for the timer
    this._createTimerUI();
  }
  
  /**
   * Create UI elements for the timer
   * @private
   */
  _createTimerUI() {
    // Create container
    const container = document.createElement('div');
    container.id = 'gameTimerContainer';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    container.style.padding = '10px 15px';
    container.style.borderRadius = '5px';
    container.style.color = 'white';
    container.style.textAlign = 'center';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.zIndex = '1000';
    container.style.display = 'inline-block'; // Make it only as wide as its content
    container.style.maxWidth = 'max-content'; // Ensure it's only as wide as needed
    
    // Create status label
    this.timerLabelElement = document.createElement('div');
    this.timerLabelElement.textContent = this.statusLabels[this.status] || this.status;
    this.timerLabelElement.style.marginBottom = '5px';
    this.timerLabelElement.style.fontSize = '14px';
    this.timerLabelElement.style.fontWeight = 'bold';
    this.timerLabelElement.style.color = this.statusColor;
    
    // Create timer display
    this.timerElement = document.createElement('div');
    this.timerElement.textContent = this._formatTime(this.timeRemaining);
    this.timerElement.style.fontSize = '24px';
    this.timerElement.style.fontWeight = 'bold';
    
    // Add elements to container
    container.appendChild(this.timerLabelElement);
    container.appendChild(this.timerElement);
    
    // Add container to document
    document.body.appendChild(container);
  }
  
  /**
   * Update the displayed status
   * @param {string} status - The status to display
   * @param {string} color - Color for the status text
   */
  updateStatus(status, color) {
    if (!this.timerLabelElement) return;
    
    this.status = status;
    this.statusColor = color;
    
    // Update the UI element with the friendly label
    this.timerLabelElement.textContent = this.statusLabels[status] || status;
    this.timerLabelElement.style.color = color;
    
    console.log(`Timer status updated to: ${status} (${this.statusLabels[status]})`);
  }
  
  /**
   * Format seconds into MM:SS display
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time string
   * @private
   */
  _formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Start the game timer
   */
  startGameTimer() {
    if (this.isRunning) return;
    
    console.log('Game timer started');
    this.isRunning = true;
    this.inCooldown = false;
    this.timeRemaining = this.gameDuration;
    this.lastUpdate = Date.now();
    
    // Update UI with ACTIVE status
    this.updateStatus('ACTIVE', '#4CAF50'); // Green for active
    this.timerElement.textContent = this._formatTime(this.timeRemaining);
    this.timerElement.style.color = 'white';
    
    // Start update loop
    this._updateTimer();
  }
  
  /**
   * Start the cooldown timer
   */
  startCooldownTimer() {
    if (this.isRunning && this.inCooldown) return;
    
    console.log('Cooldown timer started');
    this.isRunning = true;
    this.inCooldown = true;
    this.timeRemaining = this.cooldownDuration;
    this.lastUpdate = Date.now();
    
    // Update UI with COOLDOWN status
    this.updateStatus('COOLDOWN', '#FF9800'); // Orange for cooldown
    this.timerElement.textContent = this._formatTime(this.timeRemaining);
    this.timerElement.style.color = '#FF9800';
    
    // Start update loop
    this._updateTimer();
  }
  
  /**
   * Set waiting status (before game starts)
   */
  setWaitingStatus() {
    console.log('Timer set to waiting status');
    this.updateStatus('WAITING', '#2196F3'); // Blue for waiting
    this.stopTimer();
    this.timeRemaining = this.gameDuration;
    this.timerElement.textContent = this._formatTime(this.timeRemaining);
    this.timerElement.style.color = '#2196F3';
  }
  
  /**
   * Set victory status
   */
  setVictoryStatus() {
    console.log('Timer set to victory status');
    this.updateStatus('VICTORY', '#8BC34A'); // Light green for victory
    this.timerElement.style.color = '#8BC34A';
  }
  
  /**
   * Set ended status (game terminated)
   */
  setEndedStatus() {
    console.log('Timer set to ended status');
    this.updateStatus('ENDED', '#FF5722'); // Deep orange for ended
    this.stopTimer();
    this.timerElement.style.color = '#FF5722';
  }
  
  /**
   * Stop the timer
   */
  stopTimer() {
    console.log('Timer stopped');
    this.isRunning = false;
  }
  
  /**
   * Reset the timer to initial state
   */
  resetTimer() {
    this.stopTimer();
    this.timeRemaining = this.gameDuration;
    this.inCooldown = false;
    this.timerElement.textContent = this._formatTime(this.timeRemaining);
    
    // Update UI with WAITING status
    this.updateStatus('WAITING', '#2196F3'); // Blue for waiting
    this.timerElement.style.color = '#2196F3';
    
    console.log('Timer reset');
  }
  
  /**
   * Update the timer (internal recursive function)
   * @private
   */
  _updateTimer() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
    this.lastUpdate = now;
    
    // Update time remaining
    this.timeRemaining -= deltaTime;
    
    // Check for time expired
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.isRunning = false;
      
      // Update UI
      this.timerElement.textContent = this._formatTime(0);
      
      // Trigger appropriate callback
      if (this.inCooldown) {
        // Cooldown ended - start new game
        this.onCooldownEnd();
      } else {
        // Game ended - start cooldown
        this.onGameEnd();
      }
      
      return;
    }
    
    // Update UI with new time
    this.timerElement.textContent = this._formatTime(this.timeRemaining);
    
    // Visual cue for last minute
    if (!this.inCooldown && this.timeRemaining <= 60) {
      this.timerElement.style.color = '#F44336'; // Red for urgency
    }
    
    // Set up next frame update
    requestAnimationFrame(() => this._updateTimer());
  }
  
  /**
   * Get remaining time in seconds
   * @returns {number} Time remaining in seconds
   */
  getTimeRemaining() {
    return this.timeRemaining;
  }
  
  /**
   * Check if the timer is in cooldown phase
   * @returns {boolean} True if in cooldown
   */
  isInCooldown() {
    return this.inCooldown;
  }
  
  /**
   * Dispose of timer resources and remove DOM elements
   */
  dispose() {
    this.stopTimer();
    
    // Remove DOM elements
    const container = document.getElementById('gameTimerContainer');
    if (container) {
      document.body.removeChild(container);
    }
    
    this.timerElement = null;
    this.timerLabelElement = null;
  }
} 