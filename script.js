document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    const menuToggle = document.getElementById('menu-toggle');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const currentDeckLabel = document.getElementById('current-deck-label');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    
    const deckList = document.getElementById('deck-list');
    const questionEl = document.getElementById('question');
    const answerEl = document.getElementById('answer');
    const card = document.getElementById('card');
    const prevBtn = document.getElementById('prev-btn');
    const flipBtn = document.getElementById('flip-btn');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');
    const progress = document.getElementById('progress');
    const scoreScreen = document.getElementById('score-screen');
    const scoreEl = document.getElementById('score');
    const restartFullDeckBtn = document.getElementById('restart-full-deck-btn');
    const reviewMissedBtn = document.getElementById('review-missed-btn');
    const cardCounterEl = document.getElementById('card-counter');
    const chapterEls = document.querySelectorAll('.card-chapter'); 

    let currentDeck = [];
    let currentCardIndex = 0;
    let cardStates = []; 
    let deckStats = JSON.parse(localStorage.getItem('deckStats')) || {};
    let currentDeckName = '';

    // Swipe Variables
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let hasMoved = false;

    // REMEMBER TO ADD YOUR OTHER DECKS BACK HERE
    const decks = [
        { name: 'Deck 1', path: 'decks/test1.json' },
        { name: 'Deck 2', path: 'decks/test2.json' },
        { name: 'Deck 3', path: 'decks/test3.json' }
    ];

    function init() {
        renderDeckMenu();
        if (decks.length > 0) {
            loadDeck(decks[0]);
        }
        document.addEventListener('keydown', handleKeyPress);
        setupUIEvents();
    }

    function setupUIEvents() {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error(err));
            } else {
                document.exitFullscreen();
            }
        });

        closeMenuBtn.addEventListener('click', () => {
            app.classList.add('menu-closed');
            menuToggle.classList.remove('hidden');
        });
        
        menuToggle.addEventListener('click', () => {
            app.classList.remove('menu-closed');
            menuToggle.classList.add('hidden');
        });

        // --- ENHANCED SWIPE & DRAG LOGIC ---
        card.addEventListener('pointerdown', (e) => {
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            card.classList.add('dragging');
            
            // CRITICAL FIX: Attach capture to the exact element clicked (fixes the text-click bug)
            try { e.target.setPointerCapture(e.pointerId); } catch(err) {} 
        });

        card.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            if (!card.classList.contains('flipped')) return;

            currentX = e.clientX - startX;
            
            if (Math.abs(currentX) > 10) {
                hasMoved = true;
                
                const rotation = currentX * 0.08; 
                card.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;
                
                if (card.classList.contains('flipped')) {
                    if (currentX > 50) {
                        nextBtn.style.transform = 'scale(1.15)';
                        prevBtn.style.transform = 'scale(1)';
                        card.style.boxShadow = '0 0 0 5px var(--correct-color)'; // Green border
                    } else if (currentX < -50) {
                        prevBtn.style.transform = 'scale(1.15)';
                        nextBtn.style.transform = 'scale(1)';
                        card.style.boxShadow = '0 0 0 5px var(--incorrect-color)'; // Red border
                    } else {
                        nextBtn.style.transform = 'scale(1)';
                        prevBtn.style.transform = 'scale(1)';
                        card.style.boxShadow = 'none'; // Remove border in the neutral zone
                    }
                }
            }
        });

        card.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            card.classList.remove('dragging');
            try { e.target.releasePointerCapture(e.pointerId); } catch(err) {}

            // Reset button sizes and remove the glow
            nextBtn.style.transform = 'scale(1)';
            prevBtn.style.transform = 'scale(1)';
            card.style.boxShadow = 'none';

            if (!hasMoved) {
                // It was just a tap, so flip it
                flipCard();
            } else if (card.classList.contains('flipped')) {
                // It was dragged on the back side, check if they swiped far enough
                const threshold = 100;
                if (currentX > threshold) {
                    card.classList.add('swipe-right');
                    setTimeout(() => handleNav('correct'), 300);
                } else if (currentX < -threshold) {
                    card.classList.add('swipe-left');
                    setTimeout(() => handleNav('incorrect'), 300);
                } else {
                    // Didn't drag far enough, snap back to center
                    card.style.transform = ''; 
                }
            }
            
            // Reset variables for the next interaction
            currentX = 0;
            hasMoved = false; 
        });     
    }

    function renderDeckMenu() {
        deckList.innerHTML = '';
        decks.forEach(deck => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = deck.name;
            
            const statsSpan = document.createElement('span');
            statsSpan.className = 'light-text';
            const stats = deckStats[deck.name] || { attempts: 0, successRate: 0 };
            statsSpan.textContent = `(${stats.attempts}, ${stats.successRate}%)`;
            
            li.appendChild(nameSpan);
            li.appendChild(statsSpan);

            li.addEventListener('click', () => {
                loadDeck(deck);
                document.querySelectorAll('#deck-list li').forEach(item => item.classList.remove('active'));
                li.classList.add('active');
            });
            deckList.appendChild(li);
        });
        if(deckList.firstChild && currentDeckName === '') {
            deckList.firstChild.classList.add('active');
        } else {
            Array.from(deckList.children).forEach(li => {
                if (li.firstChild.textContent === currentDeckName) {
                    li.classList.add('active');
                }
            });
        }
    }

    async function loadDeck(deck, reviewMissed = false) {
        currentDeckName = deck.name;
        currentDeckLabel.textContent = deck.name;

        try {
            const response = await fetch(deck.path);
            const rawData = await response.text();
            
            let allCards = parseDeck(rawData);

            if (reviewMissed) {
                const missedIndices = JSON.parse(localStorage.getItem(`${deck.name}_missed`)) || [];
                currentDeck = missedIndices.map(index => allCards[index]).filter(Boolean);
            } else {
                currentDeck = allCards;
                localStorage.removeItem(`${deck.name}_missed`);
                
                if (currentDeck.length > 0) {
                    const stats = deckStats[deck.name] || { attempts: 0, successRate: 0, totalScore: 0 };
                    stats.attempts++;
                    deckStats[deck.name] = stats;
                    localStorage.setItem('deckStats', JSON.stringify(deckStats));
                    renderDeckMenu(); 
                }
            }
            
            currentCardIndex = 0;
            cardStates = new Array(currentDeck.length).fill(0);
            updateProgress();
            renderCard();
            scoreScreen.style.display = 'none';
        } catch (error) {
            console.error('Error loading deck:', error);
            questionEl.textContent = 'Error loading deck.';
            answerEl.textContent = '';
            cardCounterEl.textContent = '';
            chapterEls.forEach(el => el.textContent = '');
        }
    }

    function parseDeck(rawData) {
        const lines = rawData.split('\n');
        const cards = [];
        let currentChapter = null;
        let chapterColorIndex = 0;
        const chapterColors = ['--light-green', '--light-blue', '--light-orange'];

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('#')) {
                currentChapter = trimmedLine.substring(1).trim();
                chapterColorIndex = (chapterColorIndex + 1) % chapterColors.length;
            } else if (trimmedLine.length > 0) {
                try {
                    const cardData = JSON.parse(trimmedLine);
                    cardData.chapter = currentChapter;
                    cardData.chapterColor = chapterColors[chapterColorIndex];
                    cards.push(cardData);
                } catch (e) {
                    console.warn(`Skipping malformed JSON line: ${line}`);
                }
            }
        });
        return cards;
    }

    function renderCard() {
        if (currentDeck.length === 0) {
            questionEl.textContent = 'No cards in this deck.';
            answerEl.textContent = '';
            cardCounterEl.textContent = '';
            chapterEls.forEach(el => el.textContent = '');
            return;
        }

        // Disable transition temporarily so the new card doesn't "fly back" from off-screen
        card.style.transition = 'none'; 
        card.classList.remove('flipped', 'card-correct', 'card-incorrect', 'swipe-left', 'swipe-right');
        card.style.transform = ''; 
        card.style.boxShadow = 'none';
        
        // Force the browser to register the instant reset before turning animations back on
        void card.offsetWidth; 
        card.style.transition = ''; // Re-enable animations

        const currentCard = currentDeck[currentCardIndex];
        
        cardCounterEl.textContent = `Card ${currentCardIndex + 1} of ${currentDeck.length}`;
        chapterEls.forEach(el => el.textContent = currentCard.chapter || '');
        
        questionEl.innerHTML = formatText(currentCard.question);
        answerEl.innerHTML = formatText(currentCard.answer);

        if (currentCard.chapterColor) {
            document.documentElement.style.setProperty('--secondary-color', `var(${currentCard.chapterColor})`);
        } else {
            document.documentElement.style.setProperty('--secondary-color', '#C7CEEA'); 
        }
        
        updateButtonStates();
        updateProgress();
    }
    
    function updateButtonStates() {
        const isFlipped = card.classList.contains('flipped');
        if (isFlipped) {
            prevBtn.textContent = 'Incorrect';
            prevBtn.classList.add('incorrect-btn');
            nextBtn.textContent = 'Correct';
            nextBtn.classList.add('correct-btn');
        } else {
            prevBtn.textContent = '←';
            prevBtn.classList.remove('incorrect-btn');
            nextBtn.textContent = '→';
            nextBtn.classList.remove('correct-btn');
        }
    }

    function formatText(text) {
        if(!text) return '';
        text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        text = text.replace(/\*(.*?)\*/g, '<i>$1</i>');
        text = text.replace(/\(([\d]+)\)/g, '<span class="light-text">($1)</span>');

        if (text.includes('-')) {
            const items = text.split(',').map(item => `<li>${item.replace('-', '').trim()}</li>`).join('');
            return `<ul>${items}</ul>`;
        }
        if (text.match(/\d+\)/)) {
            const items = text.split(',').map(item => `<li>${item.replace(/\d+\)/, '').trim()}</li>`).join('');
            return `<ol>${items}</ol>`;
        }
        return text;
    }

    function updateProgress() {
        if (currentDeck.length === 0) {
            progress.style.width = '0%';
            return;
        }
        const progressPercent = (currentCardIndex + 1) / currentDeck.length * 100;
        progress.style.width = `${progressPercent}%`;
    }

    function flipCard() {
        card.classList.toggle('flipped');
        updateButtonStates();
    }

    function handleNav(direction) {
        if (card.classList.contains('flipped')) {
            cardStates[currentCardIndex] = direction === 'correct' ? 1 : 0;
            
            if (direction === 'correct') {
                card.classList.add('card-correct');
            } else {
                card.classList.add('card-incorrect');
            }
            
            setTimeout(() => {
                moveToNext();
            }, 300);
            
        } else {
            if (direction === 'next') moveToNext();
            else moveToPrev();
        }
    }

    function moveToNext() {
        if (currentCardIndex < currentDeck.length - 1) {
            currentCardIndex++;
            renderCard();
        } else {
            showScore();
        }
    }

    function moveToPrev() {
        if (currentCardIndex > 0) {
            currentCardIndex--;
            renderCard();
        }
    }

    function showScore() {
        const correctAnswers = cardStates.filter(state => state === 1).length;
        const totalCards = currentDeck.length;
        const score = totalCards > 0 ? Math.round((correctAnswers / totalCards) * 100) : 0;

        scoreEl.textContent = `${score}%`;
        scoreScreen.style.display = 'block';

        const stats = deckStats[currentDeckName] || { attempts: 1, successRate: 0, totalScore: 0 };
        stats.totalScore += score;
        stats.successRate = Math.round(stats.totalScore / stats.attempts);
        deckStats[currentDeckName] = stats;
        localStorage.setItem('deckStats', JSON.stringify(deckStats));

        const missedCards = cardStates.map((state, index) => state === 0 ? index : -1).filter(index => index !== -1);
        localStorage.setItem(`${currentDeckName}_missed`, JSON.stringify(missedCards));

        renderDeckMenu();
    }

    function handleKeyPress(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            flipCard();
        }
    }

    flipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        flipCard();
    });
    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const direction = card.classList.contains('flipped') ? 'correct' : 'next';
        handleNav(direction);
    });
    prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const direction = card.classList.contains('flipped') ? 'incorrect' : 'prev';
        handleNav(direction);
    });
    restartBtn.addEventListener('click', () => {
        const activeDeck = decks.find(d => d.name === currentDeckName);
        loadDeck(activeDeck);
    });
    restartFullDeckBtn.addEventListener('click', () => {
         const activeDeck = decks.find(d => d.name === currentDeckName);
        loadDeck(activeDeck);
    });
    reviewMissedBtn.addEventListener('click', () => {
        const activeDeck = decks.find(d => d.name === currentDeckName);
        loadDeck(activeDeck, true);
    });

    init();
});
