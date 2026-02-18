# Sampleology

A music sampling guessing game that tests your knowledge of (primarily hip-hop) production history. Listen to a classic song and guess which modern track sampled it.

I built this because sampling is sweet and should be more appreciated.


## How It Works

1. **Start** — Enter name, select difficult and genre and hit start game
2. **Listen** — A preview of a classic/original song plays automatically
3. **Guess** — Type the name of the modern song and artist that sampled it
4. **Score** — Correct guesses earn a point, with penalties if you use hints
5. **Hear the answer** — The later track that samples the original plays so you can hear the connection
6. **Repeat** — Click "NEXT ROUND" to continue through the song pool until the game ends

You can by entering both the **song title** or the **artist name** — matching is case-insensitive and ignores punctuation.

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
   cd sampleology
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
├── data.json         # Large dataset
├── easy_data.json    # Limited dataset with easier pairings
├── notes.json        # Example iTunes API response (reference)
├── favicon.png       # Site icon
└── README.md         # This file
```

## Game Data Format

Sample pairs are stored as JSON arrays. Each entry maps an original song to the modern track that sampled it:

```json
[
  {
        "sample": { "artist": "Daft Punk", "title": "Harder, Better, Faster, Stronger", "genre": "Electronic" },
        "sampled": { "artist": "Kanye West", "title": "Stronger", "genre": "Hip-Hop" }
  },
  {
        "sample": { "artist": "Dionne Warwick", "title": "Walk on By", "genre": "Soul" },
        "sampled": { "artist": "Doja Cat", "title": "Paint the Town Red", "genre": "Hip-Hop"}
  },
]
```

- `sample` — the original/classic track that gets played for the user
- `sampled` — the modern track the user needs to guess

To add new entries, append objects in this format to the active JSON data file.



