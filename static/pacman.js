// ============================================================
// LEARNING PAC-MAN
// ============================================================


// ============================================================
// BOARD SETTINGS
// ============================================================

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

let defeatedGhosts = 0;

const totalGhosts = 4;

let topic = "";
let gameId = null;


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
});

// ============================================================
// USER LOGIN
// ============================================================

let userId = null;
let userEmail = null;


function setupLoginButton() {

    const loginButton =
        document.getElementById("login-button");

    loginButton.addEventListener(
        "click",
        loginUser
    );

}

function loadUser() {
    const savedUserId = localStorage.getItem("user_id");
    const savedEmail = localStorage.getItem("user_email");
    if (savedUserId && savedEmail) {
        userId = Number(savedUserId);
        userEmail = savedEmail;

        const loginScreen = document.getElementById("login-screen");
        const startScreen = document.getElementById("start-screen");
        if (loginScreen) loginScreen.classList.add("hidden");
        if (startScreen) startScreen.classList.remove("hidden");

        console.log("Existing user:", userId);
    }
}
async function loginUser() {

    const emailInput =
        document.getElementById("email-input");

    const error =
        document.getElementById("login-error");

    const email =
        emailInput.value.trim().toLowerCase();


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
                        email: email
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

        userId = data.user_id;
        userEmail = data.email;


        // Save it in browser storage
        localStorage.setItem(
            "user_id",
            userId
        );

        localStorage.setItem(
            "user_email",
            userEmail
        );


        console.log(
            "Logged in user:",
            userId
        );


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

async function startLearning() {
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

    try {

        /* expected response:
         * {
         *     "topic": "...",
         *     "explanation": "...",
         *     "lesson": "..."
         * }
         */

        const response = await fetch(
            "/generate-lesson",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: topic,
                    user_id: userId
                })
            }
        );
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Could not generate lesson.");
        }

        topic = data.topic || topic;   // <-- adopt the canonical topic

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
             * Re-display the same question.
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

    defeatedGhosts = 0;

    gameOver = false;
    questionActive = false;

    currentQuestion = null;
    currentGhost = null;


    /*
     * Load game assets
     */

    loadImages();

    loadMap();


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
                        topic: topic,
                        user_id: userId
                    })
                }
            );


        const data =
            await response.json();


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

        alert(error.message);

        return;

    }


    /*
     * Give ghosts random directions.
     */

    for (let ghost of ghosts.values()) {

        const newDirection =
            directions[
                Math.floor(
                    Math.random() *
                    directions.length
                )
            ];

        ghost.updateDirection(
            newDirection
        );

    }


    /*
     * Listen for keyboard input.
     */

    document.addEventListener(
        "keyup",
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
    wallImage.src ="/static/wall.png";
    blueGhostImage = new Image();
    blueGhostImage.src = "/static/blueGhost.png";
    orangeGhostImage = new Image();
    orangeGhostImage.src = "/static/orangeGhost.png";
    pinkGhostImage = new Image();
    pinkGhostImage.src ="/static/pinkGhost.png";
    redGhostImage = new Image();
    redGhostImage.src = "/static/redGhost.png";
    pacmanUpImage = new Image();
    pacmanUpImage.src ="/static/pacmanUp.png";
    pacmanDownImage = new Image();
    pacmanDownImage.src = "/static/pacmanDown.png";
    pacmanLeftImage = new Image();
    pacmanLeftImage.src = "/static/pacmanLeft.png";
    pacmanRightImage = new Image();
    pacmanRightImage.src = "/static/pacmanRight.png";

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

            else if (tile === " ") {

                const food =
                    new Block(
                        null,
                        x + 14,
                        y + 14,
                        4,
                        4
                    );

                foods.add(food);

            }

        }

    }

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


    move();

    draw();


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

        context.drawImage(
            ghost.image,
            ghost.x,
            ghost.y,
            ghost.width,
            ghost.height
        );

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

}


// ============================================================
// MOVEMENT
// ============================================================

function move() {

    if (!pacman) {
        return;
    }


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
     * Ghost movement
     */

    for (let ghost of ghosts.values()) {


        /*
         * Check collision BEFORE moving ghost.
         */

        if (
            collision(
                ghost,
                pacman
            )
        ) {

            triggerQuestion(
                ghost
            );

            return;

        }


        /*
         * Move ghost.
         */

        ghost.x +=
            ghost.velocityX;

        ghost.y +=
            ghost.velocityY;


        /*
         * Check ghost collision with walls.
         */

        for (let wall of walls.values()) {

            if (
                collision(
                    ghost,
                    wall
                ) ||
                ghost.x <= 0 ||
                ghost.x + ghost.width >= boardWidth
            ) {

                ghost.x -=
                    ghost.velocityX;

                ghost.y -=
                    ghost.velocityY;


                const newDirection =
                    directions[
                        Math.floor(
                            Math.random() *
                            directions.length
                        )
                    ];


                ghost.updateDirection(
                    newDirection
                );

                break;

            }

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

            score += 10;

            break;

        }

    }


    if (foodEaten) {

        foods.delete(
            foodEaten
        );

    }


    /*
     * If all food is eaten,
     * reset the board.
     */

    if (foods.size === 0) {

        loadMap();

        resetPositions();

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


    if (
        event.code === "ArrowUp" ||
        event.code === "KeyW"
    ) {

        pacman.updateDirection("U");

    }


    else if (
        event.code === "ArrowDown" ||
        event.code === "KeyS"
    ) {

        pacman.updateDirection("D");

    }


    else if (
        event.code === "ArrowLeft" ||
        event.code === "KeyA"
    ) {

        pacman.updateDirection("L");

    }


    else if (
        event.code === "ArrowRight" ||
        event.code === "KeyD"
    ) {

        pacman.updateDirection("R");

    }


    /*
     * Change Pac-Man image.
     */

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


    for (let ghost of ghosts.values()) {

        ghost.reset();


        const newDirection =
            directions[
                Math.floor(
                    Math.random() *
                    directions.length
                )
            ];


        ghost.updateDirection(
            newDirection
        );

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

    if (currentQuestion.number) {

        questionNumber.textContent =
            `Question ${currentQuestion.number}`;

    }


    /*
     * Display score.
     */

    scoreDisplay.textContent =
        `Score: ${score}`;


    /*
     * Create answer buttons.
     */

    currentQuestion.options.forEach(
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
// ANSWER QUESTION
// ============================================================

async function answerQuestion(
    selectedAnswer,
    selectedButton
) {

    /*
     * Disable every option.
     */

    const buttons =
        document.querySelectorAll(
            ".option-button"
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

                        answer:
                            selectedAnswer

                    })
                }
            );


        const data =
            await response.json();


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
                "Correct! You defeated the ghost!";


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
                `Incorrect. The correct answer is: ${data.correct_answer}`;


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

}


// ============================================================
// CORRECT ANSWER
// ============================================================

function handleCorrectAnswer(data) {

    /*
     * Update score from backend.
     */
    if (typeof data.score === "number") {
        score = data.score;
    }


    /*
     * Ghost defeated.
     */
    defeatedGhosts++;


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
     * Hide question screen.
     */
    document
        .getElementById("question-screen")
        .classList.add("hidden");


    /*
     * Check whether all ghosts are defeated.
     */
    if (defeatedGhosts >= totalGhosts) {

        endPacmanGame();

        return;

    }


    /*
     * Resume Pac-Man.
     */
    questionActive = false;


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

        const newDirection =
            directions[
                Math.floor(
                    Math.random() *
                    directions.length
                )
            ];

        ghost.updateDirection(
            newDirection
        );

    }


    /*
     * Resume game loop.
     */
    update();

}


// ============================================================
// WRONG ANSWER
// ============================================================

function handleWrongAnswer(data) {

    /*
     * Keep the SAME question queued up for retry.
     */
    if (data.retry_question) {
        currentQuestion = data.retry_question;
    }

    /*
     * Prefer the AI-generated remediation explanation.
     * Fall back to a generic prompt if none was returned.
     */
    const explanation =
        data.remediation?.explanation?.trim() ||
        `Think about how ${data.concept} connects to ${topic}, then reconsider your choice.`;

    /*
     * Fill in and show the popup.
     */
    document.getElementById(
        "concept-popup-explanation"
    ).textContent = explanation;

    const popup =
        document.getElementById("concept-popup");

    popup.classList.remove("hidden");


    /*
     * Keep the question "active" — Pac-Man
     * stays frozen until the student
     * dismisses the popup.
     */
    questionActive = true;


    /*
     * Move focus to the retry button
     * for keyboard/accessibility users.
     */
    document.getElementById(
        "retry-after-explanation"
    ).focus();

}


// ============================================================
// END GAME
// ============================================================

function endPacmanGame() {

    gameStarted = false;

    gameOver = true;

    questionActive = false;


    /*
     * Hide question/game.
     */

    document
        .getElementById("question-screen")
        .classList.add("hidden");


    document
        .getElementById("game-screen")
        .classList.add("hidden");


    /*
     * Show results.
     */

    document
        .getElementById("game-over-screen")
        .classList.remove("hidden");


    document
        .getElementById("final-score")
        .textContent =
        `You defeated all four ghosts! Final score: ${score}`;

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
    }
}
function renderLearningReport(data) {
    document.getElementById("report-topic").textContent = data.topic;

    const overallFill =
        document.getElementById("report-overall-fill");
    overallFill.style.width = `${data.overall_mastery}%`;
    overallFill.innerHTML =
        `<span class="mastery-fill-label">${data.overall_mastery}%</span>`;

    const conceptsContainer =
        document.getElementById("report-concepts");
    conceptsContainer.innerHTML = "";

    const chart = document.createElement("div");
    chart.classList.add("bar-chart");

    // y-axis title (rotated, runs down the left side)
    const yAxisTitle = document.createElement("div");
    yAxisTitle.classList.add("bar-chart-y-title");
    yAxisTitle.textContent = "Concept";
    chart.appendChild(yAxisTitle);

    const plotArea = document.createElement("div");
    plotArea.classList.add("bar-chart-plot");

    // one row per concept
    data.concepts.forEach(function (concept) {
        const row = document.createElement("div");
        row.classList.add("bar-row");
        row.innerHTML = `
            <span class="bar-row-label">${concept.concept}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width:${concept.mastery}%">
                    <span class="bar-fill-label">${concept.mastery}%</span>
                </div>
            </div>
        `;
        plotArea.appendChild(row);
    });

    // x-axis ticks (0/25/50/75/100)
    const axisRow = document.createElement("div");
    axisRow.classList.add("bar-axis-row");
    axisRow.innerHTML = `
        <span class="bar-row-label"></span>
        <div class="bar-axis-ticks">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
    `;
    plotArea.appendChild(axisRow);

    // x-axis title
    const xAxisTitle = document.createElement("div");
    xAxisTitle.classList.add("bar-chart-x-title");
    xAxisTitle.textContent = "Mastery (%)";
    plotArea.appendChild(xAxisTitle);

    chart.appendChild(plotArea);
    conceptsContainer.appendChild(chart);

    const recBox =
        document.getElementById("report-recommendation");
    const recText =
        document.getElementById("report-recommendation-text");

    if (data.recommended_review) {
        recText.textContent =
            `Practice "${data.recommended_review.concept}" next.`;
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
    if (!userId) {
        alert("Please log in first.");
        return;
    }

    try {
        const response = await fetch(`/user-history/${userId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not load progress.");
        }

        renderDashboard(data.history);

        document.getElementById("start-screen").classList.add("hidden");
        document.getElementById("dashboard-screen").classList.remove("hidden");

    } catch (error) {
        console.error("DASHBOARD ERROR:", error);
        alert(error.message);
    }
}

function renderDashboard(history) {
    const container =
        document.getElementById("dashboard-topics");
    container.innerHTML = "";

    if (!history || history.length === 0) {
        container.innerHTML =
            "<p>You haven't completed any topics yet.</p>";
        return;
    }

    history.forEach(function (topicData) {

        const topicCard = document.createElement("div");
        topicCard.classList.add("topic-card");

        const header = document.createElement("button");
        header.type = "button";
        header.classList.add("topic-header");
        header.innerHTML = `
            <span>${topicData.topic}</span>
            <span>${topicData.overall_mastery}% &#9662;</span>
        `;

        const conceptList = document.createElement("div");
        conceptList.classList.add("topic-concepts", "hidden");

        // chart wrapper (y-axis title + plot area)
        const chart = document.createElement("div");
        chart.classList.add("bar-chart");

        const yAxisTitle = document.createElement("div");
        yAxisTitle.classList.add("bar-chart-y-title");
        yAxisTitle.textContent = "Concept";
        chart.appendChild(yAxisTitle);

        const plotArea = document.createElement("div");
        plotArea.classList.add("bar-chart-plot");

        topicData.concepts.forEach(function (concept) {
            const row = document.createElement("div");
            row.classList.add("bar-row");
            row.innerHTML = `
                <span class="bar-row-label">${concept.concept}</span>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${concept.mastery}%">
                        <span class="bar-fill-label">${concept.mastery}%</span>
                    </div>
                </div>
            `;
            plotArea.appendChild(row);
        });

        // x-axis ticks
        const axisRow = document.createElement("div");
        axisRow.classList.add("bar-axis-row");
        axisRow.innerHTML = `
            <span class="bar-row-label"></span>
            <div class="bar-axis-ticks">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
        `;
        plotArea.appendChild(axisRow);

        // x-axis title
        const xAxisTitle = document.createElement("div");
        xAxisTitle.classList.add("bar-chart-x-title");
        xAxisTitle.textContent = "Mastery (%)";
        plotArea.appendChild(xAxisTitle);

        chart.appendChild(plotArea);
        conceptList.appendChild(chart);

        header.addEventListener("click", function () {
            conceptList.classList.toggle("hidden");
        });

        topicCard.appendChild(header);
        topicCard.appendChild(conceptList);
        container.appendChild(topicCard);
    });
}
// ============================================================
// RESTART
// ============================================================

function setupRestartButton() {

    const button =
        document.getElementById(
            "restart-button"
        );


    button.addEventListener(
        "click",
        function () {

            location.reload();

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