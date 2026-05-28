document.addEventListener('DOMContentLoaded', () => {
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
    const chapterEls = document.querySelectorAll('.card-chapter'); // Get the chapter divs

    let currentDeck = [];
    let currentCardIndex = 0;
    let cardStates = []; 
    let deckStats = JSON.parse(localStorage.getItem('deckStats')) || {};
    let currentDeckName = '';

    const decks = [
        { name: 'Deck 1', path: 'decks/test1.json' },
        { name: 'Deck 2', path: 'decks/test2.json' },
        { name: 'Deck 3', path: 'decks/test3.json' },
        { name: 'Deck 4', path: 'decks/test4.json' },
        { name: 'Deck 5', path: 'decks/test5.json' },
        { name: 'Deck 6 (X)', path: 'decks/test6.json' },
        { name: 'Deck 7', path: 'decks/test7.json' },
        { name: 'Deck 8 (X)', path: 'decks/test8.json' },
        { name: 'Deck 9 (X)', path: 'decks/test9.json' },
        { name: 'Deck 10 (X)', path: 'decks/test10.json' },
        { name: 'Deck 11', path: 'decks/test11.json' },
        { name: 'Deck 12', path: 'decks/test12.json' },
        { name: 'Deck 13', path: 'decks/test13.json' },
        { name: 'Deck 14', path: 'decks/test14.json' },
        { name: 'Deck 15 (X)', path: 'decks/test15.json' },
    ];

    function init() {
        renderDeckMenu();
        if (decks.length > 0) {
            loadDeck(decks[0]);
        }
        document.addEventListener('keydown', handleKeyPress);
    }

    function renderDeckMenu() {
        deckList.innerHTML = '';
        decks.forEach(deck => {
            const li = document.createElement('li');
            li.textContent = deck.name;
            const stats = deckStats[deck.name] || { attempts: 0, successRate: 0 };
            li.innerHTML += ` <span class="light-text">(${stats.attempts}, ${stats.successRate}%)</span>`;
            li.addEventListener('click', () => {
                loadDeck(deck);
                document.querySelectorAll('#deck-list li').forEach(item => item.classList.remove('active'));
                li.classList.add('active');
            });
            deckList.appendChild(li);
        });
        if(deckList.firstChild) {
            deckList.firstChild.classList.add('active');
        }
    }

    async function loadDeck(deck, reviewMissed = false) {
        currentDeckName = deck.name;
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

        card.classList.remove('flipped', 'card-correct', 'card-incorrect');
        const currentCard = currentDeck[currentCardIndex];
        
        cardCounterEl.textContent = `Card ${currentCardIndex + 1} of ${currentDeck.length}`;
        
        // Update chapter header lightly at the top
        chapterEls.forEach(el => el.textContent = currentCard.chapter || '');
        
        questionEl.innerHTML = formatText(currentCard.question);
        answerEl.innerHTML = formatText(currentCard.answer);

        if (currentCard.chapterColor) {
            document.documentElement.style.setProperty('--secondary-color', `var(${currentCard.chapterColor})`);
        } else {
            document.documentElement.style.setProperty('--secondary-color', '#C7CEEA'); // Default pastel
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
            if (direction === 'next') {
                moveToNext();
            } else {
                moveToPrev();
            }
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

        const stats = deckStats[currentDeckName] || { attempts: 0, successRate: 0, totalScore: 0 };
        stats.attempts++;
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

    flipBtn.addEventListener('click', flipCard);
    nextBtn.addEventListener('click', () => {
        const direction = card.classList.contains('flipped') ? 'correct' : 'next';
        handleNav(direction);
    });
    prevBtn.addEventListener('click', () => {
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