# 🎮 EduArcade: Learning Pac-Man

**An AI-powered adaptive learning engine that turns mistake-driven retrieval practice into an arcade game.**

A student searches for any topic and gets a short AI-generated lesson, broken into four key concepts. They then practise those concepts by playing Pac-Man. When a ghost catches Pac-Man, the student answers a question. Questions are pitched to how well the student knows each concept: easier while they're learning it, harder once they've shown they understand it.

Every answer is recorded per concept. The app tracks mastery over time and explains mistakes. **My Progress** and a **Learning Report** after each game show how the student's understanding is changing.

The interface looks like a dark-mode Google search results page. Gemini is used for lessons, questions, explanations and grading.

---

## Contents

- [How it works](#how-it-works)
- [Gameplay rules](#gameplay-rules)
- [Adaptive questions](#adaptive-questions)
- [Progress tracking](#progress-tracking)
- [Security](#security)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [API routes](#api-routes)
- [Database](#database)
- [Known limitations](#known-limitations)
- [Changelog](#changelog)

---

## How it works

```text
Sign in (avatar, top right)
      ↓
Search a topic, e.g. "python" or "photosynthesis"
      ↓
All tab: AI Overview, lesson, and a Learning Map of 4 concepts
      ↓
Game tab (unlocked after a search) → Play
      ↓
Pac-Man: a ghost catches you → answer a question at your level
      ↓
Clear the maze → the Boss Ghost appears → free-response challenge
      ↓
Learning Report → My Progress
```

1. **Sign in.** Use an email and password. A new email creates an account.
2. **Search.** The first search for a topic makes Gemini generate a *learning package*, which is saved and reused for everyone. The package contains:
   - a short explanation and lesson;
   - a map of 4 concepts in prerequisite order, each with a difficulty and learning objective;
   - 5 questions.

   Searches worded differently ("loops in python") are matched to an existing topic, so they don't cost a new generation.
3. **Learning Map.** Shows the 4 concepts in the order to learn them, their prerequisites, and the student's current mastery of each.
4. **Game tab.** An "EduArcade Games" page with a Pac-Man card and a **Play** button. It stays disabled until a search succeeds.
5. **My Progress.** Available at any time from the account menu, even before a first search. With no activity yet it says "No learning activity yet".

---

## Gameplay rules

| Event | What happens |
|---|---|
| Arrow keys / WASD | Move. A turn pressed slightly early is remembered and taken at the next opening. |
| White pellet | +10 points |
| Power Pellet (4 corners) | +50 points. Ghosts turn blue and flee for 8 seconds, flashing back to their normal colours as a warning before recovering. |
| Eat a blue ghost | 200 / 400 / 800 / 1600 points. It becomes eyes that return to the cage and respawn. **No question.** |
| A dangerous ghost catches Pac-Man | Lose a life, and the game pauses for a **question** (see below). |
| Correct answer | That ghost leaves the board, and play resumes. |
| Wrong answer | "Not quite" appears at once, then an AI explanation of the concept, then a **new follow-up question** on the same concept. |
| Last white pellet eaten | The **Boss Ghost** (red, with a crown) appears and the white pellets reset. The maze layout and power pellets stay as they are. |
| Boss catches Pac-Man | A **free-response transfer question**: apply the concepts to something new, in your own words. Gemini grades it. A wrong answer is explained, then the same question is retried. |
| Boss answered correctly | The game ends and shows the **Learning Report**. |
| Maze cleared again while the Boss is out | "Maze Cleared!" popup: **Play Again** starts a new game immediately; **View My Progress** opens the dashboard. |
| Out of lives | "Game Over" popup: **View My Progress**, or **Continue Playing** after a **3-question checkpoint** (below). |
| × button | Leave the game at any time and return to the lesson. |

**Game Over checkpoint.** To continue, the student answers 3 questions correctly.
- The questions target the student's **3 lowest-mastery concepts**, one question per concept.
- Each question is at that concept's adaptive difficulty, and none has already been asked in this game.
- Gemini writes new questions if needed.
- Afterwards the game continues where it stopped: same session, eaten pellets stay eaten, and lives reset to 3.

---

## Adaptive questions

Question difficulty adapts to each student, concept by concept. It uses the existing student model and does not keep a second mastery system.

### Difficulty levels

| Level | Type | What it asks |
|---|---|---|
| 1 | basic | Recognition, definitions, simple understanding |
| 2 | conceptual / procedural | Explain how something works, or carry out a straightforward procedure |
| 3 | application | Apply the concept to a new situation or problem |
| 4 | transfer | Deeper reasoning in an unfamiliar context |

### How the next difficulty is chosen (`mastery.next_difficulty`)

- **Mastery sets the band** (`mastery.level`):
  - under 40% → level 1
  - under 70% → level 2
  - under 90% → level 3
  - 90% and above → level 4
- **The level climbs one step at a time.** The next question is never more than one level above the hardest one the student has answered correctly.
- **After a miss, the next question is one level easier.** For a student with a strong history, it never drops more than one level below their hardest solved level.
- **The level doesn't rise while the student is getting help or struggling:** not right after an explanation, and not while accuracy over the last 5 answers on the concept is below 50% (`RECENT_STRUGGLE_BELOW`).

### Example progressions

| Student | Questions asked |
|---|---|
| New student, answering correctly each time | 1 → 2 → 2 → 3 → 3 → 4 |
| Keeps missing | Stays at 1 |
| Strong student (solved level 4) misses once | 3, then back up to 4 |

### Where adaptive questions are used

- **Ghost questions.** Four per game, one per concept in Learning Map order.
- **Follow-up questions** after a wrong answer.
- **Checkpoint questions** after Game Over.
- The Boss always asks the package's transfer question.

### How a question is chosen

- A saved question at the target level that this student hasn't answered yet is used first.
- Otherwise Gemini writes one. The prompt includes:
  - the four level definitions;
  - a summary of the student's evidence (mastery %, answer counts, recent accuracy, last answer), with no personal data;
  - a rule that harder questions must go deeper into the same concept, not bring in unrelated topics.
- Generated questions are validated (exactly 4 distinct options, answer among them, correct concept, question type matching the requested level) and saved for other students to reuse.

### Speed

- **Play starts instantly** when the first ghost's question is already saved. Any missing questions for the other ghosts are written in the background and swapped in before those ghosts ask them.
- If the first question has to be written, the maze is drawn straight away while Gemini writes it, which takes about 3–5 seconds.
- **Wrong answers:** "Not quite" appears instantly. The explanation and the follow-up question are generated side by side, taking about 3 seconds.

**Option order.** The four options are shuffled on the server, once per question per game, so the correct answer can appear in any position.

---

## Progress tracking

- **Mastery** (`mastery.py`) is an Elo-style estimate per student and concept, on a 0–1 scale.
  - Every student starts each concept at 30%.
  - Surprising answers move it more: a hard question answered correctly, or an easy one missed.
  - Answers given right after an explanation count at 60% weight.
- **Every answer is stored** with mastery before and after, difficulty, whether it was correct, and whether help came just before it.
- **Learning Report** (after each game):
  - accuracy;
  - questions answered;
  - learning gain;
  - each concept's mastery before and after;
  - a recommended concept to review.
- **My Progress:**
  - every topic practised, with overall mastery;
  - concepts practised;
  - "Struggling with": practised concepts under 50% that were missed recently;
  - per-concept detail.

---

## Security

- **Answers never reach the browser.** Every answer is checked on the server. The Boss's reference answer is used only for Gemini grading.
- **Each game belongs to its player.** The server checks ownership on every request, and a lock per game prevents double-grading.
- **Passwords** are stored as salted hashes (Werkzeug).
- **Sessions** are signed cookies. The signing key comes from `FLASK_SECRET_KEY`, or is generated once into `instance/secret_key`.
- **Gemini receives no personal data** (no email or user ID), only learning statistics about the concept.

---

## Getting started

**Requirements:** Python 3 (tested with 3.13 and 3.14) and a Gemini API key.

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Add your Gemini API key** to a `.env` file in the project folder:
   ```text
   GEMINI_API_KEY=your-key-here
   ```
3. **Create the database and start the server:**
   ```bash
   python app.py
   ```
   Open **http://127.0.0.1:5000**.

**If you prefer `flask run`**, run `python app.py` once first: that creates `database.db` from `schema.sql`. Then:

```bash
flask --app app run --debug --port 5001
```

> **macOS tip:** if the page doesn't load on port 5000, AirPlay Receiver may be using that port. Use `http://127.0.0.1:5000` rather than `localhost`, turn off AirPlay Receiver in System Settings → General → AirDrop & Handoff, or use port 5001.

Games in progress are held in server memory. Restarting the server, including the debug server's auto-reload when a Python file is saved, ends any game in progress. Answers already given are safe in the database.

---

## Project structure

| Path | Purpose |
|---|---|
| `app.py` | Flask routes, game state, adaptive question selection, grading flow |
| `gemini_api.py` | All Gemini calls and validation: learning package, topic matching, explanations, adaptive questions, free-response grading |
| `packages.py` | Find or create a topic, save and load packages and questions |
| `student_model.py` | Records answers; reads mastery, struggles, progress, session gain and adaptive difficulty |
| `mastery.py` | Mastery formula, difficulty bands and the adaptive difficulty rule |
| `db.py`, `schema.sql` | SQLite connection and schema |
| `templates/index.html` | The single-page UI: search, lesson, Game tab, game, popups, report, My Progress |
| `static/game.js` | Frontend logic: search, Pac-Man (canvas), questions, checkpoint, Boss, report, dashboard |
| `static/style.css` | Styles (dark palette) |
| `static/*.png`, `static/pacman-game-icon.jpg` | Sprites and the Game tab artwork |

The following are not used by the running app:
- `static/pacman.js`, `static/pacmanindex.html`, `static/pacman.css`: the original standalone Pac-Man game.
- `static/pacman-game-icon.png`: an older version of the Game tab artwork.
- `figmagoogle/` and the root `index.html`: design mockups.
- `Project-1/`: an older copy of `gemini_api.py`.

---

## API routes

All routes except `/`, `/login`, `/logout` and `/me` require a signed-in session.

| Route | Purpose |
|---|---|
| `GET /` | The app |
| `POST /login`, `POST /logout`, `GET /me` | Sign in (creates the account if new), sign out, current user |
| `POST /generate-lesson` | Find or create the topic's package; returns the lesson and Learning Map |
| `POST /start-game` | New game with adaptive ghost questions; returns the first question |
| `POST /check-answer` | Grade an answer on the server, record it, update mastery |
| `POST /remediation` | Explanation plus adaptive follow-up for the answer just marked wrong |
| `POST /checkpoint/start` | 3 questions on the student's lowest concepts after Game Over |
| `POST /boss/start` | Move the game on to its Boss question when the maze is cleared |
| `GET /learning-report/<game_id>` | Per-game report |
| `GET /my-progress` | Dashboard data across all topics |

---

## Database

SQLite (`database.db`, created from `schema.sql`).

| Table | Holds |
|---|---|
| `users` | Email and password hash |
| `topics` | Title, explanation and lesson per topic |
| `concepts` | The 4 concepts per topic: difficulty, prerequisites, position |
| `questions` | Package questions and generated ones (`source` = `package` / `remediation`), each with type and difficulty 1–4 |
| `attempts` | Every answer: correct or not, difficulty, assisted, mastery before and after, game ID |
| `concept_mastery` | Current mastery per student and concept, with attempts, correct count and hardest level solved |
| `student_misconceptions` | Reserved for a future feature; not populated or shown in the UI |

---

## Known limitations

- **Games in progress are lost on a server restart.** They're held in memory (see Getting started).
- **The first Play at a new level can take 3–5 seconds**, while Gemini writes that question. After that it's saved.
- **`/boss/start` trusts the browser.** It can't verify that the maze was really cleared. At most, a student could skip to the Boss question; answers are never exposed.
- **Clearing the maze early skips questions.** Ghost questions not yet asked are skipped when the Boss arrives, so the Learning Report shows fewer answers for that game.

---

## Changelog

### Game and interface
- Black arcade backdrop, centred board, and an × exit button that works during questions, popups and the Boss.
- Classic Pac-Man rules:
  - responsive controls with input buffering;
  - tunnel on row 9, with ghosts kept inside the maze;
  - chase and flee ghost AI with frightened warning flashes;
  - eaten ghosts return to the cage as eyes;
  - lives and a READY! pause.
- Reversed trigger: a ghost catching Pac-Man costs a life and opens a question; eating blue ghosts gives points only.
- Game Over popup with My Progress, or Continue Playing via the 3-question checkpoint. Eaten pellets persist.
- The Boss now appears when the last white pellet is eaten (it used to appear after all four ghosts), and the white pellets reset for the Boss phase.
- Maze Cleared popup: Play Again (no checkpoint) or View My Progress.
- Game tab redesigned as a game launcher, and locked until a successful search.
- My Progress added to the account menu, with an empty state.
- Game instructions updated to match the mechanics.
- Unfinished "Likely misconception" labels removed from the UI.
- Branding changed to **EduArcade**.

### Learning engine
- Wrong answers: the verdict is instant, the explanation loads alongside, and a new adaptive follow-up question is on the same concept (the Boss retries its own question).
- Adaptive difficulty for ghost, follow-up and checkpoint questions, with level definitions in the Gemini prompt and type-to-level validation.
- The checkpoint targets the student's 3 lowest-mastery concepts, with questions never repeated within a game.
- The correct option's position is shuffled on the server.
- Play starts instantly: missing adaptive questions are written in the background, and the maze is drawn while the first question loads.
- Faster search:
  - topic lookups are cached;
  - topic matching uses a low-thinking Gemini setting.
