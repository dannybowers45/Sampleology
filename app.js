import data from './data.json' with { type: 'json' };
import easyData from './easy_data.json' with { type: 'json' };

// ─── Configuration ────────────────────────────────────────────
const DEBUG = false;
const PLAY_ICON = 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.26a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z';
const PAUSE_ICON = 'M6 5h4V19H6zm8 0h4v14h-4z';
const ROUNDS_PER_GAME = 5;

// ─── Dataset Helpers ──────────────────────────────────────────
let selectedDifficulty = 'full';
function getActiveData() {
    return selectedDifficulty === 'easy' ? easyData : data;
}

// ─── State ────────────────────────────────────────────────────
let score = 0;
let round = 0;
let totalRounds = 0;
let currentAnswer = null;
let isPlaying = false;
let audioPlayer = new Audio();
let timerInterval = null;
let streak = 0;
let bestStreak = 0;
let hintsUsed = 0;
let hintLevel = 0;
let missedAnswers = [];
let availableSongs = [];
let playerName = '';
let selectedGenre = 'all';
let roundActive = false;
let audioEnded = false;

// ─── DOM Elements ─────────────────────────────────────────────
const EL = {
    setupScreen:      document.getElementById('setup-screen'),
    gameScreen:       document.getElementById('game-screen'),
    modalContainer:   document.getElementById('modal-container'),
    playerNameInput:  document.getElementById('player-name-input'),
    difficultySelect: document.getElementById('difficulty-select'),
    genreSelect:      document.getElementById('genre-select'),
    startGameButton:  document.getElementById('start-game-button'),
    showLeaderboard:  document.getElementById('show-leaderboard-btn'),
    score:            document.getElementById('current-score'),
    round:            document.getElementById('current-round'),
    streak:           document.getElementById('current-streak'),
    playInfo:         document.getElementById('play-info'),
    playButton:       document.getElementById('play-button'),
    buttonText:       document.getElementById('button-text'),
    playPath:         document.getElementById('play-path'),
    guessTitleInput:  document.getElementById('guess-title-input'),
    guessArtistInput: document.getElementById('guess-artist-input'),
    submitButton:     document.getElementById('submit-button'),
    hintButton:       document.getElementById('hint-button'),
    skipButton:       document.getElementById('skip-button'),
    messageBox:       document.getElementById('message-box'),
    progressFill:     document.getElementById('progress-fill'),
    artworkContainer: document.getElementById('artwork-container')
};

// ─── Audio Events ─────────────────────────────────────────────
audioPlayer.addEventListener('ended', () => {
    isPlaying = false;
    EL.playPath.setAttribute('d', PLAY_ICON);
    clearInterval(timerInterval);
    EL.progressFill.style.width = '0%';
    EL.progressFill.classList.remove('urgent');

    if (roundActive) {
        audioEnded = true;
        EL.playButton.disabled = false;
        EL.buttonText.textContent = 'REPLAY';
        setMessage('Song finished — submit your guess!', 'status-info');
    }
});

// ─── Utilities ────────────────────────────────────────────────
function normalizeString(str) {
    if (!str) return '';
    if (str.includes('feat.')) str = str.split('feat.')[0];
    if (str.includes('ft.')) str = str.split('ft.')[0];
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
            );
        }
    }
    return dp[m][n];
}

function fuzzyMatch(guess, target) {
    if (!guess || !target) return false;
    const g = normalizeString(guess);
    const t = normalizeString(target);
    if (g === t) return true;
    if (g.length >= 3 && t.includes(g)) return true;
    if (g.length >= 4 && t.length >= 4) {
        const maxDist = Math.max(1, Math.floor(Math.min(g.length, t.length) * 0.25));
        if (levenshtein(g, t) <= maxDist) return true;
    }
    return false;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Failed Song Logging ──────────────────────────────────
function logFailedSong(track, reason) {
    try {
        const log = JSON.parse(localStorage.getItem('sampleologyFailedSongs') || '[]');
        log.push({
            artist: track.artist,
            title: track.title,
            reason,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('sampleologyFailedSongs', JSON.stringify(log));
    } catch (e) { /* localStorage full or unavailable */ }
}

// ─── iTunes API ───────────────────────────────────────────────
async function fetchAudioSrc(track) {
    if (DEBUG) console.log(`[ITUNES API] Looking up: ${track.artist} - ${track.title}`);
    const term = encodeURIComponent(`${track.artist} ${track.title}`);
    const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!json.results || json.results.length === 0) {
            if (DEBUG) console.log('[ITUNES API] No results found');
            return { previewUrl: null, artworkUrl: null };
        }
        const result = json.results[0];
        if (DEBUG) console.log(`[ITUNES API] Found: ${result.artistName} - ${result.trackName}`);
        const artworkUrl = (result.artworkUrl100 || '').replace('100x100', '200x200');
        return { previewUrl: result.previewUrl || null, artworkUrl };
    } catch (err) {
        if (DEBUG) console.log('Error fetching data:', err);
        logFailedSong(track, err.message || 'fetch_error');
        return { previewUrl: null, artworkUrl: null };
    }
}

// ─── Artwork ──────────────────────────────────────────────────
function setArtwork(url) {
    if (url) {
        EL.artworkContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Album artwork';
        img.loading = 'eager';
        EL.artworkContainer.appendChild(img);
    } else {
        EL.artworkContainer.innerHTML = '<span class="artwork-placeholder">&#9835;</span>';
    }
}

// ─── Audio Controls ───────────────────────────────────────────
function playAudio() {
    audioPlayer.load();
    audioPlayer.volume = 0.8;
    audioPlayer.play().catch(() => {
        setMessage('Click anywhere to enable audio, then try again.', 'status-info');
        document.addEventListener('click', function retry() {
            audioPlayer.play().catch(() => {});
            document.removeEventListener('click', retry);
        }, { once: true });
    });
    isPlaying = true;
    EL.playPath.setAttribute('d', PAUSE_ICON);
}

function stopAudio() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    isPlaying = false;
    EL.playPath.setAttribute('d', PLAY_ICON);
}

// ─── Sound Effects (Web Audio API) ────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSFX(type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);

    if (type === 'correct') {
        osc.frequency.setValueAtTime(523, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'incorrect') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
    }
}

// ─── UI Helpers ───────────────────────────────────────────────
function setMessage(text, variant = '') {
    EL.messageBox.textContent = text;
    EL.messageBox.className = `status-message ${variant}`.trim();
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function animateElement(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

// ─── Playback Tracker (replaces old timer) ────────────────────
function startPlaybackTracker() {
    EL.progressFill.classList.remove('urgent');
    EL.progressFill.style.transition = 'none';
    EL.progressFill.style.width = '100%';

    const onCanPlay = () => {
        const duration = audioPlayer.duration;
        if (!duration || !isFinite(duration)) return;

        timerInterval = setInterval(() => {
            if (!audioPlayer.paused && isFinite(audioPlayer.duration)) {
                const progress = 1 - (audioPlayer.currentTime / audioPlayer.duration);
                EL.progressFill.style.width = `${Math.max(0, progress * 100)}%`;

                if (progress <= 0.25) {
                    EL.progressFill.classList.add('urgent');
                }
            }
        }, 100);
    };

    audioPlayer.addEventListener('loadedmetadata', onCanPlay, { once: true });
    // Fallback if metadata already loaded
    if (audioPlayer.readyState >= 1 && isFinite(audioPlayer.duration)) {
        onCanPlay();
    }
}

// ─── Reset Controls ───────────────────────────────────────────
function resetControls() {
    stopAudio();
    clearInterval(timerInterval);
    roundActive = false;
    audioEnded = false;

    EL.playInfo.textContent = 'Ready for next round...';
    EL.playButton.disabled = false;
    EL.buttonText.textContent = 'NEXT ROUND';
    EL.playPath.setAttribute('d', PLAY_ICON);

    EL.guessTitleInput.value = '';
    EL.guessTitleInput.disabled = true;
    EL.guessTitleInput.classList.remove('input-correct', 'input-incorrect');
    EL.guessArtistInput.value = '';
    EL.guessArtistInput.disabled = true;
    EL.guessArtistInput.classList.remove('input-correct', 'input-incorrect');
    EL.submitButton.disabled = true;
    EL.hintButton.disabled = true;
    EL.skipButton.disabled = true;
    EL.messageBox.classList.remove('correct', 'incorrect');
    EL.progressFill.style.width = '100%';
    EL.progressFill.style.transition = 'none';
    EL.progressFill.classList.remove('urgent');
}

// ─── Start Round ──────────────────────────────────────────────
async function startRound() {
    resetControls();
    hintLevel = 0;
    EL.hintButton.textContent = 'Hint (3)';
    round++;
    EL.round.textContent = `${round}/${totalRounds}`;

    if (availableSongs.length === 0) {
        endGame();
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableSongs.length);
    currentAnswer = availableSongs.splice(randomIndex, 1)[0];
    const originalSample = currentAnswer.sample;

    // Show loading state
    EL.playInfo.textContent = 'Loading audio...';
    EL.playButton.disabled = true;
    setArtwork(null);
    setMessage('Loading audio...', 'status-neutral');

    const { previewUrl, artworkUrl } = await fetchAudioSrc(originalSample);

    if (!previewUrl) {
        logFailedSong(originalSample, 'no_preview_url');
        setMessage('Audio not available for this track. Skipping...', 'status-info');
        setTimeout(() => startRound(), 1500);
        return;
    }

    audioPlayer.src = previewUrl;
    setArtwork(artworkUrl);
    playAudio();

    // Update UI (use textContent to prevent XSS)
    EL.playInfo.textContent = `Playing: ${originalSample.title} by ${originalSample.artist}`;
    EL.playButton.disabled = true;
    EL.guessTitleInput.disabled = false;
    EL.guessArtistInput.disabled = false;
    EL.submitButton.disabled = false;
    EL.hintButton.disabled = false;
    EL.skipButton.disabled = false;
    EL.buttonText.textContent = 'PLAYING...';
    EL.guessTitleInput.focus();
    roundActive = true;
    audioEnded = false;
    setMessage('What song sampled this? (1 pt for title, 1 pt for artist)', 'status-neutral');

    startPlaybackTracker();
}

// ─── Hint System ──────────────────────────────────────────────
function giveHint() {
    if (!currentAnswer || !roundActive) return;
    const sampled = currentAnswer.sampled;
    hintLevel++;
    hintsUsed++;

    if (hintLevel === 1) {
        const firstLetter = sampled.title.charAt(0).toUpperCase();
        setMessage(`Hint: Title starts with "${firstLetter}"`, 'status-info');
    } else if (hintLevel === 2) {
        const firstWord = sampled.artist.split(' ')[0];
        setMessage(`Hint: Artist's first name is "${firstWord}"`, 'status-info');
    } else {
        const words = sampled.title.split(' ');
        const partial = words.length > 1 ? words.slice(0, 2).join(' ') + '...' : words[0];
        setMessage(`Hint: Title is "${partial}"`, 'status-info');
    }
    EL.hintButton.textContent = hintLevel >= 3 ? 'No hints left' : `Hint (${3 - hintLevel})`;
    if (hintLevel >= 3) EL.hintButton.disabled = true;
}

// ─── Skip ─────────────────────────────────────────────────────
async function skipRound() {
    if (!currentAnswer || !roundActive) return;
    roundActive = false;
    clearInterval(timerInterval);

    const sampled = currentAnswer.sampled;
    streak = 0;
    EL.streak.textContent = streak;
    missedAnswers.push({ sample: currentAnswer.sample, sampled });

    playSFX('incorrect');
    setMessage(`Skipped! It was: ${sampled.title} by ${sampled.artist}`, 'incorrect');

    resetControls();
    const { previewUrl, artworkUrl } = await fetchAudioSrc(sampled);
    if (previewUrl) {
        audioPlayer.src = previewUrl;
        setArtwork(artworkUrl);
        playAudio();
    }
}

// ─── Submit Guess ─────────────────────────────────────────────
async function submitGuess() {
    if (!currentAnswer || !roundActive) return;
    roundActive = false;
    clearInterval(timerInterval);

    const titleGuess = EL.guessTitleInput.value.trim();
    const artistGuess = EL.guessArtistInput.value.trim();

    if (!titleGuess && !artistGuess) {
        roundActive = true;
        return;
    }

    const sampled = currentAnswer.sampled;
    const correctTitle = sampled.title;
    const correctArtist = sampled.artist;

    let titleCorrect = false;
    let artistCorrect = false;

    if (titleGuess) {
        titleCorrect = fuzzyMatch(titleGuess, correctTitle);
        // Check aliases for title
        if (!titleCorrect && sampled.aliases) {
            const aliases = typeof sampled.aliases === 'string'
                ? sampled.aliases.split(',').map(a => a.trim()).filter(Boolean)
                : [];
            titleCorrect = aliases.some(alias => fuzzyMatch(titleGuess, alias));
        }
    }

    if (artistGuess) {
        artistCorrect = fuzzyMatch(artistGuess, correctArtist);
    }

    const rawPoints = (titleCorrect ? 1 : 0) + (artistCorrect ? 1 : 0);
    const hintPenalty = hintLevel * 0.5;
    const pointsEarned = Math.max(0, rawPoints - hintPenalty);
    const answerText = `${sampled.title} by ${sampled.artist}`;

    // Visual feedback on inputs
    EL.guessTitleInput.classList.add(titleCorrect ? 'input-correct' : (titleGuess ? 'input-incorrect' : ''));
    EL.guessArtistInput.classList.add(artistCorrect ? 'input-correct' : (artistGuess ? 'input-incorrect' : ''));

    const ptsDisplay = pointsEarned % 1 === 0 ? pointsEarned : pointsEarned.toFixed(1);
    const hintText = hintLevel > 0 ? ` (${hintLevel} hint${hintLevel > 1 ? 's' : ''}: -${hintPenalty % 1 === 0 ? hintPenalty : hintPenalty.toFixed(1)})` : '';

    if (rawPoints === 2) {
        score += pointsEarned;
        if (pointsEarned > 0) {
            streak++;
            if (streak > bestStreak) bestStreak = streak;
        } else {
            streak = 0;
        }
        playSFX('correct');
        const streakText = streak >= 3 ? ` (${streak} streak!)` : '';
        setMessage(`Perfect! +${ptsDisplay} pts${hintText}! ${answerText}${streakText}`, 'correct');
        animateElement(EL.messageBox, 'anim-pulse');
    } else if (rawPoints === 1) {
        score += pointsEarned;
        streak = 0;
        const which = titleCorrect ? 'Title' : 'Artist';
        playSFX('correct');
        setMessage(`${which} correct! +${ptsDisplay} pt${hintText}. Answer: ${answerText}`, 'correct');
        animateElement(EL.messageBox, 'anim-pulse');
    } else {
        streak = 0;
        missedAnswers.push({ sample: currentAnswer.sample, sampled });
        playSFX('incorrect');
        setMessage(`Incorrect. It was: ${answerText}`, 'incorrect');
        animateElement(EL.messageBox, 'anim-shake');
    }

    const scoreDisplay = score % 1 === 0 ? score : score.toFixed(1);
    EL.score.textContent = scoreDisplay;
    EL.streak.textContent = streak;

    resetControls();
    // Play the sampled song as reveal
    const { previewUrl, artworkUrl } = await fetchAudioSrc(sampled);
    if (previewUrl) {
        audioPlayer.src = previewUrl;
        setArtwork(artworkUrl);
        playAudio();
    }
}

// ─── End Game → Leaderboard ───────────────────────────────────
function endGame() {
    stopAudio();
    roundActive = false;

    const maxScore = totalRounds * 2;
    const accuracy = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    saveToLeaderboard(playerName, score, totalRounds, accuracy, bestStreak, selectedGenre, hintsUsed);
    showLeaderboardModal(true, score, maxScore, accuracy, bestStreak, missedAnswers);
}

// ─── Leaderboard (localStorage) ──────────────────────────────
function getLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem('sampleologyLeaderboard') || '[]');
    } catch { return []; }
}

function saveToLeaderboard(name, score, rounds, accuracy, bestStreak, genre, hintsUsedTotal) {
    const lb = getLeaderboard();
    lb.push({
        name,
        score: Math.round(score * 10) / 10,
        maxScore: rounds * 2,
        rounds,
        accuracy,
        bestStreak,
        genre: genre === 'all' ? 'All' : genre,
        hintsUsed: hintsUsedTotal || 0,
        date: new Date().toLocaleDateString()
    });
    lb.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy);
    localStorage.setItem('sampleologyLeaderboard', JSON.stringify(lb.slice(0, 20)));
}

function showLeaderboardModal(isEndGame = false, gameScore = 0, maxScore = 0, accuracy = 0, gameBestStreak = 0, gameMissed = []) {
    const lb = getLeaderboard();

    const fmtScore = (s) => s % 1 === 0 ? s : Number(s).toFixed(1);

    // End game summary section
    let summaryHTML = '';
    if (isEndGame) {
        let missedHTML = '';
        if (gameMissed.length > 0) {
            const items = gameMissed.map(m => {
                const sampleText = document.createElement('span');
                sampleText.textContent = `${m.sample.title} by ${m.sample.artist}`;
                const sampledText = document.createElement('span');
                sampledText.textContent = `${m.sampled.title} by ${m.sampled.artist}`;
                return `<div class="missed-item">${sampleText.textContent} → ${sampledText.textContent}</div>`;
            }).join('');
            missedHTML = `
                <p class="option-group-label mt-3">Missed Answers</p>
                <div class="missed-list mt-2">${items}</div>
            `;
        }

        summaryHTML = `
            <h2 class="text-2xl font-black text-center" style="color: var(--accent);">Game Over!</h2>
            <div class="stat-grid mt-3" style="grid-template-columns: repeat(2, 1fr);">
                <div class="stat-chip"><span class="stat-label">Final Score</span><span class="stat-value">${fmtScore(gameScore)}/${maxScore}</span></div>
                <div class="stat-chip"><span class="stat-label">Accuracy</span><span class="stat-value">${accuracy}%</span></div>
                <div class="stat-chip"><span class="stat-label">Best Streak</span><span class="stat-value">${gameBestStreak}</span></div>
                <div class="stat-chip"><span class="stat-label">Genre</span><span class="stat-value">${selectedGenre === 'all' ? 'All' : selectedGenre}</span></div>
            </div>
            ${missedHTML}
            <hr style="border-color: rgba(255,255,255,0.06); margin: 16px 0;">
        `;
    }

    // Leaderboard rows
    let rowsHTML = '';
    if (lb.length === 0) {
        rowsHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No scores yet. Play a game!</p>';
    } else {
        rowsHTML = lb.map((entry, i) => {
            const scoreVal = fmtScore(entry.score);
            const scoreDisplay = entry.maxScore ? `${scoreVal}/${entry.maxScore}` : `${scoreVal}/${entry.rounds}`;
            const genreDisplay = entry.genre ? ` | ${entry.genre}` : '';
            const hintsDisplay = entry.hintsUsed != null ? ` | ${entry.hintsUsed} hint${entry.hintsUsed !== 1 ? 's' : ''}` : '';
            return `
            <div class="lb-row">
                <span class="lb-rank">#${i + 1}</span>
                <span class="lb-name">${escapeHTML(entry.name)}</span>
                <span class="lb-score">${scoreDisplay}</span>
                <span class="lb-details">${entry.accuracy}%${genreDisplay}${hintsDisplay} | ${entry.date}</span>
            </div>
        `}).join('');
    }

    const title = isEndGame ? 'Leaderboard' : 'Leaderboard';

    EL.modalContainer.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content anim-fade-in space-y-4">
                ${summaryHTML}
                <h3 class="text-xl font-bold text-center" style="color: var(--accent);">${title}</h3>
                <div class="space-y-2">${rowsHTML}</div>
                <div class="flex flex-col gap-3 mt-4">
                    <button id="play-again-btn" class="accent-button w-full py-3 px-6">Play Again</button>
                    <button id="close-lb-btn" class="ghost-button w-full">Back to Menu</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('play-again-btn').addEventListener('click', () => {
        EL.modalContainer.innerHTML = '';
        resetFullGame();
    });

    document.getElementById('close-lb-btn').addEventListener('click', () => {
        EL.modalContainer.innerHTML = '';
        if (isEndGame) {
            resetFullGame();
        }
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Game Initialization ──────────────────────────────────────
function resetFullGame() {
    score = 0;
    round = 0;
    streak = 0;
    bestStreak = 0;
    hintsUsed = 0;
    hintLevel = 0;
    missedAnswers = [];
    currentAnswer = null;
    roundActive = false;
    audioEnded = false;

    EL.score.textContent = '0';
    EL.round.textContent = '0/5';
    EL.streak.textContent = '0';
    stopAudio();
    clearInterval(timerInterval);

    showScreen('setup-screen');
}

function initGame() {
    playerName = (EL.playerNameInput.value || '').trim() || 'Anonymous';

    const activeData = getActiveData();
    let pool = activeData;
    if (selectedGenre !== 'all') {
        pool = activeData.filter(d => d.sample.genre === selectedGenre);
    }

    const roundCount = Math.min(ROUNDS_PER_GAME, pool.length);
    if (roundCount === 0) {
        setMessage('No songs available for this genre.', 'status-info');
        return;
    }

    availableSongs = shuffle(pool).slice(0, roundCount);
    totalRounds = availableSongs.length;

    score = 0;
    round = 0;
    streak = 0;
    bestStreak = 0;
    hintsUsed = 0;
    missedAnswers = [];
    EL.score.textContent = '0';
    EL.round.textContent = `0/${totalRounds}`;
    EL.streak.textContent = '0';

    showScreen('game-screen');
    startRound();
}

// ─── Build Genre Filter Chips ─────────────────────────────────
function buildGenreChips() {
    const activeData = getActiveData();
    const genres = [...new Set(activeData.map(d => d.sample.genre))].sort();
    const allCount = activeData.length;
    let html = `<button class="option-chip selected" data-genre="all">All (${allCount})</button>`;

    genres.forEach(genre => {
        const count = activeData.filter(d => d.sample.genre === genre).length;
        html += `<button class="option-chip" data-genre="${genre}">${genre} (${count})</button>`;
    });

    EL.genreSelect.innerHTML = html;
    selectedGenre = 'all';
}

buildGenreChips();

// ─── Setup Screen Event Listeners ─────────────────────────────
EL.difficultySelect.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-difficulty]');
    if (!chip) return;
    EL.difficultySelect.querySelectorAll('.option-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedDifficulty = chip.dataset.difficulty;
    buildGenreChips();
});

EL.genreSelect.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-genre]');
    if (!chip) return;
    EL.genreSelect.querySelectorAll('.option-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    selectedGenre = chip.dataset.genre;
});

EL.startGameButton.addEventListener('click', initGame);
EL.showLeaderboard.addEventListener('click', () => showLeaderboardModal(false));

// ─── Game Screen Event Listeners ──────────────────────────────
EL.playButton.addEventListener('click', () => {
    // If round is active and audio ended, replay the audio
    if (roundActive && audioEnded) {
        audioPlayer.currentTime = 0;
        playAudio();
        audioEnded = false;
        EL.playButton.disabled = true;
        EL.buttonText.textContent = 'PLAYING...';
        startPlaybackTracker();
        return;
    }
    // Otherwise start next round
    startRound();
});

EL.submitButton.addEventListener('click', submitGuess);
EL.hintButton.addEventListener('click', giveHint);
EL.skipButton.addEventListener('click', skipRound);

// Enter in title → focus artist; Enter in artist → submit
EL.guessTitleInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        EL.guessArtistInput.focus();
    }
});

EL.guessArtistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !EL.submitButton.disabled) {
        e.preventDefault();
        submitGuess();
    }
});

// Close modals on overlay click
EL.modalContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        EL.modalContainer.innerHTML = '';
    }
});
