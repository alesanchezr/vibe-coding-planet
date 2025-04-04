/**
 * InputManager - Unifies mouse and touch input handling
 * 
 * This class provides a standardized way to handle both mouse and touch events
 * with the same code, making it easier to support both desktop and mobile devices.
 */
export class InputManager {
  /**
   * Creates a new InputManager
   * @param {HTMLElement} element - The DOM element to attach listeners to
   * @param {Object} options - Configuration options
   * @param {number} [options.dragThreshold=5] - Pixels of movement to consider a drag
   * @param {number} [options.clickTimeThreshold=300] - Max duration in ms for a click/tap
   */
  constructor(element, options = {}) {
    this.element = element;
    this.dragThreshold = options.dragThreshold || 5;
    this.clickTimeThreshold = options.clickTimeThreshold || 300;
    
    // Track interaction state
    this.isPointerDown = false;
    this.isDragging = false;
    this.pointerDownTime = 0;
    this.pointerDownPosition = { x: 0, y: 0 };
    this.currentPosition = { x: 0, y: 0 };
    
    // Normalized pointer for use in raycasters, etc.
    this.normalizedPointer = { x: 0, y: 0 };
    
    // Event callbacks
    this.onPointerDown = null;
    this.onPointerMove = null;
    this.onPointerUp = null;
    this.onClick = null;
    this.onDragStart = null;
    this.onDrag = null;
    this.onDragEnd = null;
    
    // Bind methods to maintain context
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchMove = this._handleTouchMove.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
    
    // Add event listeners
    this._addEventListeners();
  }
  
  /**
   * Add all necessary event listeners to the element
   * @private
   */
  _addEventListeners() {
    // Mouse events
    this.element.addEventListener('mousedown', this._handlePointerDown);
    window.addEventListener('mousemove', this._handlePointerMove);
    window.addEventListener('mouseup', this._handlePointerUp);
    
    // Touch events
    this.element.addEventListener('touchstart', this._handleTouchStart, { passive: false });
    window.addEventListener('touchmove', this._handleTouchMove, { passive: false });
    window.addEventListener('touchend', this._handleTouchEnd);
    window.addEventListener('touchcancel', this._handleTouchEnd);
  }
  
  /**
   * Remove all event listeners
   */
  dispose() {
    // Mouse events
    this.element.removeEventListener('mousedown', this._handlePointerDown);
    window.removeEventListener('mousemove', this._handlePointerMove);
    window.removeEventListener('mouseup', this._handlePointerUp);
    
    // Touch events
    this.element.removeEventListener('touchstart', this._handleTouchStart);
    window.removeEventListener('touchmove', this._handleTouchMove);
    window.removeEventListener('touchend', this._handleTouchEnd);
    window.removeEventListener('touchcancel', this._handleTouchEnd);
  }
  
  /**
   * Get element dimensions
   * @private
   */
  _getElementDimensions() {
    return this.element.getBoundingClientRect();
  }
  
  /**
   * Convert client coordinates to element coordinates
   * @param {number} clientX - Client X coordinate
   * @param {number} clientY - Client Y coordinate
   * @returns {Object} Element relative coordinates
   * @private
   */
  _clientToElement(clientX, clientY) {
    const rect = this._getElementDimensions();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
  
  /**
   * Convert element coordinates to normalized coordinates (-1 to 1)
   * @param {number} elementX - Element X coordinate
   * @param {number} elementY - Element Y coordinate
   * @returns {Object} Normalized coordinates
   * @private
   */
  _elementToNormalized(elementX, elementY) {
    const rect = this._getElementDimensions();
    return {
      x: (elementX / rect.width) * 2 - 1,
      y: -(elementY / rect.height) * 2 + 1 // Flip Y for THREE.js coordinate system
    };
  }
  
  /**
   * Check if a movement exceeds the drag threshold
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position
   * @param {number} currentX - Current X position
   * @param {number} currentY - Current Y position
   * @returns {boolean} Whether the movement exceeds the threshold
   * @private
   */
  _exceedsDragThreshold(startX, startY, currentX, currentY) {
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    return distance > this.dragThreshold;
  }
  
  /**
   * Handle mouse down events
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _handlePointerDown(event) {
    // Prevent default behavior
    event.preventDefault();
    
    // Only handle left mouse button
    if (event.button !== 0) return;
    
    const elementPos = this._clientToElement(event.clientX, event.clientY);
    this.normalizedPointer = this._elementToNormalized(elementPos.x, elementPos.y);
    
    // Record start position and time
    this.pointerDownPosition = elementPos;
    this.currentPosition = elementPos;
    this.pointerDownTime = performance.now();
    this.isPointerDown = true;
    this.isDragging = false;
    
    // Call onPointerDown callback if defined
    if (typeof this.onPointerDown === 'function') {
      this.onPointerDown({
        type: 'pointerdown',
        elementX: elementPos.x,
        elementY: elementPos.y,
        normalizedX: this.normalizedPointer.x,
        normalizedY: this.normalizedPointer.y,
        originalEvent: event
      });
    }
  }
  
  /**
   * Handle mouse move events
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _handlePointerMove(event) {
    const elementPos = this._clientToElement(event.clientX, event.clientY);
    this.normalizedPointer = this._elementToNormalized(elementPos.x, elementPos.y);
    this.currentPosition = elementPos;
    
    // Call onPointerMove callback regardless of pointer down state
    if (typeof this.onPointerMove === 'function') {
      this.onPointerMove({
        type: 'pointermove',
        elementX: elementPos.x,
        elementY: elementPos.y,
        normalizedX: this.normalizedPointer.x,
        normalizedY: this.normalizedPointer.y,
        originalEvent: event
      });
    }
    
    // Only handle drag if pointer is down
    if (!this.isPointerDown) return;
    
    // Check if we've started dragging
    if (!this.isDragging && this._exceedsDragThreshold(
      this.pointerDownPosition.x, 
      this.pointerDownPosition.y, 
      elementPos.x, 
      elementPos.y
    )) {
      this.isDragging = true;
      
      // Call onDragStart callback if defined
      if (typeof this.onDragStart === 'function') {
        this.onDragStart({
          type: 'dragstart',
          elementX: elementPos.x,
          elementY: elementPos.y,
          startX: this.pointerDownPosition.x,
          startY: this.pointerDownPosition.y,
          normalizedX: this.normalizedPointer.x,
          normalizedY: this.normalizedPointer.y,
          originalEvent: event
        });
      }
    }
    
    // If dragging, call onDrag callback
    if (this.isDragging && typeof this.onDrag === 'function') {
      this.onDrag({
        type: 'drag',
        elementX: elementPos.x,
        elementY: elementPos.y,
        startX: this.pointerDownPosition.x,
        startY: this.pointerDownPosition.y,
        deltaX: elementPos.x - this.pointerDownPosition.x,
        deltaY: elementPos.y - this.pointerDownPosition.y,
        normalizedX: this.normalizedPointer.x,
        normalizedY: this.normalizedPointer.y,
        originalEvent: event
      });
    }
  }
  
  /**
   * Handle mouse up events
   * @param {MouseEvent} event - The mouse event
   * @private
   */
  _handlePointerUp(event) {
    if (!this.isPointerDown) return;
    
    const elementPos = this._clientToElement(event.clientX, event.clientY);
    this.normalizedPointer = this._elementToNormalized(elementPos.x, elementPos.y);
    
    // Calculate how long the pointer was down
    const pointerUpTime = performance.now();
    const pointerDownDuration = pointerUpTime - this.pointerDownTime;
    
    // Call onPointerUp callback if defined
    if (typeof this.onPointerUp === 'function') {
      this.onPointerUp({
        type: 'pointerup',
        elementX: elementPos.x,
        elementY: elementPos.y,
        normalizedX: this.normalizedPointer.x,
        normalizedY: this.normalizedPointer.y,
        originalEvent: event
      });
    }
    
    // If we were dragging, call onDragEnd
    if (this.isDragging && typeof this.onDragEnd === 'function') {
      this.onDragEnd({
        type: 'dragend',
        elementX: elementPos.x,
        elementY: elementPos.y,
        startX: this.pointerDownPosition.x,
        startY: this.pointerDownPosition.y,
        deltaX: elementPos.x - this.pointerDownPosition.x,
        deltaY: elementPos.y - this.pointerDownPosition.y,
        normalizedX: this.normalizedPointer.x,
        normalizedY: this.normalizedPointer.y,
        originalEvent: event
      });
    }
    // If we weren't dragging and the duration was short enough, it's a click
    else if (!this.isDragging && pointerDownDuration <= this.clickTimeThreshold) {
      if (typeof this.onClick === 'function') {
        this.onClick({
          type: 'click',
          elementX: elementPos.x,
          elementY: elementPos.y,
          normalizedX: this.normalizedPointer.x,
          normalizedY: this.normalizedPointer.y,
          originalEvent: event
        });
      }
    }
    
    // Reset state
    this.isPointerDown = false;
    this.isDragging = false;
  }
  
  /**
   * Handle touch start events (converts to pointer events)
   * @param {TouchEvent} event - The touch event
   * @private
   */
  _handleTouchStart(event) {
    // Prevent default to avoid scrolling in most cases
    event.preventDefault();
    
    // Only handle first touch point for now
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      
      // Create a synthetic mouse event and pass it to the pointer handler
      const syntheticEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        preventDefault: () => {}
      };
      
      this._handlePointerDown(syntheticEvent);
    }
  }
  
  /**
   * Handle touch move events (converts to pointer events)
   * @param {TouchEvent} event - The touch event
   * @private
   */
  _handleTouchMove(event) {
    // Prevent default to avoid scrolling in most cases
    event.preventDefault();
    
    // Only handle first touch point for now
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      
      // Create a synthetic mouse event and pass it to the pointer handler
      const syntheticEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        preventDefault: () => {}
      };
      
      this._handlePointerMove(syntheticEvent);
    }
  }
  
  /**
   * Handle touch end events (converts to pointer events)
   * @param {TouchEvent} event - The touch event
   * @private
   */
  _handleTouchEnd(event) {
    // Use the last known position since touches array is empty on touchend
    const syntheticEvent = {
      clientX: this.currentPosition.x,
      clientY: this.currentPosition.y,
      button: 0,
      preventDefault: () => {}
    };
    
    this._handlePointerUp(syntheticEvent);
  }
  
  /**
   * Set a callback for pointer down events
   * @param {Function} callback - The callback function
   */
  setPointerDownCallback(callback) {
    this.onPointerDown = callback;
  }
  
  /**
   * Set a callback for pointer move events
   * @param {Function} callback - The callback function
   */
  setPointerMoveCallback(callback) {
    this.onPointerMove = callback;
  }
  
  /**
   * Set a callback for pointer up events
   * @param {Function} callback - The callback function
   */
  setPointerUpCallback(callback) {
    this.onPointerUp = callback;
  }
  
  /**
   * Set a callback for click events
   * @param {Function} callback - The callback function
   */
  setClickCallback(callback) {
    this.onClick = callback;
  }
  
  /**
   * Set a callback for drag start events
   * @param {Function} callback - The callback function
   */
  setDragStartCallback(callback) {
    this.onDragStart = callback;
  }
  
  /**
   * Set a callback for drag events
   * @param {Function} callback - The callback function
   */
  setDragCallback(callback) {
    this.onDrag = callback;
  }
  
  /**
   * Set a callback for drag end events
   * @param {Function} callback - The callback function
   */
  setDragEndCallback(callback) {
    this.onDragEnd = callback;
  }
} 