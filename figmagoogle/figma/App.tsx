import { FormEvent, useEffect, useMemo, useState } from "react";

type Game = {
  title: string;
  year: string;
  genre: string;
  color: string;
  mark: string;
};

const games: Game[] = [
  { title: "PAC-MAN", year: "1980", genre: "MAZE", color: "yellow", mark: "pacman" },
  { title: "GALAGA", year: "1981", genre: "SHOOTER", color: "cyan", mark: "ship" },
  { title: "TETRIS", year: "1984", genre: "PUZZLE", color: "pink", mark: "blocks" },
  { title: "FROGGER", year: "1981", genre: "ACTION", color: "green", mark: "frog" },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.8-4.2 3.3-6.3 7.5-6.3s6.7 2.1 7.5 6.3" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" | "up" | "down" }) {
  const rotations = { left: 0, up: 90, right: 180, down: 270 };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${rotations[direction]}deg)` }}
    >
      <path d="m14.5 5-7 7 7 7" />
    </svg>
  );
}

function GameMark({ type }: { type: string }) {
  if (type === "pacman") {
    return (
      <span className="pac-mark" aria-hidden="true">
        <span />
      </span>
    );
  }
  if (type === "ship") {
    return (
      <svg className="game-mark-svg" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 5 38 39 24 33 10 39Z" />
        <path d="m17 29 7-16 7 16-7-3Z" className="mark-cut" />
      </svg>
    );
  }
  if (type === "blocks") {
    return (
      <span className="block-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    );
  }
  return (
    <svg className="game-mark-svg frog-mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="14" cy="15" r="7" />
      <circle cx="34" cy="15" r="7" />
      <path d="M8 22c3 18 29 18 32 0L24 16Z" />
      <circle className="mark-cut" cx="14" cy="14" r="2" />
      <circle className="mark-cut" cx="34" cy="14" r="2" />
    </svg>
  );
}

function GameCard({
  game,
  active,
  onSelect,
}: {
  game: Game;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`game-card game-${game.color} ${active ? "active" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className="game-art">
        <GameMark type={game.mark} />
        {active && <span className="now-playing">NOW PLAYING</span>}
      </span>
      <span className="game-card-copy">
        <strong>{game.title}</strong>
        <span>
          {game.year} · {game.genre}
        </span>
      </span>
      <span className="card-arrow">↗</span>
    </button>
  );
}

function Ghost({ className }: { className: string }) {
  return (
    <g className={className}>
      <path d="M0 12C0 5.4 5.4 0 12 0s12 5.4 12 12v14l-4-4-4 4-4-4-4 4-4-4-4 4Z" />
      <circle cx="8" cy="10" r="3.2" className="ghost-eye" />
      <circle cx="17" cy="10" r="3.2" className="ghost-eye" />
      <circle cx="9" cy="10" r="1.3" className="ghost-pupil" />
      <circle cx="18" cy="10" r="1.3" className="ghost-pupil" />
    </g>
  );
}

function Maze({ player }: { player: { x: number; y: number } }) {
  const dots = useMemo(() => {
    const rows = [36, 70, 104, 138, 206, 240, 274, 308];
    const cols = [34, 68, 102, 136, 170, 204, 238, 272, 306, 340, 374, 408, 442, 476, 510, 544];
    return rows.flatMap((y) => cols.map((x) => ({ x, y })));
  }, []);

  return (
    <svg className="maze" viewBox="0 0 578 344" role="img" aria-label="Pac-Man maze">
      <rect className="maze-wall" x="5" y="5" width="568" height="334" rx="12" />
      <path className="maze-wall" d="M54 54h100v34H88v48H54Zm370 0h100v82h-34V88h-66ZM54 290h100v-34H88v-48H54Zm370 0h100v-82h-34v48h-66ZM204 54h58v82h-34V88h-24Zm112 0h58v34h-24v48h-34ZM126 170h100m126 0h100M204 208h170v82h-40v-46h-90v46h-40Z" />
      <path className="ghost-house" d="M252 150h74v52h-74Z" />
      {dots.map((dot) => (
        <circle key={`${dot.x}-${dot.y}`} className="maze-dot" cx={dot.x} cy={dot.y} r="3" />
      ))}
      <circle className="power-dot" cx="34" cy="308" r="7" />
      <circle className="power-dot" cx="544" cy="308" r="7" />
      <g transform="translate(269 163)">
        <Ghost className="ghost ghost-pink" />
      </g>
      <g transform="translate(300 163)">
        <Ghost className="ghost ghost-cyan" />
      </g>
      <g className="maze-pacman" transform={`translate(${player.x} ${player.y})`}>
        <path d="M18 0A18 18 0 1 0 18 36A18 18 0 0 0 32 7L18 18Z" />
      </g>
      <text x="289" y="329" textAnchor="middle" className="ready-text">
        READY!
      </text>
    </svg>
  );
}

function PacmanCabinet() {
  const [player, setPlayer] = useState({ x: 67, y: 187 });
  const [score, setScore] = useState(2840);

  const move = (direction: "left" | "right" | "up" | "down") => {
    setPlayer((current) => {
      const step = 17;
      const next = { ...current };
      if (direction === "left") next.x = Math.max(20, current.x - step);
      if (direction === "right") next.x = Math.min(540, current.x + step);
      if (direction === "up") next.y = Math.max(20, current.y - step);
      if (direction === "down") next.y = Math.min(300, current.y + step);
      return next;
    });
    setScore((current) => current + 10);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const keys = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      } as const;
      const direction = keys[event.key as keyof typeof keys];
      if (direction) {
        event.preventDefault();
        move(direction);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section className="cabinet-section" aria-labelledby="cabinet-title">
      <div className="cabinet-topline">
        <div>
          <span className="eyebrow">CABINET 01 / MAZE</span>
          <h2 id="cabinet-title">PAC-MAN</h2>
        </div>
        <div className="cabinet-status">
          <span className="live-dot" />
          1 PLAYER
        </div>
      </div>

      <div className="cabinet">
        <div className="cabinet-speaker" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <i key={index} />
          ))}
        </div>
        <div className="screen-bezel">
          <div className="screen">
            <div className="score-row">
              <span>1UP</span>
              <strong>{score.toString().padStart(6, "0")}</strong>
              <span>HIGH SCORE</span>
              <strong>010240</strong>
            </div>
            <Maze player={player} />
          </div>
        </div>
        <div className="control-deck">
          <div className="deck-label">
            <span>MOVE</span>
            <small>ARROW KEYS</small>
          </div>
          <div className="dpad" aria-label="Pac-Man movement controls">
            <button aria-label="Move up" onClick={() => move("up")}><ArrowIcon direction="up" /></button>
            <button aria-label="Move left" onClick={() => move("left")}><ArrowIcon direction="left" /></button>
            <span className="dpad-center" />
            <button aria-label="Move right" onClick={() => move("right")}><ArrowIcon direction="right" /></button>
            <button aria-label="Move down" onClick={() => move("down")}><ArrowIcon direction="down" /></button>
          </div>
          <button className="start-button" onClick={() => { setPlayer({ x: 67, y: 187 }); setScore(0); }}>
            <span />
            NEW GAME
          </button>
        </div>
      </div>
      <p className="keyboard-tip">USE ARROW KEYS OR THE CONTROL PAD TO MOVE</p>
    </section>
  );
}

function Header({
  onHome,
  onLogin,
}: {
  onHome: () => void;
  onLogin: () => void;
}) {
  return (
    <header className="site-header">
      <button className="brand" onClick={onHome} aria-label="Insert Coin home">
        <span className="brand-puck" />
        <span>INSERT COIN</span>
      </button>
      <div className="header-actions">
        <div className="header-meta">
          <span>EST. 1980</span>
          <span className="online"><i /> ONLINE</span>
        </div>
        <button className="login-trigger" onClick={onLogin} aria-label="Log in to your account">
          <AccountIcon />
          <span>LOG IN</span>
        </button>
      </div>
    </header>
  );
}

function LoginPanel({ onClose }: { onClose: () => void }) {
  const [signedIn, setSignedIn] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSignedIn(true);
  };

  return (
    <div className="login-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="login-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="login-close" onClick={onClose} aria-label="Close log in panel">×</button>
        {signedIn ? (
          <div className="login-success">
            <span className="eyebrow">PLAYER READY</span>
            <h2 id="login-title">WELCOME BACK.</h2>
            <p>Your player profile is ready for the next high score.</p>
            <button onClick={onClose}>ENTER ARCADE</button>
          </div>
        ) : (
          <>
            <span className="eyebrow">PLAYER ONE</span>
            <h2 id="login-title">LOG IN</h2>
            <p>Save scores, favorites, and your place on the leaderboard.</p>
            <form onSubmit={submit}>
              <label>
                EMAIL
                <input type="email" placeholder="player@arcade.com" required autoFocus />
              </label>
              <label>
                PASSWORD
                <input type="password" placeholder="••••••••" required />
              </label>
              <button type="submit">INSERT COIN / LOG IN</button>
            </form>
            <button className="create-account">NEW PLAYER? CREATE AN ACCOUNT</button>
          </>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [activeGame, setActiveGame] = useState("PAC-MAN");
  const [page, setPage] = useState(() => window.location.hash === "#pacman" ? "pacman" : "home");
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const syncPage = () => setPage(window.location.hash === "#pacman" ? "pacman" : "home");
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  const filteredGames = games.filter((game) =>
    `${game.title} ${game.genre} ${game.year}`.toLowerCase().includes(submittedQuery.toLowerCase()),
  );

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  const goHome = () => {
    if (window.location.hash) {
      window.location.hash = "";
    } else {
      setPage("home");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const openGame = (game: Game) => {
    setActiveGame(game.title);
    if (game.title === "PAC-MAN") {
      window.location.hash = "pacman";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <main className="arcade-shell">
      <div className="scanlines" aria-hidden="true" />
      <Header onHome={goHome} onLogin={() => setLoginOpen(true)} />

      {page === "home" ? (
        <>
        <section className="hero" aria-labelledby="hero-title">
        <div className="hero-kicker"><span>●</span> THE CLASSICS NEVER QUIT</div>
        <h1 id="hero-title">FIND YOUR<br /><em>NEXT OBSESSION.</em></h1>
        <p>Search the archives. Pick your cabinet. Beat the high score.</p>
        <form className="search" onSubmit={submitSearch}>
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games, genres, years..."
            aria-label="Search the arcade"
          />
          <button type="submit">SEARCH <span>↵</span></button>
        </form>
        <div className="quick-search">
          <span>TRY:</span>
          {["MAZE", "SPACE", "PUZZLE", "1980s"].map((term) => (
            <button key={term} onClick={() => { setQuery(term); setSubmittedQuery(term); }}>{term}</button>
          ))}
        </div>
        </section>

        <section className="library" aria-labelledby="library-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SELECT A CABINET</span>
            <h2 id="library-title">ARCADE FLOOR</h2>
          </div>
          <span>{filteredGames.length.toString().padStart(2, "0")} GAMES</span>
        </div>
        <div className="game-grid">
          {filteredGames.map((game) => (
            <GameCard
              game={game}
              active={activeGame === game.title}
              onSelect={() => openGame(game)}
              key={game.title}
            />
          ))}
          {filteredGames.length === 0 && (
            <div className="no-results">
              <span>NO SIGNAL</span>
              <p>No cabinets match “{submittedQuery}”. Try another frequency.</p>
              <button onClick={() => { setQuery(""); setSubmittedQuery(""); }}>RESET SEARCH</button>
            </div>
          )}
        </div>
        </section>
        </>
      ) : (
        <div className="game-page">
          <button className="back-to-floor" onClick={goHome}>
            <ArrowIcon direction="left" />
            BACK TO ARCADE FLOOR
          </button>
          <div className="game-page-intro">
            <span className="eyebrow">NOW PLAYING / CABINET 01</span>
            <h1>READY, PLAYER ONE?</h1>
            <p>Clear the maze, dodge the ghosts, and chase the high score.</p>
          </div>
          <PacmanCabinet />
        </div>
      )}

      <footer>
        <span>© 2025 INSERT COIN ARCADE</span>
        <span>PLAY FOREVER / STAY CURIOUS</span>
      </footer>
      {loginOpen && <LoginPanel onClose={() => setLoginOpen(false)} />}
    </main>
  );
}
