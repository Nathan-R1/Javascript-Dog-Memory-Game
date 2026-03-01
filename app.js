/**
 * Dog Smack - A Memory Game
 * 
 * A game where players must find all the dogs among face-down boxes.
 * After a brief reveal, players must select all boxes containing dogs.
 * Selecting an empty box results in immediate loss.
 */

(function() {
    'use strict';

    // ========================================
    // Game Configuration
    // ========================================
    
    const CONFIG = {
        INITIAL_COLS: 4,
        INITIAL_ROWS: 1,
        REVEAL_DURATION: 1000,
        DOG_EMOJI: '🐕',
        EMPTY_EMOJI: '',
        MIN_DOGS: 1,
        MAX_DOG_RATIO: 0.4,
        POINTS_PER_DOG: 10,
        ROUND_BONUS: 5,
        MAX_HEALTH: 3,
        TIER_COLORS: {
            1: '#3b82f6',
            2: '#a855f7',
            3: '#22c55e',
            4: '#eab308',
            5: '#f97316',
            6: '#ffd700'
        }
    };

    // ========================================
    // Game State
    // ========================================
    
    const state = {
        round: 1,
        score: 0,
        streak: 0,
        health: CONFIG.MAX_HEALTH,
        boxes: [],
        colCount: CONFIG.INITIAL_COLS,
        rowCount: CONFIG.INITIAL_ROWS,
        dogCount: 0,
        dogsFound: 0,
        gamePhase: 'ready',
        revealedTimeout: null,
        tier: 1
    };

    // ========================================
    // DOM Elements
    // ========================================
    
    const elements = {
        roundNumber: document.getElementById('round-number'),
        dogsFound: document.getElementById('dogs-found'),
        score: document.getElementById('score'),
        heartsContainer: document.getElementById('hearts-container'),
        gameMessage: document.getElementById('game-message'),
        gameBoard: document.getElementById('game-board'),
        playBtn: document.getElementById('play-btn'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalTitle: document.getElementById('modal-title'),
        modalMessage: document.getElementById('modal-message'),
        finalScore: document.getElementById('final-score'),
        finalRound: document.getElementById('final-round'),
        modalPlayAgain: document.getElementById('modal-play-again'),
        debugRevealBtn: document.getElementById('debug-reveal-btn')
    };

    // ========================================
    // Utility Functions
    // ========================================
    
    /**
     * Generate a random integer between min and max (inclusive)
     */
    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Shuffle an array using Fisher-Yates algorithm
     */
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = randomInt(0, i);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Set a message to display to the player
     */
    function setMessage(text, type = 'info') {
        elements.gameMessage.textContent = text;
        elements.gameMessage.className = `game-message ${type}`;
    }

    /**
     * Update all UI stats
     */
    function updateStats() {
        elements.roundNumber.textContent = state.round;
        elements.dogsFound.textContent = `${state.dogsFound} / ${state.dogCount}`;
        elements.score.textContent = state.score;
        renderHearts();
    }

    /**
     * Render hearts display
     */
    function renderHearts() {
        elements.heartsContainer.innerHTML = '';
        for (let i = 0; i < CONFIG.MAX_HEALTH; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart';
            heart.textContent = i < state.health ? '❤️' : '🖤';
            elements.heartsContainer.appendChild(heart);
        }
    }

    // ========================================
    // Game Logic
    // ========================================
    
    function getBoxCount() {
        return state.colCount * state.rowCount;
    }
    
    function getTargetSquare() {
        return state.colCount * state.colCount;
    }

    function getTier() {
        return Math.min(6, state.colCount - 3);
    }

    function updateTierColor() {
        state.tier = getTier();
        const tierColor = CONFIG.TIER_COLORS[state.tier];
        elements.gameBoard.style.setProperty('--tier-color', tierColor);
    }
    
    /**
     * Calculate number of dogs based on box count
     */
    function calculateDogCount(boxCount) {
        const minDogs = Math.max(1, Math.ceil(boxCount * 0.2));
        const maxDogs = Math.floor(boxCount * CONFIG.MAX_DOG_RATIO);
        return randomInt(minDogs, maxDogs);
    }

    /**
     * Generate boxes with random dog placement
     */
    function generateBoxes() {
        const boxCount = getBoxCount();
        state.dogCount = calculateDogCount(boxCount);
        state.dogsFound = 0;
        
        // Create array with dogs and empty spaces
        const boxContents = [
            ...Array(state.dogCount).fill('dog'),
            ...Array(boxCount - state.dogCount).fill('empty')
        ];
        
        // Shuffle the array
        const shuffled = shuffleArray(boxContents);
        
        // Create box objects
        state.boxes = shuffled.map((content, index) => ({
            id: index,
            hasDog: content === 'dog',
            revealed: false,
            selected: false,
            correct: false
        }));
        
        updateStats();
    }

    /**
     * Render the game board
     */
    function renderBoard() {
        elements.gameBoard.innerHTML = '';
        
        elements.gameBoard.style.setProperty('--box-columns', state.colCount);
        
        state.boxes.forEach((box, index) => {
            const boxElement = document.createElement('div');
            boxElement.className = 'box';
            boxElement.dataset.index = index;
            boxElement.setAttribute('role', 'button');
            boxElement.setAttribute('tabindex', '0');
            boxElement.setAttribute('aria-label', `Box ${index + 1}`);
            
            // Front face (shows when hidden)
            const frontFace = document.createElement('div');
            frontFace.className = 'box-face box-front';
            frontFace.textContent = '?';
            
            // Back face (shows content when revealed)
            const backFace = document.createElement('div');
            backFace.className = 'box-face box-back';
            backFace.textContent = box.hasDog ? CONFIG.DOG_EMOJI : CONFIG.EMPTY_EMOJI;
            
            boxElement.appendChild(frontFace);
            boxElement.appendChild(backFace);
            
            // Add click handler
            boxElement.addEventListener('click', () => handleBoxClick(index));
            boxElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBoxClick(index);
                }
            });
            
            elements.gameBoard.appendChild(boxElement);
        });
    }

    /**
     * Reveal all boxes temporarily
     */
    function revealBoxes() {
        state.gamePhase = 'revealed';
        elements.playBtn.disabled = true;
        elements.gameBoard.classList.add('locked');
        
        // Flip all boxes to show content
        const boxElements = elements.gameBoard.querySelectorAll('.box');
        boxElements.forEach((el, index) => {
            if (!state.boxes[index].revealed) {
                el.classList.add('flipped');
            }
        });
        
        setMessage('Memorize the dogs!', 'info');
        
        // Set timeout to hide boxes again
        state.revealedTimeout = setTimeout(() => {
            hideBoxes();
        }, CONFIG.REVEAL_DURATION);
    }

    /**
     * Hide all boxes
     */
    function hideBoxes() {
        const boxElements = elements.gameBoard.querySelectorAll('.box');
        boxElements.forEach((el) => {
            el.classList.remove('flipped');
        });
        
        elements.gameBoard.classList.remove('locked');
        state.gamePhase = 'playing';
        elements.playBtn.disabled = false;
        setMessage('Find all the dogs! Click carefully...', 'info');
    }

    /**
     * Handle box click during gameplay
     */
    function handleBoxClick(index) {
        // Ignore clicks if not in playing phase or box already selected
        if (state.gamePhase !== 'playing') return;
        
        const box = state.boxes[index];
        const boxElement = elements.gameBoard.querySelector(`[data-index="${index}"]`);
        
        // Ignore if already selected
        if (box.selected || box.correct) return;
        
        // Mark as selected
        box.selected = true;
        boxElement.classList.add('flipped');
        
        if (box.hasDog) {
            // Found a dog!
            box.correct = true;
            boxElement.classList.add('correct', 'dog-found');
            state.dogsFound++;
            updateStats();
            
            // Check if all dogs found
            if (state.dogsFound === state.dogCount) {
                handleRoundWin();
            }
        } else {
            // Clicked an empty box - lose a heart!
            boxElement.classList.add('wrong', 'empty-clicked');
            state.health--;
            updateStats();
            
            if (state.health <= 0) {
                handleGameOver();
            } else {
                setMessage(`💔 You lost a heart! ${state.health} hearts remaining!`, 'error');
            }
        }
    }

    /**
     * Handle round win
     */
    function handleRoundWin() {
        state.gamePhase = 'won';
        state.streak++;
        
        // Calculate score
        const roundScore = (state.dogCount * CONFIG.POINTS_PER_DOG) + 
                          (state.round * CONFIG.ROUND_BONUS);
        state.score += roundScore;
        updateStats();
        
        // Show success message - correct boxes celebrate, others just flip
        const boxElements = elements.gameBoard.querySelectorAll('.box');
        boxElements.forEach((el, index) => {
            
	    if (state.boxes[index].correct) {
                el.classList.add('celebrate');
            }
	      else {
                el.classList.add('flipped');
           }
        });
        
        const streakText = state.streak > 1 ? ` (${state.streak} in a row!)` : '';
        setMessage(`🎉 Congratulations! You won! +${roundScore} points!${streakText}`, 'success');
        
        // Auto-start next round after delay
        setTimeout(() => {
            startNextRound();
        }, 1500);
    }

    /**
     * Handle game over
     */
    function handleGameOver() {
        state.gamePhase = 'lost';
        state.streak = 0;
        
        // Reveal all boxes to show what was missed
        const boxElements = elements.gameBoard.querySelectorAll('.box');
        boxElements.forEach((el, index) => {
            if (!state.boxes[index].revealed) {
                el.classList.add('flipped');
            }
        });
        
        setMessage('💥 You ran out of hearts! Game Over!', 'error');
        
        // Show lose modal
        setTimeout(() => {
            showModal(false, 0);
        }, 600);
    }

    /**
     * Show the game over/win modal
     */
    function showModal(isWin, roundScore) {
        if (isWin) {
            elements.modalTitle.textContent = '🎉 You Won!';
            elements.modalTitle.className = 'modal-title win';
            elements.modalMessage.textContent = 
                `Amazing! You found all ${state.dogCount} dogs and earned ${roundScore} points!`;
            elements.modalPlayAgain.textContent = 'Next Round';
        } else {
            elements.modalTitle.textContent = '💥 Game Over!';
            elements.modalTitle.className = 'modal-title lose';
            elements.modalMessage.textContent = 
                'You ran out of hearts! Better luck next time.';
            elements.modalPlayAgain.textContent = 'Play Again';
        }
        
        elements.finalScore.textContent = state.score;
        elements.finalRound.textContent = state.round;
        
        elements.modalOverlay.classList.add('active');
    }

    /**
     * Hide the modal
     */
    function hideModal() {
        elements.modalOverlay.classList.remove('active');
    }

    /**
     * Start a new round
     */
    function startNextRound() {
        hideModal();
        state.round++;

        if (state.rowCount >= state.colCount) {
            state.colCount++;
            state.rowCount = 1;
        } else {
            state.rowCount++;
        }

        updateTierColor();
        state.gamePhase = 'ready';
        
        generateBoxes();
        renderBoard();
        
        elements.playBtn.disabled = false;
        setMessage('Click Play to reveal the boxes!', 'info');
    }

    /**
     * Restart the entire game
     */
    function restartGame() {
        hideModal();
        
        // Clear any existing timeout
        if (state.revealedTimeout) {
            clearTimeout(state.revealedTimeout);
            state.revealedTimeout = null;
        }
        
        state.round = 1;
        state.score = 0;
        state.streak = 0;
        state.health = CONFIG.MAX_HEALTH;
        state.colCount = CONFIG.INITIAL_COLS;
        state.rowCount = CONFIG.INITIAL_ROWS;
        state.gamePhase = 'ready';

        updateTierColor();
        generateBoxes();
        renderBoard();
        
        elements.gameBoard.classList.remove('locked');
        elements.playBtn.disabled = false;
        setMessage('Click Play to reveal the boxes!', 'info');
    }

    /**
     * Initialize the game
     */
    function init() {
        updateTierColor();
        generateBoxes();
        renderBoard();
        
        // Set up event listeners
        elements.playBtn.addEventListener('click', () => {
            if (state.gamePhase === 'ready') {
                revealBoxes();
            }
        });
        
        elements.modalPlayAgain.addEventListener('click', () => {
            if (state.gamePhase === 'won') {
                startNextRound();
            } else {
                restartGame();
            }
        });
        
        // Close modal on overlay click
        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) {
                // Allow modal to stay open, user must click button
            }
        });
        
        // Keyboard accessibility for modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modalOverlay.classList.contains('active')) {
                hideModal();
            }
        });
        
        // Debug: Reveal all boxes for testing
        elements.debugRevealBtn.addEventListener('click', () => {
            revealBoxes();
        });
        
        setMessage('Click Play to reveal the boxes!', 'info');
    }

    // ========================================
    // Start the Game
    // ========================================
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
