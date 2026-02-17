# Grace's Sample Hunter

A music sampling guessing game that tests your knowledge of hip-hop production history. Listen to a classic song and guess which modern track sampled it.

Built to celebrate the art of sampling — the creative practice of reusing portions of older recordings in new songs — through an interactive, timed quiz format.

<!-- Add a screenshot or GIF demo here -->
<!-- ![Grace's Sample Hunter screenshot](screenshot.png) -->

## How It Works

1. **Start** — Click "START GAME" to begin a round
2. **Listen** — A 30-second preview of a classic/original song plays automatically
3. **Guess** — Type the name of the modern song or artist that sampled it
4. **Score** — Correct guesses earn a point; incorrect guesses or timeouts reveal the answer
5. **Hear the answer** — The sampled (modern) track plays so you can hear the connection
6. **Repeat** — Click "NEXT ROUND" to continue through the full song pool
7. **Game Over** — Once all songs are exhausted, your final score is displayed

You can guess by entering either the **song title** or the **artist name** — matching is case-insensitive and ignores punctuation.

## Tech Stack

- **HTML5** — Semantic markup and structure
- **CSS3 / Tailwind CSS** — Dark theme with glassmorphism effects, responsive layout
- **JavaScript (ES6 Modules)** — Game logic, state management, DOM manipulation
- **iTunes Search API** — Fetches 30-second audio previews in real time
- **Web Audio API** — HTML5 `Audio` element for playback

No frameworks, no build tools — runs as a static site served from any HTTP server.

## Getting Started

1. Clone or download the repository

2. Serve the project with any static HTTP server:
   ```bash
   # Python (built-in)
   cd graceSample
   python3 -m http.server 8000

   # Or Node.js (npx)
   npx serve .
   ```

3. Open `http://localhost:8000` in a modern browser

**Requirements:**
- A modern browser with ES6 module support (Chrome, Firefox, Safari, Edge)
- Internet connection (audio previews are fetched from the iTunes API)

## Project Structure

```
graceSample/
├── index.html        # Main page — UI markup and all CSS styles
├── app.js            # Game logic — state, timer, API calls, guess matching
├── samples.json      # Small dataset (9 sample pairs, Kanye West focused)
├── extra.json        # Extended dataset (~50 pairs: Kanye, J. Cole, Drake)
├── test.json         # Full dataset (~70 pairs: Kanye, J. Cole, Drake, and more)
├── notes.json        # Example iTunes API response (reference)
├── favicon.png       # Site icon
├── favicon2.png      # Alternate icon
└── README.md         # This file
```

## Game Data Format

Sample pairs are stored as JSON arrays. Each entry maps an original song to the modern track that sampled it:

```json
{
  "sample": {
    "artist": "Daft Punk",
    "title": "Harder, Better, Faster, Stronger"
  },
  "sampled": {
    "artist": "Kanye West",
    "title": "Stronger"
  }
}
```

- `sample` — the original/classic track that gets played for the user
- `sampled` — the modern track the user needs to guess

To add new entries, append objects in this format to the active JSON data file.

## Current Features

- 30-second timed rounds with animated progress bar
- Normalized string matching (case-insensitive, punctuation-stripped)
- Accept either song title or artist name as a valid guess
- Score and round tracking
- Audio preview of the correct answer after each guess
- Random song selection with no repeats within a session
- Responsive dark UI with golden accent theme
- Keyboard support (Enter to submit)

## Roadmap

See [planning.md](planning.md) for a prioritized list of proposed improvements, organized into:

- **Tier 1** — Bug fixes and production polish
- **Tier 2** — UX enhancements (artwork, hints, animations, difficulty modes)
- **Tier 3** — Stretch goals (leaderboards, multiplayer, PWA support)
