let board;
let context;

const rowCount = 21;
const columnCount = 19;
const tileSize = 32;

const boardWidth = columnCount * tileSize;
const boardHeight = rowCount * tileSize;


// ============================================================
// IMAGES
// ============================================================

let blueGhostImage;
let orangeGhostImage;
let pinkGhostImage;
let redGhostImage;

let pacmanUpImage;
let pacmanDownImage;
let pacmanLeftImage;
let pacmanRightImage;

let wallImage;


// ============================================================
// PAC-MAN MAP
// ============================================================

// X = wall
// O = empty space / tunnel
// P = Pac-Man
// ' ' = food
//
// Ghosts:
// b = blue
// o = orange
// p = pink
// r = red

const tileMap = [

    "XXXXXXXXXXXXXXXXXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X                 X",
    "X XX X XXXXX X XX X",
    "X    X       X    X",
    "XXXX XXXX XXXX XXXX",
    "OOOX X       X XOOO",
    "XXXX X XXrXX X XXXX",
    "O       bpo       O",
    "XXXX X XXXXX X XXXX",
    "OOOX X       X XOOO",
    "XXXX X XXXXX X XXXX",
    "X        X        X",
    "X XX XXX X XXX XX X",
    "X  X     P     X  X",
    "XX X X XXXXX X X XX",
    "X    X   X   X    X",
    "X XXXXXX X XXXXXX X",
    "X                 X",
    "XXXXXXXXXXXXXXXXXXX"

];


// ============================================================
// GAME OBJECTS
// ============================================================

const walls = new Set();
const foods = new Set();
const ghosts = new Set();

let pacman;


// ============================================================
// GAME STATE
// ============================================================

const directions = ["U", "D", "L", "R"];

let score = 0;
let lives = 3;

let gameStarted = false;
let gameOver = false;

let questionActive = false;

let currentQuestion = null;
let currentGhost = null;

// True while an answer is being sent, so a second click can't
// submit the same question again.
let answerInFlight = false;

// The pending setTimeout for the next update() frame, so the loop
// can be stopped completely when the student exits the game.
let gameLoopTimeout = null;

// Bumped every time a game starts or is exited. A request that
// comes back after the student left (e.g. /start-game or
// /check-answer still in flight) sees a different number and
// does nothing, so it can't restart a game they already closed.
let gameSession = 0;

// Original instructions text, restored after a Boss Ghost game is exited.
let defaultInstructionsText = "";

// The Boss Ghost appears at the red ghost's starting tile, just
// outside the ghost house, once the four regular ghosts are beaten.
const BOSS_SPAWN_TILE = "r";

let topic = "";
let topicId = null;
let gameId = null;


// ============================================================
// CLASSIC PAC-MAN RULES
// ============================================================
//
// All timers count frames of the existing update() loop (50 ms
// each), so they pause automatically while a question is open.

// [row, column] of the four power pellets, near the maze corners.
const POWER_PELLET_TILES = [[3, 1], [3, 17], [17, 1], [17, 17]];

const powerPellets = new Set();

const PELLET_POINTS = 10;
const POWER_PELLET_POINTS = 50;

// 8 seconds of frightened (blue) ghosts; they blink for the last 2.
const FRIGHTENED_FRAMES = 160;
const FRIGHTENED_BLINK_FRAMES = 40;

let frightenedFrames = 0;

// Ghosts eaten during the current power pellet: 200, 400, 800, 1600.
let ghostsEatenThisPellet = 0;

// Short "READY!" pause after losing a life or continuing.
const READY_FRAMES = 20;

let readyFrames = 0;

// True after the last life is lost, until the player continues.
let outOfLives = false;

// Every white pellet eaten: the Maze Cleared popup is showing.
let mazeCleared = false;

let scaredGhostImage;


// ============================================================
// INITIALIZATION
// ============================================================

window.addEventListener("DOMContentLoaded", function () {
    loadUser();
    setupLoginButton();
    setupStartButton();
    setupQuizButton();
    setupRestartButton();
    setupRetryButton();
    setupDashboardButton();
    setupReportButtons();
    setupExitButton();
    setupGameOverButtons();
    setupMazeClearedButtons();
});

// ============================================================
// USER LOGIN
// ============================================================

// Who is signed in comes from the server's session cookie (/me);
// the browser never stores or sends a user id.
let userEmail = null;


function setupLoginButton() {

    const loginButton =
        document.getElementById("login-button");

    loginButton.addEventListener(
        "click",
        loginUser
    );

}

async function loadUser() {
    try {
        const response = await fetch("/me");
        setUserEmail(response.ok ? (await response.json()).email : null);
    } catch (err) {
        setUserEmail(null);
    }
}

function setUserEmail(email) {
    userEmail = email;

    // Signed in: the Game tab can be opened (Play still needs a topic).
    if (email) {
        document.getElementById("tab-game").disabled = false;
    }

    // index.html's account menu listens for this to update the avatar.
    window.dispatchEvent(new Event("account-changed"));
}
async function loginUser() {

    const emailInput =
        document.getElementById("email-input");

    const passwordInput =
        document.getElementById("password-input");

    const error =
        document.getElementById("login-error");

    const email =
        emailInput.value.trim().toLowerCase();

    const password =
        passwordInput.value;


    // --------------------------------------------------------
    // Basic validation
    // --------------------------------------------------------

    if (!email) {

        error.textContent =
            "Please enter your email.";

        return;
    }


    // Browser email validation
    if (!emailInput.checkValidity()) {

        error.textContent =
            "Please enter a valid email.";

        return;
    }


    if (!password) {

        error.textContent =
            "Please enter your password.";

        return;
    }


    error.textContent = "";


    try {

        const response =
            await fetch(
                "/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not log in."
            );

        }


        // ----------------------------------------------------
        // Save user information
        // ----------------------------------------------------

        setUserEmail(data.email);

        // Don't leave the password sitting in the field
        passwordInput.value = "";


        // ----------------------------------------------------
        // Move to topic screen
        // ----------------------------------------------------

        document
            .getElementById("login-screen")
            .classList.add("hidden");


        document
            .getElementById("start-screen")
            .classList.remove("hidden");


    }
    catch (err) {

        console.error(
            "LESSON ERROR:",
            err
        );

        error.textContent =
            err.message;
    }

}

// ============================================================
// START SCREEN
// ============================================================

function setupStartButton() {

    const startButton =
        document.getElementById("start-button");

    startButton.addEventListener(
        "click",
        startLearning
    );

}

// True while a search is loading, so pressing Enter again doesn't
// send a second request (for a new topic, a second Gemini package).
let lessonInFlight = false;

async function startLearning() {
    if (lessonInFlight) {
        return;
    }
    const topicInput =
        document.getElementById("topic-input");
    const error =
        document.getElementById("start-error");
    topic = topicInput.value.trim();
    if (!topic) {
        error.textContent =
            "Please enter something you want to learn.";
        return;
    }

    error.textContent = "";

    lessonInFlight = true;

    try {

        /* expected response:
         * {
         *     "topic": "...",
         *     "explanation": "...",
         *     "lesson": "...",
         *     "topic_id": 3,
         *     "concept_map": [ {concept_id, name, description,
         *         learning_objective, difficulty, prerequisites,
         *         mastery, attempts, evidence} ],
         *     "struggles": ["..."]
         * }
         */

        const response = await fetch(
            "/generate-lesson",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: topic
                })
            }
        );
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Could not generate lesson.");
        }

        topic = data.topic || topic;   // <-- adopt the canonical topic
        topicId = data.topic_id;

        renderConceptMap(data.concept_map || []);

        document.getElementById("lesson-topic").textContent = data.topic || topic;

        document.getElementById(
            "explanation"
        ).textContent =
            data.explanation || "";

        document.getElementById(
            "lesson"
        ).textContent =
            data.lesson || "";

        // Change screens

        document
            .getElementById("start-screen")
            .classList.add("hidden");


        document
            .getElementById("lesson-screen")
            .classList.remove("hidden");

        // A topic is loaded: the Game tab can be used from now on.
        document.getElementById("tab-game").disabled = false;


    }
    catch (err) {

        console.error(
            "LESSON ERROR:",
            err
        );

        error.textContent =
            err.message;
    }
    finally {

        lessonInFlight = false;

    }

}
function setupRetryButton() {
    const retryButton =
        document.getElementById("retry-after-explanation");

    retryButton.addEventListener(
        "click",
        function () {

            /*
             * Hide the popup.
             */
            document
                .getElementById("concept-popup")
                .classList.add("hidden");

            /*
             * Still answering: the game stays frozen. Only
             * resumePacmanAfterQuestion() may unfreeze it.
             */
            questionActive = true;

            /*
             * Show the follow-up (or the same question again).
             */
            showQuestion();
        }
    );
}
// ============================================================
// START PAC-MAN
// ============================================================

function setupQuizButton() {
    const button =
        document.getElementById(
            "start-quiz-button"
        );
    button.addEventListener(
        "click",
        startPacmanGame
    );
}


async function startPacmanGame() {
    const session = ++gameSession;

    document.body.classList.add("in-game");

    /*
     * Hide lesson
     */
    document
        .getElementById("lesson-screen")
        .classList.add("hidden");
    /*
     * Show game
     */
    document
        .getElementById("game-screen")
        .classList.remove("hidden");
    /*
     * Get canvas
     */
    board =
        document.getElementById("board");
    board.width = boardWidth;
    board.height = boardHeight;
    context =board.getContext("2d");
    /*
     * Reset state
     */

    score = 0;
    lives = 3;

    answerInFlight = false;

    gameOver = false;
    questionActive = false;

    currentQuestion = null;
    currentGhost = null;

    requestedDirection = null;

    frightenedFrames = 0;
    ghostsEatenThisPellet = 0;
    readyFrames = 0;
    outOfLives = false;
    mazeCleared = false;

    // A new game starts with the normal instructions, not the Boss
    // message from a previous game (same reset as exitPacmanGame()).
    const instructions =
        document.getElementById("game-instructions");

    instructions.textContent = defaultInstructionsText;

    instructions.classList.remove("boss-alert");


    /*
     * Load game assets
     */

    loadImages();

    loadMap();


    // Show the maze right away (the sprites appear as they load);
    // play starts when the server has the game's questions ready.
    const drawWhileLoading = setInterval(draw, 50);


    /*
     * Tell Flask we are starting a game.
     *
     * Expected response:
     *
     * {
     *     "game_id": "...",
     *     "question": {
     *         "question": "...",
     *         "options": [...]
     *     }
     * }
     */

    try {

        const response =
            await fetch(
                "/start-game",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        topic_id: topicId
                    })
                }
            );


        const data =
            await response.json();


        // The student exited while the game was loading.
        if (session !== gameSession) {
            return;
        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not start game."
            );

        }


        gameId = data.game_id;

        currentQuestion =
            data.question;


    }
    catch (error) {

        console.error(
            "GAME START ERROR:",
            error
        );

        if (session !== gameSession) {
            return;
        }

        alert(error.message);

        return;

    }
    finally {

        clearInterval(drawWhileLoading);

    }


    /*
     * Give ghosts random directions.
     */

    for (let ghost of ghosts.values()) {

        turnGhostRandomly(ghost);

    }


    /*
     * Listen for keyboard input. keydown, not keyup, so Pac-Man
     * reacts the moment a key is pressed.
     */

    document.addEventListener(
        "keydown",
        movePacman
    );


    gameStarted = true;

    update();

}
// ============================================================
// LOAD IMAGES
// ============================================================
function loadImages() {
    wallImage = new Image();
    wallImage.src ="/static/images/wall.png";
    blueGhostImage = new Image();
    blueGhostImage.src = "/static/images/blueGhost.png";
    orangeGhostImage = new Image();
    orangeGhostImage.src = "/static/images/orangeGhost.png";
    pinkGhostImage = new Image();
    pinkGhostImage.src ="/static/images/pinkGhost.png";
    redGhostImage = new Image();
    redGhostImage.src = "/static/images/redGhost.png";
    pacmanUpImage = new Image();
    pacmanUpImage.src ="/static/images/pacmanUp.png";
    pacmanDownImage = new Image();
    pacmanDownImage.src = "/static/images/pacmanDown.png";
    pacmanLeftImage = new Image();
    pacmanLeftImage.src = "/static/images/pacmanLeft.png";
    pacmanRightImage = new Image();
    pacmanRightImage.src = "/static/images/pacmanRight.png";
    scaredGhostImage = new Image();
    scaredGhostImage.src = "/static/images/scaredGhost.png";

}

// ============================================================
// LOAD MAP
// ============================================================

function loadMap() {
    walls.clear();
    foods.clear();
    ghosts.clear();
    pacman = null;


    for (let r = 0; r < rowCount; r++) {

        for (let c = 0; c < columnCount; c++) {
            const row = tileMap[r];
            const tile =row[c];
            const x = c * tileSize;

            const y = r * tileSize;

            // --------------------------
            // WALL
            // --------------------------

            if (tile === "X") {

                const wall =
                    new Block(
                        wallImage,
                        x,
                        y,
                        tileSize,
                        tileSize
                    );

                walls.add(wall);

            }


            // --------------------------
            // BLUE GHOST
            // --------------------------

            else if (tile === "b") {

                const ghost =
                    new Block(
                        blueGhostImage,
                        x,
                        y,
                        tileSize,
                        tileSize
                    );

                ghosts.add(ghost);

            }


            // --------------------------
            // ORANGE GHOST
            // --------------------------

            else if (tile === "o") {

                const ghost =
                    new Block(
                        orangeGhostImage,
                        x,
                        y,
                        tileSize,
                        tileSize
                    );

                ghosts.add(ghost);

            }


            // --------------------------
            // PINK GHOST
            // --------------------------

            else if (tile === "p") {

                const ghost =
                    new Block(
                        pinkGhostImage,
                        x,
                        y,
                        tileSize,
                        tileSize
                    );

                ghosts.add(ghost);

            }


            // --------------------------
            // RED GHOST
            // --------------------------

            else if (tile === "r") {

                const ghost =
                    new Block(
                        redGhostImage,
                        x,
                        y,
                        tileSize,
                        tileSize
                    );

                ghosts.add(ghost);

            }


            // --------------------------
            // PAC-MAN
            // --------------------------

            else if (tile === "P") {

                pacman =
                    new Block(
                        pacmanRightImage,
                        x,
                        y,
                        tileSize,
                        tileSize
                    );

            }


            // --------------------------
            // FOOD
            // --------------------------

        }

    }

    refillFood();

    refillPowerPellets();

}


// ============================================================
// REFILL FOOD
// ============================================================
//
// Only the pellets come back when the board is cleared. Rebuilding
// the whole map would also bring back ghosts that were already beaten.

function refillFood() {

    foods.clear();

    for (let r = 0; r < rowCount; r++) {

        for (let c = 0; c < columnCount; c++) {

            if (tileMap[r][c] === " " && !isPowerPelletTile(r, c)) {

                foods.add(
                    new Block(
                        null,
                        c * tileSize + 14,
                        r * tileSize + 14,
                        4,
                        4
                    )
                );

            }

        }

    }

}


function isPowerPelletTile(row, column) {

    return POWER_PELLET_TILES.some(function (tile) {
        return tile[0] === row && tile[1] === column;
    });

}


function refillPowerPellets() {

    powerPellets.clear();

    POWER_PELLET_TILES.forEach(function (tile) {

        powerPellets.add(
            new Block(
                null,
                tile[1] * tileSize + 10,
                tile[0] * tileSize + 10,
                12,
                12
            )
        );

    });

}


// ============================================================
// MAIN GAME LOOP
// ============================================================

function update() {

    if (!gameStarted) {
        return;
    }


    if (gameOver) {
        return;
    }


    /*
     * If a question is being answered,
     * freeze the game.
     */

    if (questionActive) {
        return;
    }


    /*
     * Out of lives: the board stays drawn with "GAME OVER" and the
     * loop stops; the Game Over popup offers My Progress or a
     * 3-question checkpoint to continue. Drawn here too, since the
     * last life can be lost just before a question, and play
     * resumes into this state.
     */

    if (outOfLives) {
        draw();
        showGameOverPopup();
        return;
    }


    // Maze cleared: the board stays drawn and the loop stops. The
    // first clear brings in the Boss; clearing it again with the Boss
    // out shows the popup (Play Again or My Progress). Checked here,
    // so a question opened on the same frame is answered first.
    if (mazeCleared) {
        draw();

        const bossOut = [...ghosts].some(function (ghost) {
            return ghost.isBoss;
        });

        if (!bossOut) {
            startBossAtMazeClear();
            return;
        }

        document.getElementById("maze-cleared-popup").classList.remove("hidden");
        return;
    }


    // Brief "READY!" pause after losing a life: nothing moves.
    if (readyFrames > 0) {
        readyFrames--;
    } else {
        move();
    }

    draw();


    if (outOfLives) {
        return;
    }


    // Replace any pending frame so update() never runs as two loops.
    clearTimeout(gameLoopTimeout);

    gameLoopTimeout =
        setTimeout(
            update,
            50
        );

}


// ============================================================
// DRAW GAME
// ============================================================

function draw() {

    context.clearRect(
        0,
        0,
        board.width,
        board.height
    );


    /*
     * Draw Pac-Man
     */

    if (pacman) {

        context.drawImage(
            pacman.image,
            pacman.x,
            pacman.y,
            pacman.width,
            pacman.height
        );

    }


    /*
     * Draw ghosts
     */

    for (let ghost of ghosts.values()) {

        context.save();

        if (ghost.isBoss) {
            context.shadowColor = "#f2c94c";
            context.shadowBlur = 14;
        }

        // Frightened ghosts are blue; near the end they flash back
        // to their normal look as a warning.
        let image = ghost.image;

        if (ghost.frightened) {

            const blinking =
                frightenedFrames <= FRIGHTENED_BLINK_FRAMES &&
                Math.floor(frightenedFrames / 4) % 2 === 0;

            image = blinking ? ghost.image : scaredGhostImage;

        }

        if (ghost.eaten) {

            drawGhostEyes(ghost);

        } else {

            context.drawImage(
                image,
                ghost.x,
                ghost.y,
                ghost.width,
                ghost.height
            );

        }

        context.restore();

    }


    /*
     * Draw walls
     */

    for (let wall of walls.values()) {

        context.drawImage(
            wall.image,
            wall.x,
            wall.y,
            wall.width,
            wall.height
        );

    }


    /*
     * Crown on the Boss Ghost (after walls so they don't cover it)
     */

    for (let ghost of ghosts.values()) {

        if (ghost.isBoss) {
            drawCrown(ghost);
        }

    }


    /*
     * Draw food
     */

    context.fillStyle = "white";

    for (let food of foods.values()) {

        context.fillRect(
            food.x,
            food.y,
            food.width,
            food.height
        );

    }


    /*
     * Draw power pellets
     */

    for (let pellet of powerPellets.values()) {

        context.beginPath();

        context.arc(
            pellet.x + pellet.width / 2,
            pellet.y + pellet.height / 2,
            7,
            0,
            Math.PI * 2
        );

        context.fill();

    }


    /*
     * Draw score/lives
     */

    context.fillStyle = "white";

    context.font =
        "14px sans-serif";


    context.fillText(
        "Lives: " + lives +
        "   Score: " + score,
        10,
        20
    );


    /*
     * READY! / GAME OVER messages, in the open row below the ghosts
     */

    const message =
        outOfLives
            ? "GAME OVER"
            : readyFrames > 0
                ? "READY!"
                : "";

    if (message) {

        context.save();

        context.font = "bold 18px sans-serif";
        context.textAlign = "center";
        context.fillStyle = outOfLives ? "#ff5c5c" : "#f2c94c";

        context.fillText(
            message,
            boardWidth / 2,
            11 * tileSize + 22
        );

        context.restore();

    }

}


// ============================================================
// MOVEMENT
// ============================================================

function move() {

    if (!pacman) {
        return;
    }


    // A turn pressed before reaching an opening is taken on the
    // first frame the maze allows it.
    applyRequestedDirection();


    /*
     * Move Pac-Man
     */

    pacman.x +=
        pacman.velocityX;

    pacman.y +=
        pacman.velocityY;


    /*
     * Wall collision
     */

    for (let wall of walls.values()) {

        if (
            collision(
                pacman,
                wall
            )
        ) {

            pacman.x -=
                pacman.velocityX;

            pacman.y -=
                pacman.velocityY;

            break;

        }

    }


    /*
     * Tunnel: the open "O" tiles at the ends of row 9 lead off the
     * board. Once Pac-Man has fully left one side, he comes back in
     * from the other.
     */

    wrapAroundTunnel(pacman);


    /*
     * Ghost movement
     */

    for (let ghost of ghosts.values()) {


        /*
         * Safety net: a ghost that is somehow off the board goes
         * back to its starting tile, so it can always be caught.
         */

        if (!isGhostOnBoard(ghost)) {

            ghost.reset();

            turnGhostRandomly(ghost);

        }


        /*
         * Check collision BEFORE moving ghost. Two opposite outcomes:
         *   frightened (blue) ghost -> Pac-Man eats it: points, it
         *     turns into eyes, play continues (no question);
         *   dangerous ghost -> it catches Pac-Man: a life is lost and
         *     the question opens.
         * Eyes (an eaten ghost heading home) are harmless.
         */

        if (
            !ghost.eaten &&
            collision(
                ghost,
                pacman
            )
        ) {

            if (ghost.frightened) {

                eatGhost(ghost);

            } else {

                ghostCatchesPacman(ghost);

                return;

            }

        }


        /*
         * At an intersection, pick which way to go next.
         */

        chooseGhostDirectionAtIntersection(ghost);


        /*
         * Move ghost.
         */

        ghost.x +=
            ghost.velocityX;

        ghost.y +=
            ghost.velocityY;


        /*
         * Walls and board edges both block ghosts. The only edge
         * they may cross is a tunnel opening (see isGhostOnBoard).
         */

        let blocked =
            !isGhostOnBoard(ghost);

        for (let wall of walls.values()) {

            if (blocked) {
                break;
            }

            blocked =
                collision(
                    ghost,
                    wall
                );

        }


        if (blocked) {

            ghost.x -=
                ghost.velocityX;

            ghost.y -=
                ghost.velocityY;

            turnGhostRandomly(ghost);

        }

        else {

            // Through the tunnel, same as Pac-Man.
            wrapAroundTunnel(ghost);

        }


        // Eyes back on their starting tile: the ghost respawns as a
        // normal (dangerous) ghost.
        if (
            ghost.eaten &&
            ghost.x === ghost.startX &&
            ghost.y === ghost.startY
        ) {

            ghost.eaten = false;

            ghost.frightened = false;

        }

    }


    /*
     * Food collision
     */

    let foodEaten = null;


    for (let food of foods.values()) {

        if (
            collision(
                pacman,
                food
            )
        ) {

            foodEaten = food;

            score += PELLET_POINTS;

            break;

        }

    }


    if (foodEaten) {

        foods.delete(
            foodEaten
        );

    }


    /*
     * Power pellets
     */

    for (let pellet of powerPellets.values()) {

        if (collision(pacman, pellet)) {

            powerPellets.delete(pellet);

            score += POWER_PELLET_POINTS;

            startFrightenedMode();

            break;

        }

    }


    tickFrightenedMode();


    /*
     * If all food is eaten, the maze is cleared: update() stops
     * the loop and brings in the Boss (or, if the Boss is already
     * out, shows the Maze Cleared popup).
     */

    if (foods.size === 0) {

        mazeCleared = true;

    }

}


// ============================================================
// FRIGHTENED GHOSTS, EATING GHOSTS, LIVES
// ============================================================

function startFrightenedMode() {

    frightenedFrames = FRIGHTENED_FRAMES;

    // A new power pellet starts the 200/400/800/1600 chain again.
    ghostsEatenThisPellet = 0;

    for (let ghost of ghosts.values()) {

        // Eyes heading home stay eyes.
        if (ghost.eaten) {
            continue;
        }

        // Ghosts turn around the moment they become frightened.
        if (!ghost.frightened) {

            ghost.direction =
                OPPOSITE_DIRECTION[ghost.direction];

            ghost.updateVelocity();

        }

        ghost.frightened = true;

    }

}


function tickFrightenedMode() {

    if (frightenedFrames === 0) {
        return;
    }

    frightenedFrames--;

    if (frightenedFrames === 0) {
        endFrightenedMode();
    }

}


function endFrightenedMode() {

    frightenedFrames = 0;

    ghostsEatenThisPellet = 0;

    for (let ghost of ghosts.values()) {
        ghost.frightened = false;
    }

    // All four power pellets used and ghosts still left: bring them
    // back, so the remaining ghosts (and the boss) can still be caught.
    if (powerPellets.size === 0 && ghosts.size > 0) {
        refillPowerPellets();
    }

}


// Pac-Man eats a frightened ghost: ghost points, and it turns into
// eyes that head back to its starting tile, where it respawns (see
// move()). No question, no pause: play simply continues.
function eatGhost(ghost) {

    score +=
        200 * Math.pow(2, ghostsEatenThisPellet);

    ghostsEatenThisPellet =
        Math.min(ghostsEatenThisPellet + 1, 3);

    ghost.eaten = true;

    ghost.frightened = false;

}


// A dangerous ghost catches Pac-Man: he loses a life, then the game
// pauses for the question. That ghost is the one asking, so the
// existing answer flow removes it after a correct answer, which is
// what moves the game on toward the Boss.
function ghostCatchesPacman(ghost) {

    loseLife();

    triggerQuestion(ghost);

}


// Pac-Man touched a normal ghost. Only gameplay state resets:
// answered questions, mastery and the current question are untouched.
function loseLife() {

    lives--;

    endFrightenedMode();

    resetPositions();

    if (lives <= 0) {

        lives = 0;

        outOfLives = true;

        return;

    }

    readyFrames = READY_FRAMES;

}


// "Continue" after the last life: same game and learning session,
// with fresh lives. The maze keeps its pellets as they were: ones
// already eaten stay gone.
function continueAfterGameOver() {

    outOfLives = false;

    lives = 3;

    resetPositions();

    readyFrames = READY_FRAMES;

    update();

}


// ============================================================
// GAME OVER POPUP AND CHECKPOINT
// ============================================================

function showGameOverPopup() {
    document.getElementById("game-over-popup").classList.remove("hidden");
}


function hideGameOverPopup() {
    document.getElementById("game-over-popup").classList.add("hidden");
}


function setupGameOverButtons() {

    // Leave the finished game (back to the lesson), then open My
    // Progress through its existing button, as the lesson screen does.
    document
        .getElementById("game-over-progress")
        .addEventListener("click", function () {

            exitPacmanGame();

            document.getElementById("dashboard-button").click();

        });

    document
        .getElementById("game-over-continue")
        .addEventListener("click", startCheckpoint);

}


// Maze Cleared popup: Play Again starts a new game straight away
// (no checkpoint); My Progress leaves the game like Game Over does.
function setupMazeClearedButtons() {

    document
        .getElementById("maze-cleared-play-again")
        .addEventListener("click", function () {

            document.getElementById("maze-cleared-popup").classList.add("hidden");

            startPacmanGame();

        });

    document
        .getElementById("maze-cleared-progress")
        .addEventListener("click", function () {

            exitPacmanGame();

            document.getElementById("dashboard-button").click();

        });

}


// "Continue Playing": answer 3 questions on this topic correctly
// before play resumes. The server picks them from the topic's saved
// questions and grades and records them like any other question.
async function startCheckpoint() {

    const session = gameSession;

    const button = document.getElementById("game-over-continue");

    button.disabled = true;

    // New questions may need a few seconds for Gemini to write.
    button.textContent = "Preparing questions…";

    try {

        const response = await fetch("/checkpoint/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game_id: gameId })
        });

        const data = await response.json();

        if (session !== gameSession) {
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || "Could not start the checkpoint.");
        }

        hideGameOverPopup();

        currentQuestion = data.question;
        currentGhost = null;
        questionActive = true;

        document.getElementById("game-screen").classList.add("hidden");
        document.getElementById("question-screen").classList.remove("hidden");

        showQuestion();

    } catch (error) {

        console.error("CHECKPOINT ERROR:", error);

        alert(error.message);

    } finally {

        button.disabled = false;

        button.textContent = "Continue Playing";

    }

}


// A checkpoint question answered correctly: show the next one, or
// after the last, return to Pac-Man exactly as "continue" always has
// (fresh lives and pellets, same game and learning session).
function handleCheckpointAnswer(data) {

    if (!data.checkpoint_complete) {

        currentQuestion = data.next_question;

        showQuestion();

        return;

    }

    // Back to the question the game was on; the next ghost asks it.
    currentQuestion = data.current_question;

    continueAfterGameOver();

    resumePacmanAfterQuestion();

}


// ============================================================
// TUNNEL WRAPAROUND
// ============================================================

function wrapAroundTunnel(block) {

    // Moving left, past the left edge: reappear at the right edge.
    if (block.x + block.width <= 0) {
        block.x = boardWidth;
    }

    // Moving right, past the right edge: reappear at the left edge.
    else if (block.x >= boardWidth) {
        block.x = -block.width;
    }

}


// ============================================================
// GHOST BOUNDARIES
// ============================================================
//
// Rows that open onto both side edges AND lead into the maze. Read
// from tileMap: row 9 ("O       bpo       O"). Rows 7 and 11 also
// end in "O" tiles, but "OOOX" walls them off, so they are not
// tunnels.

const TUNNEL_ROWS =
    tileMap
        .map(function (row, r) {
            return /^O+[^OX]/.test(row) && /[^OX]O+$/.test(row) ? r : -1;
        })
        .filter(function (r) {
            return r !== -1;
        });


// A ghost may be past a side edge only while it sits exactly on a
// tunnel row. Exact alignment matters: off the board there are no
// walls, so a ghost even a few pixels above or below the row could
// drift up or down forever.
function canGhostUseTunnel(ghost) {

    return (
        ghost.y % tileSize === 0 &&
        TUNNEL_ROWS.includes(ghost.y / tileSize)
    );

}


function isGhostOnBoard(ghost) {

    const insideX =
        ghost.x >= 0 &&
        ghost.x + ghost.width <= boardWidth;

    const insideY =
        ghost.y >= 0 &&
        ghost.y + ghost.height <= boardHeight;

    return insideY && (insideX || canGhostUseTunnel(ghost));

}


// Can a ghost step into this tile? Walls block it, and so does the
// edge of the map, except where a tunnel row runs off the side.
function isTileOpenForGhost(row, column) {

    if (row < 0 || row >= rowCount) {
        return false;
    }

    if (column < 0 || column >= columnCount) {
        return TUNNEL_ROWS.includes(row);
    }

    return tileMap[row][column] !== "X";

}


const GHOST_STEPS = {
    U: [-1, 0],
    D: [1, 0],
    L: [0, -1],
    R: [0, 1]
};

const OPPOSITE_DIRECTION = {
    U: "D",
    D: "U",
    L: "R",
    R: "L"
};


// Share of decisions where a ghost ignores Pac-Man and takes any
// open path (see chooseGhostDirectionAtIntersection).
const GHOST_WANDER_CHANCE = 0.25;


// When a ghost sits exactly on a tile, it looks at the open tiles
// around it (from tileMap), never doubling back unless it's a dead
// end, and picks the one that chases Pac-Man (or flees him while
// frightened). Decisions happen only on tile boundaries, so a ghost
// holds its direction between tiles.
function chooseGhostDirectionAtIntersection(ghost) {

    const onTile =
        ghost.x % tileSize === 0 &&
        ghost.y % tileSize === 0;

    // Mid-tunnel, past the side of the board: keep going straight
    // until the wraparound brings it back into the maze.
    const onBoard =
        ghost.x >= 0 &&
        ghost.x + ghost.width <= boardWidth;

    if (!onTile || !onBoard) {
        return;
    }

    const row = ghost.y / tileSize;
    const column = ghost.x / tileSize;

    const open = directions.filter(function (direction) {
        return isTileOpenForGhost(
            row + GHOST_STEPS[direction][0],
            column + GHOST_STEPS[direction][1]
        );
    });

    // Eyes (an eaten ghost) take the shortest path back to their
    // starting tile. They may double back: that keeps every step
    // strictly closer to home, so they always get there.
    if (ghost.eaten) {

        const home = tileDistancesTo(
            ghost.startY / tileSize,
            ghost.startX / tileSize
        );

        const stepsHome = function (direction) {
            const r = row + GHOST_STEPS[direction][0];
            const c = column + GHOST_STEPS[direction][1];
            return home[r] && home[r][c] !== undefined ? home[r][c] : Infinity;
        };

        const best = open.reduce(function (a, b) {
            return stepsHome(b) < stepsHome(a) ? b : a;
        }, open[0]);

        if (best) {
            ghost.direction = best;
            ghost.updateVelocity();
        }

        return;

    }

    let choices = open.filter(function (direction) {
        return direction !== OPPOSITE_DIRECTION[ghost.direction];
    });

    if (choices.length === 0) {
        choices = open;
    }

    if (choices.length === 0) {
        return;
    }

    // Normal ghosts chase Pac-Man: keep the options whose next tile
    // is closest to him. Frightened ghosts (including while they
    // blink) flee: keep the ones farthest away. Now and then a ghost
    // takes any open path instead, so the four don't stack into one.
    if (pacman && Math.random() >= GHOST_WANDER_CHANCE) {

        const pacmanRow = Math.round(pacman.y / tileSize);
        const pacmanColumn = Math.round(pacman.x / tileSize);

        const distanceToPacman = function (direction) {
            const dRow = row + GHOST_STEPS[direction][0] - pacmanRow;
            const dColumn = column + GHOST_STEPS[direction][1] - pacmanColumn;
            return dRow * dRow + dColumn * dColumn;
        };

        const distances = choices.map(distanceToPacman);

        const target =
            ghost.frightened
                ? Math.max(...distances)
                : Math.min(...distances);

        choices = choices.filter(function (_, i) {
            return distances[i] === target;
        });

    }

    ghost.direction =
        choices[
            Math.floor(
                Math.random() *
                choices.length
            )
        ];

    ghost.updateVelocity();

}


// Steps from every open tile to (row, column), walking the maze
// (breadth-first search over tileMap). Worked out once per target
// tile and cached; the maze never changes.
const tileDistanceCache = {};

function tileDistancesTo(row, column) {

    const key = row + "," + column;

    if (tileDistanceCache[key]) {
        return tileDistanceCache[key];
    }

    const distances = tileMap.map(function () {
        return [];
    });

    distances[row][column] = 0;

    const queue = [[row, column]];

    while (queue.length) {

        const [r, c] = queue.shift();

        directions.forEach(function (direction) {

            const nr = r + GHOST_STEPS[direction][0];
            const nc = c + GHOST_STEPS[direction][1];

            if (
                nr >= 0 && nr < rowCount &&
                nc >= 0 && nc < columnCount &&
                tileMap[nr][nc] !== "X" &&
                distances[nr][nc] === undefined
            ) {
                distances[nr][nc] = distances[r][c] + 1;
                queue.push([nr, nc]);
            }

        });

    }

    tileDistanceCache[key] = distances;

    return distances;

}


// Picks a random direction for a ghost. Block.updateDirection()
// only checks walls, and there are none beyond the board edge, so
// any turn that would leave the board is undone here.
function turnGhostRandomly(ghost) {

    const x = ghost.x;
    const y = ghost.y;
    const direction = ghost.direction;

    ghost.updateDirection(
        directions[
            Math.floor(
                Math.random() *
                directions.length
            )
        ]
    );

    if (!isGhostOnBoard(ghost)) {

        ghost.x = x;
        ghost.y = y;
        ghost.direction = direction;
        ghost.updateVelocity();

    }

}


// ============================================================
// KEYBOARD CONTROL
// ============================================================

function movePacman(event) {

    if (!gameStarted) {
        return;
    }


    if (gameOver) {
        return;
    }


    if (questionActive) {
        return;
    }


    // Game Over: the popup's buttons decide what happens next.
    if (outOfLives) {
        return;
    }


    const direction = PACMAN_KEYS[event.code];

    // Not a movement key, or the player is typing in a text field
    // (e.g. the search box, which stays visible above the game).
    // The hidden tab radio buttons are inputs too, and often keep
    // focus after the Game tab is clicked, so they don't count.
    const typingField =
        'textarea, select, input:not([type="radio"]):not([type="checkbox"])';

    if (
        !direction ||
        (event.target.closest && event.target.closest(typingField))
    ) {
        return;
    }

    // Arrow keys would otherwise scroll the page while playing.
    event.preventDefault();


    /*
     * Remember the turn and take it right away if the maze allows;
     * otherwise move() keeps retrying it every frame until it does.
     */

    requestedDirection = direction;

    applyRequestedDirection();

}


// Arrow keys and WASD, both mapped to the same directions.
const PACMAN_KEYS = {
    ArrowUp: "U",
    KeyW: "U",
    ArrowDown: "D",
    KeyS: "D",
    ArrowLeft: "L",
    KeyA: "L",
    ArrowRight: "R",
    KeyD: "R"
};


// The direction the player last asked for, kept until Pac-Man can
// actually turn that way (input buffering).
let requestedDirection = null;


function applyRequestedDirection() {

    if (!requestedDirection || !pacman) {
        return;
    }

    // Already going that way: nothing to do. (Held keys repeat
    // keydown; re-applying would push Pac-Man an extra step.)
    const moving = pacman.velocityX !== 0 || pacman.velocityY !== 0;

    if (requestedDirection === pacman.direction && moving) {
        requestedDirection = null;
        return;
    }

    // Mid-tunnel, past the side of the board, there are no walls to
    // stop an up/down turn, so Pac-Man could leave the maze. Keep
    // the request until he is back on the board.
    const inTunnel =
        pacman.x < 0 ||
        pacman.x + pacman.width > boardWidth;

    if (inTunnel && (requestedDirection === "U" || requestedDirection === "D")) {
        return;
    }

    // updateDirection() tests one step in the new direction against
    // the walls and keeps the old direction if it's blocked. When
    // the turn works, undo its test step: move() takes the real step,
    // so a turn never makes Pac-Man jump ahead.
    const x = pacman.x;
    const y = pacman.y;

    pacman.updateDirection(requestedDirection);

    if (pacman.x === x && pacman.y === y) {
        return;
    }

    pacman.x = x;
    pacman.y = y;

    requestedDirection = null;

    updatePacmanImage();

}


function updatePacmanImage() {

    if (pacman.direction === "U") {

        pacman.image =
            pacmanUpImage;

    }

    else if (pacman.direction === "D") {

        pacman.image =
            pacmanDownImage;

    }

    else if (pacman.direction === "L") {

        pacman.image =
            pacmanLeftImage;

    }

    else if (pacman.direction === "R") {

        pacman.image =
            pacmanRightImage;

    }

}


// ============================================================
// COLLISION DETECTION
// ============================================================

function collision(a, b) {

    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );

}


// ============================================================
// RESET POSITIONS
// ============================================================

function resetPositions() {

    if (pacman) {

        pacman.reset();

        pacman.velocityX = 0;

        pacman.velocityY = 0;

    }

    // Don't carry a pending turn over to the respawned Pac-Man.
    requestedDirection = null;


    for (let ghost of ghosts.values()) {

        ghost.reset();


        turnGhostRandomly(ghost);

    }

}


// ============================================================
// GHOST COLLISION
// ============================================================

function triggerQuestion(ghost) {

    /*
     * Don't trigger another question
     * while one is already active.
     */

    if (questionActive) {
        return;
    }


    /*
     * Make sure we actually have
     * a question.
     */

    if (!currentQuestion) {

        console.error(
            "No current question available."
        );

        return;

    }


    questionActive = true;

    currentGhost = ghost;


    /*
     * Stop Pac-Man.
     */

    pacman.velocityX = 0;

    pacman.velocityY = 0;


    /*
     * Stop ghosts.
     */

    for (let g of ghosts.values()) {

        g.velocityX = 0;

        g.velocityY = 0;

    }


    /*
     * Hide game.
     */

    document
        .getElementById("game-screen")
        .classList.add("hidden");


    /*
     * Show question.
     */

    document
        .getElementById("question-screen")
        .classList.remove("hidden");


    showQuestion();

}


// ============================================================
// DISPLAY QUESTION
// ============================================================

function showQuestion() {

    if (!currentQuestion) {

        console.error(
            "currentQuestion is null."
        );

        return;

    }


    const questionText =
        document.getElementById(
            "question-text"
        );


    const optionsContainer =
        document.getElementById(
            "options-container"
        );


    const questionNumber =
        document.getElementById(
            "question-number"
        );


    const scoreDisplay =
        document.getElementById(
            "score"
        );


    /*
     * Question text
     */

    questionText.textContent =
        currentQuestion.question;


    /*
     * Clear old buttons.
     */

    optionsContainer.innerHTML = "";


    /*
     * Display question number.
     */

    const followUp =
        currentQuestion.is_remediation ? "Follow-up · " : "";

    if (currentQuestion.checkpoint) {

        questionNumber.textContent =
            `Checkpoint · Question ${currentQuestion.checkpoint.number} of ${currentQuestion.checkpoint.total} · ${currentQuestion.concept}`;

    } else if (currentQuestion.is_boss) {

        questionNumber.textContent =
            `${followUp}👑 Boss Ghost · Final transfer challenge · ${currentQuestion.concept}`;

    } else {

        questionNumber.textContent =
            `${followUp}Question ${currentQuestion.number} of ${currentQuestion.total} · ${currentQuestion.concept}`;

    }

    document
        .getElementById("question-screen")
        .classList.toggle("boss-question", currentQuestion.is_boss);


    /*
     * Display score.
     */

    scoreDisplay.textContent =
        `Score: ${score}`;


    /*
     * Create answer buttons (or, for the Boss Ghost, a text box).
     */

    if (currentQuestion.format === "frq") {

        renderFreeResponse(optionsContainer);

    } else currentQuestion.options.forEach(
        function (option) {

            const button =
                document.createElement(
                    "button"
                );


            button.textContent =
                option;


            button.classList.add(
                "option-button"
            );


            button.addEventListener(
                "click",
                function () {

                    answerQuestion(
                        option,
                        button
                    );

                }
            );


            optionsContainer.appendChild(
                button
            );

        }
    );


    /*
     * Clear previous feedback.
     */

    document.getElementById(
        "answer-feedback"
    ).textContent = "";

}


// ============================================================
// FREE-RESPONSE ANSWER (Boss Ghost)
// ============================================================

// Matches MAX_FREE_RESPONSE_LENGTH on the server.
const MAX_FREE_RESPONSE_LENGTH = 1000;

function renderFreeResponse(container) {

    const hint = createText(
        "p",
        "free-response-hint",
        "Answer in your own words. Press Ctrl+Enter or ⌘+Enter to submit."
    );

    const input = document.createElement("textarea");
    input.id = "free-response-input";
    input.className = "free-response-input";
    input.rows = 4;
    input.maxLength = MAX_FREE_RESPONSE_LENGTH;
    input.placeholder = "Type your answer…";
    input.setAttribute("aria-label", "Your answer");

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "option-button free-response-submit";
    submit.textContent = "Submit answer";

    submit.addEventListener("click", function () {

        const answer = input.value.trim();
        const feedback = document.getElementById("answer-feedback");

        if (!answer) {
            feedback.textContent = "Type your answer before submitting.";
            input.focus();
            return;
        }

        feedback.textContent = "Grading your answer…";
        answerQuestion(answer, submit);

    });

    input.addEventListener("keydown", function (event) {

        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit.click();
        }

    });

    container.append(hint, input, submit);
    input.focus();

}


// ============================================================
// ANSWER QUESTION
// ============================================================

async function answerQuestion(
    selectedAnswer,
    selectedButton
) {

    if (answerInFlight) {
        return;
    }

    answerInFlight = true;

    const session = gameSession;

    /*
     * Disable every option.
     */

    const buttons =
        document.querySelectorAll(
            "#options-container button, #options-container textarea"
        );


    buttons.forEach(
        function (button) {

            button.disabled = true;

        }
    );


    try {

        const response =
            await fetch(
                "/check-answer",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        game_id:
                            gameId,

                        question_id:
                            currentQuestion.question_id,

                        answer:
                            selectedAnswer

                    })
                }
            );


        const data =
            await response.json();


        // The student exited while the answer was being checked.
        if (session !== gameSession) {
            return;
        }


        /*
         * The server already graded this question (for example a
         * retried request). Catch up with where the game really is.
         */

        if (response.status === 409) {

            if (data.game_complete) {
                endPacmanGame();
            } else if (data.current_question) {
                currentQuestion = data.current_question;
                showQuestion();
            }

            return;

        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not check answer."
            );

        }


        /*
         * CORRECT
         */

        if (data.correct) {

            selectedButton.classList.add(
                "correct"
            );


            document.getElementById(
                "answer-feedback"
            ).textContent =
                data.grading
                    ? `Correct! ${data.grading.feedback}`
                    : "Correct! You defeated the ghost!";


            handleCorrectAnswer(
                data
            );

        }


        /*
         * INCORRECT
         */

        else {

            selectedButton.classList.add(
                "incorrect"
            );


            document.getElementById(
                "answer-feedback"
            ).textContent =
                data.grading
                    ? `Not quite. ${data.grading.feedback}`
                    : `Incorrect. The correct answer is: ${data.correct_answer}`;


            handleWrongAnswer(
                data
            );

        }

    }


    catch (error) {

        console.error(
            "ANSWER ERROR:",
            error
        );


        document.getElementById(
            "answer-feedback"
        ).textContent =
            error.message;


        /*
         * Allow user to try again
         * if the request itself failed.
         */

        buttons.forEach(
            function (button) {

                button.disabled = false;

            }
        );

    }


    finally {

        answerInFlight = false;

    }

}


// ============================================================
// CORRECT ANSWER
// ============================================================

function handleCorrectAnswer(data) {

    // Game Over checkpoint questions don't touch ghosts or progress.
    if (data.checkpoint) {
        handleCheckpointAnswer(data);
        return;
    }

    /*
     * `score` is the Pac-Man game score (pellets and ghosts). The
     * server's data.score counts correct answers, a learning metric,
     * so it is deliberately not copied into it.
     */


    /*
     * Remove the ghost that was hit.
     */
    if (currentGhost) {
        ghosts.delete(currentGhost);
    }

    currentGhost = null;


    /*
     * IMPORTANT:
     *
     * Flask already selected the NEXT question.
     *
     * We simply store it.
     *
     * DO NOT call /check-answer again.
     */
    if (data.next_question) {

        currentQuestion = data.next_question;

    }


    /*
     * The server decides when the game is over: only after the
     * Boss Ghost's question has been answered correctly. The game
     * does not resume; it goes straight to the learning report.
     */
    if (data.game_complete) {

        endPacmanGame();

        return;

    }


    /*
     * Back to Pac-Man. The next question only opens when
     * Pac-Man catches another ghost.
     */
    resumePacmanAfterQuestion();

}


// ============================================================
// RESUME AFTER QUESTION
// ============================================================
//
// The ONLY way back from a question to the running game. Called
// only after a correct answer that doesn't finish the game.

function resumePacmanAfterQuestion() {

    // Must be cleared before update(), which returns early while true.
    questionActive = false;


    document
        .getElementById("question-screen")
        .classList.add("hidden");

    document
        .getElementById("concept-popup")
        .classList.add("hidden");

    document
        .getElementById("game-screen")
        .classList.remove("hidden");


    /*
     * Resume Pac-Man movement.
     */
    pacman.updateVelocity();


    /*
     * Give remaining ghosts new directions.
     */
    for (let ghost of ghosts.values()) {

        turnGhostRandomly(ghost);

    }


    /*
     * Resume game loop. update() clears any pending frame first,
     * so this never starts a second loop.
     */
    update();

}


// ============================================================
// BOSS GHOST
// ============================================================

// The last white pellet was eaten: the server moves this game on to
// its Boss question, the white pellets come back (same maze, power
// pellets as they are) and the Boss appears.
async function startBossAtMazeClear() {

    const session = gameSession;

    try {

        const response = await fetch("/boss/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game_id: gameId })
        });

        const data = await response.json();

        // The student exited while this was loading.
        if (session !== gameSession) {
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || "Could not start the Boss.");
        }

        currentQuestion = data.question;

    }
    catch (error) {

        if (session !== gameSession) {
            return;
        }

        // Play on with the pellets back; the next clear tries again.
        console.error("BOSS START ERROR:", error);

    }

    refillFood();

    mazeCleared = false;

    if (currentQuestion && currentQuestion.is_boss) {
        spawnBossGhost();
    }

    update();

}


function spawnBossGhost() {

    // The boss fights alone. Any regular ghost still on the board
    // would otherwise ask the boss question without looking like it.
    for (let ghost of ghosts.values()) {

        if (!ghost.isBoss) {
            ghosts.delete(ghost);
        }

    }

    for (let ghost of ghosts.values()) {

        if (ghost.isBoss) {
            return;
        }

    }

    const row = tileMap.findIndex(
        function (line) {
            return line.includes(BOSS_SPAWN_TILE);
        }
    );

    const column = tileMap[row].indexOf(BOSS_SPAWN_TILE);

    const boss =
        new Block(
            redGhostImage,
            column * tileSize,
            row * tileSize,
            tileSize,
            tileSize
        );

    boss.isBoss = true;

    ghosts.add(boss);


    // Start Pac-Man from home so the boss doesn't appear on top of him.
    pacman.reset();


    const instructions =
        document.getElementById("game-instructions");

    instructions.textContent =
        "👑 The Boss Ghost is here! Catch it for the final transfer challenge.";

    instructions.classList.add("boss-alert");

}


// An eaten ghost is just a pair of eyes, looking where it's going.
function drawGhostEyes(ghost) {

    const step = GHOST_STEPS[ghost.direction] || [0, 0];
    const lookX = step[1] * 2;
    const lookY = step[0] * 2;

    [ghost.x + 10, ghost.x + 22].forEach(function (eyeX) {

        const eyeY = ghost.y + 13;

        context.fillStyle = "#ffffff";
        context.beginPath();
        context.ellipse(eyeX, eyeY, 5, 6, 0, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "#2b3cff";
        context.beginPath();
        context.arc(eyeX + lookX, eyeY + lookY, 2.5, 0, Math.PI * 2);
        context.fill();

    });

}


function drawCrown(ghost) {

    const x = ghost.x;
    const w = ghost.width;
    const top = ghost.y - 10;

    context.save();

    context.fillStyle = "#f2c94c";

    context.beginPath();
    context.moveTo(x + 5, top + 9);
    context.lineTo(x + 5, top + 1);
    context.lineTo(x + w * 0.32, top + 5);
    context.lineTo(x + w / 2, top - 2);
    context.lineTo(x + w * 0.68, top + 5);
    context.lineTo(x + w - 5, top + 1);
    context.lineTo(x + w - 5, top + 9);
    context.closePath();
    context.fill();

    context.restore();

}


// ============================================================
// WRONG ANSWER
// ============================================================

function handleWrongAnswer(data) {

    /*
     * The student answers again before moving on: a new question on
     * the same concept, pitched at their level, arrives with the
     * explanation (the Boss keeps its question). Only a correct answer
     * advances past it (to data.next_question, in handleCorrectAnswer).
     */

    const explanationText =
        document.getElementById("concept-popup-explanation");

    const retryButton =
        document.getElementById("retry-after-explanation");

    // Boss answers are graded by Gemini: show its feedback first.
    const feedback =
        data.grading ? `${data.grading.feedback} ` : "";

    const fallback =
        `Think about how ${data.concept} connects to ${topic}, then reconsider your choice.`;


    /*
     * Show the popup right away with the verdict. The AI-generated
     * explanation takes a few seconds, so it is fetched separately
     * (/remediation) and fills in when ready; Try Again waits for it.
     */
    explanationText.textContent =
        `Not quite. ${feedback}Loading an explanation of this concept…`;

    retryButton.disabled = true;
    retryButton.textContent = "Loading…";

    const popup =
        document.getElementById("concept-popup");

    popup.classList.remove("hidden");


    /*
     * Keep the question "active" — Pac-Man
     * stays frozen until the student
     * dismisses the popup.
     */
    questionActive = true;


    const session = gameSession;
    const request = ++remediationRequest;

    fetchExplanation(currentQuestion.question_id).then(
        function (result) {

            // The student left the game, or answered again, meanwhile.
            if (session !== gameSession || request !== remediationRequest) {
                return;
            }

            // Try Again shows the follow-up; without one, the same question.
            if (result.question) {
                currentQuestion = result.question;
            }

            explanationText.textContent =
                feedback + (result.explanation || fallback);

            retryButton.disabled = false;
            retryButton.textContent = "Try Again";

            /*
             * Move focus to the retry button
             * for keyboard/accessibility users.
             */
            retryButton.focus();

        }
    );

}


// Counts wrong answers, so a slow explanation for an earlier one
// never overwrites the current popup.
let remediationRequest = 0;


// The server writes the explanation for the answer it just marked
// wrong (it knows the question and the answer given), and picks the
// follow-up question. { explanation: "", question: null } on failure.
async function fetchExplanation(questionId) {

    try {

        const response = await fetch("/remediation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                game_id: gameId,
                question_id: questionId
            })
        });

        const data = await response.json();

        return response.ok
            ? { explanation: (data.explanation || "").trim(), question: data.question || null }
            : { explanation: "", question: null };

    } catch (error) {

        console.error("EXPLANATION ERROR:", error);

        return { explanation: "", question: null };

    }

}


// ============================================================
// END GAME
// ============================================================

function endPacmanGame() {

    gameStarted = false;

    gameOver = true;

    questionActive = false;

    stopGameLoop();

    document.body.classList.remove("in-game");


    /*
     * Hide question/game.
     */

    document
        .getElementById("question-screen")
        .classList.add("hidden");


    document
        .getElementById("game-screen")
        .classList.add("hidden");


    document
        .getElementById("final-score")
        .textContent =
        `You beat all four ghosts and the Boss Ghost! Final score: ${score}`;


    /*
     * Go straight to the learning report.
     */

    showLearningReport();

}


// ============================================================
// EXIT GAME (× button)
// ============================================================

function stopGameLoop() {

    clearTimeout(gameLoopTimeout);

    gameLoopTimeout = null;

    document.removeEventListener(
        "keydown",
        movePacman
    );

}


function setupExitButton() {

    defaultInstructionsText =
        document.getElementById("game-instructions").textContent;

    document
        .getElementById("exit-game-button")
        .addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                exitPacmanGame();

            }
        );

}


// Leaves the current game from any point (board, question, concept
// popup, Boss Ghost) and goes back to the lesson. Nothing is sent to
// the server: the topic, lesson and progress stay exactly as they are.
function exitPacmanGame() {

    // Any /start-game or /check-answer still in flight is now stale.
    gameSession++;

    gameStarted = false;

    gameOver = true;

    questionActive = false;

    answerInFlight = false;

    currentGhost = null;

    stopGameLoop();


    /*
     * Stop Pac-Man and the ghosts.
     */

    if (pacman) {

        pacman.velocityX = 0;

        pacman.velocityY = 0;

    }

    for (let ghost of ghosts.values()) {

        ghost.velocityX = 0;

        ghost.velocityY = 0;

    }


    /*
     * Clear leftovers so the next game starts clean.
     */

    document.getElementById("answer-feedback").textContent = "";

    const instructions =
        document.getElementById("game-instructions");

    instructions.textContent = defaultInstructionsText;

    instructions.classList.remove("boss-alert");


    /*
     * Hide every game screen and return to the lesson.
     */

    document.body.classList.remove("in-game");

    [
        "game-screen",
        "question-screen",
        "concept-popup",
        "game-over-popup",
        "maze-cleared-popup"
    ].forEach(function (id) {

        document.getElementById(id).classList.add("hidden");

    });

    document.getElementById("tab-all").checked = true;

    document
        .getElementById("lesson-screen")
        .classList.remove("hidden");

}

// ============================================================
// LEARNING REPORT
// ============================================================

function setupReportButtons() {
    const viewReportButton =
        document.getElementById("view-report-button");
    if (viewReportButton) {
        viewReportButton.addEventListener("click", showLearningReport);
    }

    const continueButton =
        document.getElementById("report-continue-button");
    if (continueButton) {
        continueButton.addEventListener("click", function () {
            document.getElementById("report-screen").classList.add("hidden");
            document.getElementById("start-screen").classList.remove("hidden");
        });
    }
}

async function showLearningReport() {
    try {
        const response = await fetch(`/learning-report/${gameId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load report.");
        }

        renderLearningReport(data);

        document.getElementById("game-over-screen").classList.add("hidden");
        document.getElementById("report-screen").classList.remove("hidden");

    } catch (error) {
        console.error("REPORT ERROR:", error);
        alert(error.message);

        // Fall back to the "Quest Complete" screen, whose
        // View Learning Report button can try again.
        document.getElementById("game-over-screen").classList.remove("hidden");
    }
}
function renderLearningReport(data) {
    document.getElementById("report-topic").textContent = data.topic;

    const overallFill =
        document.getElementById("report-overall-fill");
    overallFill.style.width = percent(data.accuracy);
    overallFill.replaceChildren(
        createText("span", "mastery-fill-label", percent(data.accuracy))
    );

    document.getElementById("report-summary").textContent =
        `Game score: ${score} · ` +
        `${data.questions_answered} questions answered · ` +
        `Session learning gain: ${signedPoints(data.session_gain)}`;

    const conceptsContainer =
        document.getElementById("report-concepts");

    conceptsContainer.replaceChildren(
        createText(
            "p",
            "chart-note",
            "Concept mastery. The white line marks where you started this game."
        )
    );

    data.concepts.forEach(function (concept) {
        const row = createMasteryBar(
            concept.name,
            concept.after,
            concept.before
        );

        row.appendChild(
            createText(
                "span",
                "bar-row-change",
                signedPoints(concept.after - concept.before, "")
            )
        );

        conceptsContainer.appendChild(row);
    });

    const recBox =
        document.getElementById("report-recommendation");
    const recText =
        document.getElementById("report-recommendation-text");

    if (data.recommended_review) {
        recText.textContent =
            `Practice "${data.recommended_review}" next.`;
        recBox.classList.remove("hidden");
    } else {
        recBox.classList.add("hidden");
    }
}

// ============================================================
// DASHBOARD
// ============================================================

function setupDashboardButton() {
    const dashboardButton =
        document.getElementById("dashboard-button");
    if (dashboardButton) {
        dashboardButton.addEventListener("click", showDashboard);
    }

    const backButton =
        document.getElementById("dashboard-back-button");
    if (backButton) {
        backButton.addEventListener("click", function () {
            document.getElementById("dashboard-screen").classList.add("hidden");
            document.getElementById("start-screen").classList.remove("hidden");
        });
    }
}

async function showDashboard() {
    if (!userEmail) {
        alert("Please log in first.");
        return;
    }

    try {
        const response = await fetch("/my-progress");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load progress.");
        }

        renderDashboard(data.topics);

        document.getElementById("start-screen").classList.add("hidden");
        document.getElementById("dashboard-screen").classList.remove("hidden");

    } catch (error) {
        console.error("DASHBOARD ERROR:", error);
        alert(error.message);
    }
}

/*
 * topics: [{ title, overall_mastery, concepts_practiced,
 *            concepts_total, questions_answered, last_session_gain,
 *            struggles: [concept], concepts: [concept] }]
 * concept: { name, mastery, attempts, recent_accuracy,
 *            difficulty_reached, evidence, misconceptions }
 */
function renderDashboard(topics) {
    const container =
        document.getElementById("dashboard-topics");
    container.replaceChildren();

    if (!topics || topics.length === 0) {
        container.append(
            createText("h3", "", "No learning activity yet"),
            createText("p", "", "Search for a topic and play a game to start building your progress.")
        );
        return;
    }

    topics.forEach(function (topicData, index) {
        const topicCard = document.createElement("div");
        topicCard.classList.add("topic-card");

        const header = document.createElement("button");
        header.type = "button";
        header.classList.add("topic-header");
        header.append(
            createText("span", "", topicData.title),
            createText(
                "span",
                "",
                (topicData.overall_mastery === null
                    ? "Not practiced"
                    : percent(topicData.overall_mastery)) + " ▾"
            )
        );

        const body = document.createElement("div");
        body.classList.add("topic-concepts");

        // Open the most recent topic; the rest start collapsed.
        if (index > 0) {
            body.classList.add("hidden");
        }

        body.appendChild(renderStruggles(topicData));

        const stats = [
            `${topicData.questions_answered} questions answered`,
            `${topicData.concepts_practiced} of ${topicData.concepts_total} concepts practiced`
        ];

        if (topicData.last_session_gain !== null) {
            stats.push(`Last session: ${signedPoints(topicData.last_session_gain)}`);
        }

        body.appendChild(createText("p", "topic-stats", stats.join(" · ")));

        topicData.concepts.forEach(function (concept) {
            body.appendChild(createMasteryBar(concept.name, concept.mastery));

            if (concept.attempts) {
                body.appendChild(
                    createText("p", "bar-row-meta", conceptDetails(concept))
                );
            }
        });

        header.addEventListener("click", function () {
            body.classList.toggle("hidden");
        });

        topicCard.append(header, body);
        container.appendChild(topicCard);
    });
}

/*
 * The student model's answer to "what is this student struggling with?"
 */
function renderStruggles(topicData) {
    const box = document.createElement("div");
    box.classList.add("struggles");

    if (topicData.struggles.length === 0) {
        box.classList.add("struggles-none");
        box.appendChild(
            createText(
                "p",
                "",
                topicData.concepts_practiced
                    ? "No weak spots right now. Every practiced concept is at 50% or higher."
                    : "Play a game to find out what to work on."
            )
        );
        return box;
    }

    box.appendChild(createText("h3", "", "Struggling with"));

    const list = document.createElement("ul");

    topicData.struggles.forEach(function (concept) {
        const item = document.createElement("li");
        item.append(
            createText("strong", "", concept.name),
            createText(
                "span",
                "",
                ` · ${percent(concept.mastery)} after ${concept.attempts} ` +
                (concept.attempts === 1 ? "answer" : "answers")
            )
        );

        list.appendChild(item);
    });

    box.appendChild(list);
    return box;
}

const LEVEL_NAMES = ["", "basic", "intermediate", "advanced", "transfer"];

function conceptDetails(concept) {
    const details = [];

    if (concept.recent_accuracy !== null) {
        details.push(`Recent: ${percent(concept.recent_accuracy)} correct`);
    }

    details.push(
        concept.difficulty_reached
            ? `Hardest solved: ${LEVEL_NAMES[concept.difficulty_reached]}`
            : "No correct answers yet"
    );

    details.push(`Evidence: ${concept.evidence}`);

    return details.join(" · ");
}

// ============================================================
// LEARNING MAP (lesson screen)
// ============================================================

const DIFFICULTY_NAMES = ["", "Foundational", "Intermediate", "Advanced"];

/*
 * concepts: [{ name, description, learning_objective, difficulty,
 *              prerequisites: [names], mastery, attempts }]
 * in the order they should be learned.
 */
function renderConceptMap(concepts) {
    const list = document.getElementById("concept-map");
    list.replaceChildren();

    concepts.forEach(function (concept) {
        const item = document.createElement("li");
        item.classList.add("concept-node");

        const heading = document.createElement("div");
        heading.classList.add("concept-heading");
        heading.append(
            createText("strong", "concept-name", concept.name),
            createText(
                "span",
                `concept-level level-${concept.difficulty}`,
                DIFFICULTY_NAMES[concept.difficulty]
            )
        );

        item.append(
            heading,
            createText("p", "concept-objective", concept.learning_objective)
        );

        if (concept.prerequisites.length) {
            item.appendChild(
                createText(
                    "p",
                    "concept-prereqs",
                    `Builds on: ${concept.prerequisites.join(", ")}`
                )
            );
        }

        item.appendChild(createMasteryBar("Your mastery", concept.mastery));

        list.appendChild(item);
    });
}

// ============================================================
// SHARED HELPERS
// ============================================================

function createText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    element.textContent = text;
    return element;
}

function percent(value) {
    return `${Math.round(value * 100)}%`;
}

function signedPoints(change, unit = " points") {
    const points = Math.round(change * 100);
    return `${points > 0 ? "+" : ""}${points}${unit}`;
}

/*
 * A labelled mastery bar. `value` is 0-1, or null for "not practiced".
 * `before` (optional) draws a line where mastery started.
 */
function createMasteryBar(label, value, before) {
    const row = document.createElement("div");
    row.classList.add("bar-row");

    const track = document.createElement("div");
    track.classList.add("bar-track");

    if (value === null || value === undefined) {
        track.appendChild(
            createText("span", "bar-empty-note", "Not practiced yet")
        );
    } else {
        const fill = document.createElement("div");
        fill.classList.add("bar-fill", masteryBand(value));
        fill.style.width = percent(value);
        fill.appendChild(
            createText("span", "bar-fill-label", percent(value))
        );
        track.appendChild(fill);
    }

    if (typeof before === "number") {
        const marker = document.createElement("div");
        marker.classList.add("bar-start");
        marker.style.left = percent(before);
        marker.title = `Started at ${percent(before)}`;
        track.appendChild(marker);
    }

    row.append(createText("span", "bar-row-label", label), track);
    return row;
}

// Same cut-offs the tutor uses to pick question difficulty.
function masteryBand(value) {
    if (value < 0.4) return "mastery-low";
    if (value < 0.7) return "mastery-mid";
    return "mastery-high";
}

// ============================================================
// RESTART
// ============================================================

function setupRestartButton() {

    // One on the "Quest Complete" screen, one on the learning report.
    ["restart-button", "report-restart-button"].forEach(
        function (id) {

            document
                .getElementById(id)
                .addEventListener(
                    "click",
                    function () {

                        location.reload();

                    }
                );

        }
    );

}


// ============================================================
// PAC-MAN / GHOST CLASS
// ============================================================

class Block {

    constructor(
        image,
        x,
        y,
        width,
        height
    ) {

        this.image = image;

        this.x = x;
        this.y = y;

        this.width = width;
        this.height = height;


        /*
         * Starting position.
         */

        this.startX = x;
        this.startY = y;


        /*
         * Movement.
         */

        this.direction = "R";

        this.velocityX = 0;
        this.velocityY = 0;

    }


    // ========================================================
    // CHANGE DIRECTION
    // ========================================================

    updateDirection(direction) {

        const previousDirection =
            this.direction;


        this.direction =
            direction;


        this.updateVelocity();


        /*
         * Test movement before
         * permanently changing direction.
         */

        this.x +=
            this.velocityX;

        this.y +=
            this.velocityY;


        for (let wall of walls.values()) {

            if (
                collision(
                    this,
                    wall
                )
            ) {

                /*
                 * Undo movement.
                 */

                this.x -=
                    this.velocityX;

                this.y -=
                    this.velocityY;


                /*
                 * Restore previous direction.
                 */

                this.direction =
                    previousDirection;


                this.updateVelocity();


                return;

            }

        }

    }


    // ========================================================
    // SET VELOCITY
    // ========================================================

    updateVelocity() {

        if (
            this.direction === "U"
        ) {

            this.velocityX = 0;

            this.velocityY =
                -tileSize / 4;

        }


        else if (
            this.direction === "D"
        ) {

            this.velocityX = 0;

            this.velocityY =
                tileSize / 4;

        }


        else if (
            this.direction === "L"
        ) {

            this.velocityX =
                -tileSize / 4;

            this.velocityY = 0;

        }


        else if (
            this.direction === "R"
        ) {

            this.velocityX =
                tileSize / 4;

            this.velocityY = 0;

        }

    }


    // ========================================================
    // RESET
    // ========================================================

    reset() {

        this.x =
            this.startX;

        this.y =
            this.startY;

    }

}