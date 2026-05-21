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
        CAT_EMOJI: '🐱',
        BONE_EMOJI: '🦴',
        CHEST_EMOJI: '🎁',
        EMPTY_EMOJI: '',
        MIN_DOGS: 1,
        MAX_DOG_RATIO: 0.4,
        MIN_CATS: 1,
        MAX_CAT_RATIO: 0.1,
        MIN_PUPPIES: 1,
        MAX_BONE_RATIO: 0.25,
        MIN_CHESTS: 1,
        MAX_CHEST_RATIO: 0.05,
        POINTS_PER_DOG: 10,
        ROUND_BONUS: 5,
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
    // Debug Mode
    // ========================================
    
    const DEBUG = new URLSearchParams(location.search).has('debug');

    // ========================================
    // Game State
    // ========================================
    
    const state = {
        round: 1,
        score: 0,
        streak: 0,
        health: 3,
        boxes: [],
        colCount: CONFIG.INITIAL_COLS,
        rowCount: CONFIG.INITIAL_ROWS,
        dogCount: 0,
        catCount: 0,
        boneCount: 0,
        chestCount: 0,
        dogsFound: 0,
        gamePhase: 'ready',
        revealedTimeout: null,
        nextRoundTimeout: null,
        tier: 1,
        diedToCat: false,
        powerups: {
            magnifier: false,
            catSwatter: false,
            bombActive: false,
            rich: false,
            kibble: false,
            magnet: false,
            cursed: false,
            shotgun: false,
            bigFingers: false,
            chests:false,
            fogOfWar: false
        },
        bigFingersBlanks: 0,
        magnifierUsed: false
    };

    // ========================================
    // DOM Elements
    // ========================================
    
    const elements = {
        dogsFound: document.getElementById('dogs-found'),
        score: document.getElementById('score'),
        heartsContainer: document.getElementById('hearts-container'),
        inventoryItems: document.getElementById('inventory-items'),
        gameMessage: document.getElementById('game-message'),
        gameBoard: document.getElementById('game-board'),
        playBtn: document.getElementById('play-btn'),
        modalOverlay: document.getElementById('modal-overlay'),
        modalTitle: document.getElementById('modal-title'),
        modalMessage: document.getElementById('modal-message'),
        finalScore: document.getElementById('final-score'),
        finalRound: document.getElementById('final-round'),
        modalPlayAgain: document.getElementById('modal-play-again'),
        debugRevealBtn: document.getElementById('debug-reveal-btn'),
        debugNextTierBtn: document.getElementById('debug-next-tier-btn')
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

    function getAdjacentIndices(index, colCount, rowCount) {
        const adjacent = [];
        const row = Math.floor(index / colCount);
        const col = index % colCount;

        if (row > 0) adjacent.push(index - colCount);
        if (row < rowCount - 1) adjacent.push(index + colCount);
        if (col > 0) adjacent.push(index - 1);
        if (col < colCount - 1) adjacent.push(index + 1);

        return adjacent;
    }

    function getAllAdjacentIndices(index, colCount, rowCount, totalBoxes) {
        const adjacent = [];
        const row = Math.floor(index / colCount);
        const col = index % colCount;
        
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (newRow >= 0 && newRow < rowCount && newCol >= 0 && newCol < colCount) {
                    adjacent.push(newRow * colCount + newCol);
                }
            }
        }
        return adjacent;
    }

    /**
     * Update all UI stats
     */
    function updateStats() {
        elements.dogsFound.textContent = `${state.dogsFound} / ${state.dogCount}`;
        elements.score.textContent = state.score;
        renderHearts();
    }

    /**
     * Render hearts display
     */
    function renderHearts() {
        elements.heartsContainer.innerHTML = '';
        if (state.health > 3) {
            const heartText = document.createElement('span');
            heartText.className = 'heart';
            heartText.textContent = `${state.health} ❤️`;
            elements.heartsContainer.appendChild(heartText);
        } else {
            for (let i = 0; i < Math.max(3, state.health); i++) {
                const heart = document.createElement('span');
                heart.className = 'heart';
                heart.textContent = i < state.health ? '❤️' : '🖤';
                elements.heartsContainer.appendChild(heart);
            }
        }
    }

    function updateInventory() {
        if (!elements.inventoryItems) return;
        
        elements.inventoryItems.innerHTML = '';
        
        const itemTypes = [
            { key: 'magnifier', emoji: '🔍', name: 'Magnifying Glass', desc: 'First mistake free' },
            { key: 'catSwatter', emoji: '🕹️', name: 'Cat Swatter', desc: 'Cats = -3 HP' },
            { key: 'bombActive', emoji: '💣', name: 'Bomb', desc: 'Flips 4 random tiles' },
            { key: 'rich', emoji: '💰', name: 'Riches', desc: 'Score x2' },
            { key: 'magnet', emoji: '🧲', name: 'Magnet', desc: 'Collect unclicked items' },
            { key: 'cursed', emoji: '💀', name: 'Cursed', desc: 'No more chests' },
            { key: 'shotgun', emoji: '🔫', name: 'Shotgun', desc: 'Reveal adjacent dogs' },
            { key: 'bigFingers', emoji: '🖐️', name: 'Big Fingers', desc: 'Click adjacent, lose HP on 3+ blanks' },
            { key: 'chests', emoji: '📦', name: 'Chests', desc: 'Extra powerups' },
            { key: 'fogOfWar', emoji: '🌫️', name: 'Fog of War', desc: 'Goods = ✅, Bads = 💀' }
        ];
        
        itemTypes.forEach(item => {
            if (state.powerups[item.key]) {
                const el = document.createElement('div');
                el.className = 'inventory-item';
                el.textContent = item.emoji;
                
                const tooltip = document.createElement('span');
                tooltip.className = 'tooltip';
                tooltip.textContent = `${item.name}: ${item.desc}`;
                el.appendChild(tooltip);
                
                elements.inventoryItems.appendChild(el);
            }
        });
    }

    function showHeartAnimation(boxElement) {
        const heartEl = document.createElement('div');
        heartEl.className = 'heart-gain';
        heartEl.textContent = '❤️';
        boxElement.appendChild(heartEl);
        
        setTimeout(() => {
            heartEl.remove();
        }, 800);
    }

    function showChestAnimation(boxElement) {
        const chestEl = document.createElement('div');
        chestEl.className = 'chest-gain';
        chestEl.textContent = '💎';
        boxElement.appendChild(chestEl);
        
        setTimeout(() => {
            chestEl.remove();
        }, 1000);
    }

    const LOOT_TABLE = [
        { id: 'magnifier', name: 'Magnifying Glass', emoji: '🔍', description: 'First mistake each round is free!', effect: () => { state.powerups.magnifier = true; }, weight: 8 },
        { id: 'catSwatter', name: 'Cat Swatter', emoji: '🕹️', description: 'Cats are only -3 life instead of instant death!', effect: () => { state.powerups.catSwatter = true; }, weight: 8 },
        { id: 'bomb', name: 'Bomb', emoji: '💣', description: 'At the start of the round, a bomb flips 4 random tiles!', effect: () => { state.powerups.bombActive = true; }, weight: 8 },
        { id: 'rich', name: 'Riches', emoji: '💰', description: 'Immediately double your score!', effect: () => { state.powerups.rich = true; state.score *= 2; updateStats(); }, weight: 6 },
        { id: 'kibble', name: 'Kibble', emoji: '🥣', description: '+10 Hearts!', effect: () => { state.health += 10; }, weight: 10 },
        { id: 'magnet', name: 'Magnet', emoji: '🧲', description: 'Collect all unclicked bones and chests on win!', effect: () => { state.powerups.magnet = true; }, weight: 8 },
        { id: 'cursed', name: 'Cursed', emoji: '💀', description: 'No more chests will spawn this game!', effect: () => { state.powerups.cursed = true; }, weight: 4 },
        { id: 'shotgun', name: 'Shotgun', emoji: '🔫', description: 'Clicking a dog reveals all adjacent dogs!', effect: () => { state.powerups.shotgun = true; }, weight: 6 },
        { id: 'bigFingers', name: 'Big Fingers', emoji: '🖐️', description: 'Click reveals all adjacent tiles. Lose heart only if 3+ blanks revealed.', effect: () => { state.powerups.bigFingers = true; }, weight: 8 },
        { id: 'chests', name: 'More Chests!', emoji: '📦', description: 'Spin again!', effect: () => { state.powerups.chests = true; }, weight: 6 },
        { id: 'fogOfWar', name: 'Fog of War', emoji: '🌫️', description: 'Goods appear as ✅, bads as 💀 until revealed!', effect: () => { state.powerups.fogOfWar = true; }, weight: 6 }
    ];

    function getRandomLoot() {

        // Remove powerups already owned
        const availableLoot = LOOT_TABLE.filter(item => {
            return !state.powerups[item.id];
        });

        // If everything is owned, fallback to full table
        const table = availableLoot.length > 0 ? availableLoot : LOOT_TABLE;

        const totalWeight = table.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;

        for (const item of table) {
            random -= item.weight;
            if (random <= 0) {
                return item;
            }
        }

        return table[0];
    }

    function showSpinToWinModal() {
        const modal = document.getElementById('spin-modal');
        const spinner = document.getElementById('spin-spinner');
        const result = document.getElementById('spin-result');
        const resultEmoji = document.getElementById('spin-result-emoji');
        const resultName = document.getElementById('spin-result-name');
        const resultDesc = document.getElementById('spin-result-desc');
        const spinBtn = document.getElementById('spin-btn');
        
        modal.classList.add('active');
        spinner.classList.add('spinning');
        result.style.display = 'none';
        spinBtn.style.display = 'inline-block';
        
        let spinCount = 0;
        const spinInterval = setInterval(() => {
            const temp = getRandomLoot();
            resultEmoji.textContent = temp.emoji;
            resultName.textContent = temp.name;
            spinCount++;
            
            if (spinCount >= 15) {
                clearInterval(spinInterval);
                spinner.classList.remove('spinning');
                
                const finalLoot = getRandomLoot();
                resultEmoji.textContent = finalLoot.emoji;
                resultName.textContent = finalLoot.name;
                resultDesc.textContent = finalLoot.description;
                result.style.display = 'block';
                
                if (finalLoot.effect) {
                    finalLoot.effect();
                }
                
                if (finalLoot.id === 'kibble') {
                    updateStats();
                }
                
                if (finalLoot.id === 'chests') {
                    setTimeout(() => {
                        showSpinToWinModal();
                    }, 1500);
                    setTimeout(() => {
                        showSpinToWinModal();
                    }, 1500);
                }
                
                updateInventory();
            }
        }, 100);
    }

    function hideSpinModal() {
        document.getElementById('spin-modal').classList.remove('active');
    }

    window.hideSpinModal = hideSpinModal;

    // ========================================
    // Start the Game
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
        const tierColor = CONFIG.TIER_COLORS[state.tier] || CONFIG.TIER_COLORS[1];
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
     * Calculate number of cats based on box count (tier 3+)
     */
    function calculateCatCount(boxCount, tier) {
        if (tier < 3) return 0;
        const minCats = CONFIG.MIN_CATS;
        const maxCats = Math.floor(boxCount * CONFIG.MAX_CAT_RATIO);
        return randomInt(minCats, maxCats);
    }

    /**
     * Calculate number of bones based on box count (tier 2+)
     */
    function calculateBoneCount(boxCount, tier) {
        if (tier < 2) return 0;
        const minBones = CONFIG.MIN_PUPPIES;
        const maxBones = Math.floor(boxCount * CONFIG.MAX_BONE_RATIO);
        return randomInt(minBones, maxBones);
    }

    /**
     * Calculate number of treasure chests based on box count (tier 4+)
     */
    function calculateChestCount(boxCount, tier, isCursed) {
        if (tier < 4 || isCursed) return 0;
        const minChests = CONFIG.MIN_CHESTS;
        const maxChests = Math.floor(boxCount * CONFIG.MAX_CHEST_RATIO);
        return randomInt(minChests, maxChests);
    }

    /**
     * Generate boxes with random dog, cat, bone, and chest placement
     */
    function generateBoxes() {
        const boxCount = getBoxCount();
        state.dogCount = calculateDogCount(boxCount);
        state.catCount = calculateCatCount(boxCount, state.tier);
        state.boneCount = calculateBoneCount(boxCount, state.tier);
        state.chestCount = calculateChestCount(boxCount, state.tier, state.powerups.cursed);
        state.dogsFound = 0;
        state.bigFingersBlanks = 0;
        
        // Create array with dogs, cats, bones, chests, and empty spaces
        const boxContents = [
            ...Array(state.dogCount).fill('dog'),
            ...Array(state.catCount).fill('cat'),
            ...Array(state.boneCount).fill('bone'),
            ...Array(state.chestCount).fill('chest'),
            ...Array(boxCount - state.dogCount - state.catCount - state.boneCount - state.chestCount).fill('empty')
        ];
        
        // Shuffle the array
        const shuffled = shuffleArray(boxContents);
        
        // Create box objects
        state.boxes = shuffled.map((content, index) => ({
            id: index,
            hasDog: content === 'dog',
            hasCat: content === 'cat',
            hasBone: content === 'bone',
            hasChest: content === 'chest',
            revealed: false,
            selected: false,
            correct: false
        }));
        
        updateStats();
    }

    // HELPER FUNCTION FOR THE GLITCH POWERUP
    function generateLetterMask(cols, rows) {

        const canvas = document.createElement("canvas");
        canvas.width = cols;
        canvas.height = rows;

        const ctx = canvas.getContext("2d");

        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const letter = letters[Math.floor(Math.random() * letters.length)];

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, cols, rows);

        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${rows * 0.9}px Arial`;

        ctx.fillText(letter, cols / 2, rows / 2);

        const imageData = ctx.getImageData(0, 0, cols, rows).data;

        const mask = [];

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const i = (y * cols + x) * 4;
                const brightness = imageData[i];
                mask.push(brightness > 10);
            }
        }

        return mask;
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
            if (state.powerups.fogOfWar) {
                // Fog of War: goods show as ✅, bads as 💀
                if (box.hasDog || box.hasBone || box.hasChest) {
                    backFace.textContent = '✅';
                } else if (box.hasCat) {
                    backFace.textContent = '💀';
                } else {
                    backFace.textContent = CONFIG.EMPTY_EMOJI;
                }
            } else {
                if (box.hasDog) {
                    backFace.textContent = CONFIG.DOG_EMOJI;
                } else if (box.hasCat) {
                    backFace.textContent = CONFIG.CAT_EMOJI;
                } else if (box.hasBone) {
                    backFace.textContent = CONFIG.BONE_EMOJI;
                } else if (box.hasChest) {
                    backFace.textContent = CONFIG.CHEST_EMOJI;
                } else {
                    backFace.textContent = CONFIG.EMPTY_EMOJI;
                }
            }
            
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
    function handleBoxClick(index, isBigFingersReveal = false) {
        // Ignore clicks if not in playing phase or box already selected
        if (state.gamePhase !== 'playing') return;
        
        const box = state.boxes[index];
        const boxElement = elements.gameBoard.querySelector(`[data-index="${index}"]`);
        
        // Ignore if already selected
        if (box.selected || box.correct) return;
        
        // Mark as selected
        let blanksRevealed = 0;
        box.selected = true;
        boxElement.classList.add('flipped');
        
        if (box.hasCat) {
            // Clicked a cat
            boxElement.classList.add('wrong', 'empty-clicked');
            
            // Check for catSwatter - reduces damage to -3 HP instead of death
            if (state.powerups.catSwatter) {
                state.health -= 3;
                updateStats();
                if (state.health <= 0) {
                    state.health = 0;
                    handleGameOver();
                } else {
                    setMessage(`🕹️ Cat Swatter! -3 HP! ${state.health} hearts remaining!`, 'error');
                }
            } else {
                // Instant death!
                state.diedToCat = true;
                handleGameOver();
            }
            return;
        } else if (box.hasBone) {
            // Found a bone - gain a heart!
            boxElement.classList.add('correct', 'dog-found');
            state.health++;
            updateStats();
            showHeartAnimation(boxElement);
            setMessage(`🦴 You found a bone! +1 heart! (${state.health} hearts)`, 'success');
        } else if (box.hasChest) {
            // Found a treasure chest - spin to win!
            boxElement.classList.add('correct', 'dog-found');
            showChestAnimation(boxElement);
            setMessage(`💎 You found a treasure chest! Spin to win!`, 'success');
            showSpinToWinModal();
        } else if (box.hasDog) {
            // Found a dog!
            box.correct = true;
            boxElement.classList.add('correct', 'dog-found');
            state.dogsFound++;
            updateStats();
            
            // Shotgun: reveal adjacent dogs
            if (state.powerups.shotgun) {
                const adjacentIndices = getAdjacentIndices(index, state.colCount, state.rowCount, state.boxes.length);
                adjacentIndices.forEach(adjIndex => {
                    const adjBox = state.boxes[adjIndex];
                    if (adjBox.hasDog && !adjBox.correct) {
                        handleBoxClick(adjIndex, true);
                    }
                });
            }
            
            // Check if all dogs found
            if (state.dogsFound === state.dogCount) {
                handleRoundWin();
            }
        } 
        // IF BOX IS BLANK
        else {
            // Magnifier: first mistake is free
            if (state.powerups.magnifier && !state.magnifierUsed) {
                state.magnifierUsed = true;
                setMessage(`🔍 Magnifier! First mistake free!`, 'success');
            } else if (state.powerups.bigFingers) { 
                boxElement.classList.add('wrong', 'empty-clicked');
                blanksRevealed++;
            } else {
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
        
        // Big Fingers: reveal adjacent tiles as well
        if (state.powerups.bigFingers && !isBigFingersReveal) {

            const adjacentIndices = getAdjacentIndices(index, state.colCount, state.rowCount, state.boxes.length);
                            
            adjacentIndices.forEach(adjIndex => {
                const adjBox = state.boxes[adjIndex];
                if (!adjBox.selected && !adjBox.correct) {
                    handleBoxClick(adjIndex, true);
                    if (!adjBox.hasDog && !adjBox.hasBone && !adjBox.hasChest && !adjBox.hasCat) {
                        blanksRevealed++;
                    }
                }
            });
            
            // Lose heart only if 3+ blanks revealed
            if (blanksRevealed >= 3) {
                state.health--;
                updateStats();
                if (state.health <= 0) {
                    handleGameOver();
                    return;
                }
                setMessage(`🖐️ Big Fingers! ${blanksRevealed} blanks revealed! -1 HP! (${state.health} hearts)`, 'error');
            }
        }
    }

    /**
     * Handle round win
     */
    function handleRoundWin() {
        state.gamePhase = 'won';
        state.streak++;
        
        // Magnet: collect unclicked bones and chests
        let magnetBonus = 0;
        let magnetChests = 0;
        if (state.powerups.magnet) {
            state.boxes.forEach((box, index) => {
                if (!box.selected && !box.correct) {
                    if (box.hasBone) {
                        state.health++;
                        magnetBonus++;
                        const boxElement = elements.gameBoard.querySelector(`[data-index="${index}"]`);
                        boxElement.classList.add('flipped', 'correct', 'dog-found');
                        showHeartAnimation(boxElement);
                    } else if (box.hasChest) {
                        magnetBonus += 2;
                        magnetChests++;
                        const boxElement = elements.gameBoard.querySelector(`[data-index="${index}"]`);
                        boxElement.classList.add('flipped', 'correct', 'dog-found');
                        showChestAnimation(boxElement);
                    }
                }
            });
            if (magnetChests > 0) {
                setTimeout(() => {
                    setMessage(`💎 Magnet collected ${magnetChests} chest(s)! Spin to win!`, 'success');
                    showSpinToWinModal();
                }, 600);
            }
            if (magnetBonus > 0) {
                updateStats();
            }
        }
        
        // Calculate score
        let roundScore = (state.dogCount * CONFIG.POINTS_PER_DOG) + 
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
        const magnetText = magnetBonus > 0 ? ` 🧲 Magnet collected ${magnetBonus} item(s)!` : '';
        setMessage(`🎉 You win! +${roundScore} points!${streakText}${magnetText}`, 'success');
        
        // Auto-start next round after delay
        state.nextRoundTimeout = setTimeout(() => {
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
        
        const catMessage = state.diedToCat ? '😿 You died to a cat! ' : '';
        setMessage(catMessage + '💥 You ran out of hearts! Game Over!', 'error');
        
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
            elements.modalTitle.textContent = state.diedToCat ? '😿 Cat Fatality!' : '💥 Game Over!';
            elements.modalTitle.className = 'modal-title lose';
            const catText = state.diedToCat ? 'The cats got you! ' : '';
            elements.modalMessage.textContent = 
                catText + 'You ran out of hearts! Better luck next time.';
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
     * Debug: Skip to next tier
     */
    function skipToNextTier() {
        if (state.revealedTimeout) {
            clearTimeout(state.revealedTimeout);
            state.revealedTimeout = null;
        }
        if (state.nextRoundTimeout) {
            clearTimeout(state.nextRoundTimeout);
            state.nextRoundTimeout = null;
        }
        hideModal();
        state.round++;

        const currentTier = state.tier;
        const targetTier = currentTier + 1;
        
        const targetColCount = targetTier + 3;
        
        state.colCount = targetColCount;
        state.rowCount = 1;

        updateTierColor();
        state.gamePhase = 'ready';
        
        generateBoxes();
        renderBoard();
        
        elements.gameBoard.classList.remove('locked');
        elements.playBtn.disabled = false;
        setMessage(`[DEBUG] Skipped to Tier ${state.tier}! Click Play to reveal the boxes!`, 'info');
    }

    /**
     * Start a new round
     */
    function startNextRound() {
        if (state.nextRoundTimeout) {
            clearTimeout(state.nextRoundTimeout);
            state.nextRoundTimeout = null;
        }
        hideModal();
        state.round++;
        state.magnifierUsed = false;

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
        
        // Bomb: flip 4 random tiles at start of round
        if (state.powerups.bombActive) {
            const boxElements = Array.from(elements.gameBoard.querySelectorAll('.box'));
            const shuffled = shuffleArray([...Array(boxElements.length).keys()]);
            const bombIndices = shuffled.slice(0, 4);
            bombIndices.forEach(idx => {
                boxElements[idx].classList.add('flipped');
            });
        }
        
        elements.playBtn.disabled = false;
        setMessage('Click Play to reveal the boxes!', 'info');
    }

    /**
     * Restart the entire game
     */
    function restartGame() {
        hideModal();
        
        // Clear any existing timeouts
        if (state.revealedTimeout) {
            clearTimeout(state.revealedTimeout);
            state.revealedTimeout = null;
        }
        if (state.nextRoundTimeout) {
            clearTimeout(state.nextRoundTimeout);
            state.nextRoundTimeout = null;
        }
        
        state.round = 1;
        state.score = 0;
        state.streak = 0;
        state.health = 3;
        state.colCount = CONFIG.INITIAL_COLS;
        state.rowCount = CONFIG.INITIAL_ROWS;
        state.gamePhase = 'ready';
        state.diedToCat = false;
        state.magnifierUsed = false;
        state.powerups = {
            magnifier: false,
            catSwatter: false,
            bombActive: false,
            rich: false,
            kibble: false,
            magnet: false,
            cursed: false,
            shotgun: false,
            bigFingers: false,
            chests: false,
            fogOfWar: false
        };

        updateTierColor();
        generateBoxes();
        renderBoard();
        updateInventory();
        
        elements.gameBoard.classList.remove('locked');
        elements.playBtn.disabled = false;
        setMessage('Click Play to reveal the boxes!', 'info');
    }

    /**
     * Initialize the game
     */
    function init() {
        if (DEBUG) {
            const panel = document.getElementById('debug-panel');
            if (panel) panel.style.display = '';
        }

        updateTierColor();
        generateBoxes();
        renderBoard();
        updateInventory();
        
        // Set up event listeners
        elements.playBtn.addEventListener('click', () => {
            if (state.gamePhase === 'ready') {
                revealBoxes();
            } else if (state.gamePhase === 'won') {
                if (state.nextRoundTimeout) {
                    clearTimeout(state.nextRoundTimeout);
                    state.nextRoundTimeout = null;
                }
                startNextRound();
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
        
        // Debug: Skip to next tier
        elements.debugNextTierBtn.addEventListener('click', () => {
            skipToNextTier();
        });
        
        // Spin button event listener
        const spinBtn = document.getElementById('spin-btn');
        if (spinBtn) {
            spinBtn.addEventListener('click', hideSpinModal);
        }
        
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
