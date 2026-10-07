from flask import Flask, request, jsonify, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash
from contextlib import closing
from functools import partial, wraps
import random
import secrets
from concurrent.futures import ThreadPoolExecutor
import threading
import uuid
import os

from db import get_db, init_db
from gemini_api import (
    generate_checkpoint_questions,
    generate_remediation,
    grade_free_response,
    MAX_FREE_RESPONSE_LENGTH
)
from packages import (
    find_or_create_topic,
    load_package,
    question_from_row,
    save_remediation_question
)
from mastery import DIFFICULTY_BY_TYPE
from student_model import (
    adaptive_difficulty,
    record_attempt,
    get_topic_model,
    get_struggles,
    get_session_gain,
    get_progress,
    average_gain
)

app = Flask(__name__, instance_relative_config=True)

def load_secret_key():
    key = os.getenv("FLASK_SECRET_KEY")

    if key:
        return key

    os.makedirs(app.instance_path, exist_ok=True)
    key_path = os.path.join(app.instance_path, "secret_key")

    if not os.path.exists(key_path):
        with open(key_path, "w") as f:
            f.write(secrets.token_hex(32))

    with open(key_path) as f:
        return f.read().strip()


app.secret_key = load_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax"
)

games = {}


def current_user_id():
    return session.get("user_id")


def error(message, status):
    """A JSON error response: {"error": message} with this status."""
    return jsonify({"error": message}), status


def login_required(view):
    """Reject the request with 401 unless someone is signed in."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user_id():
            return error("Please sign in first.", 401)
        return view(*args, **kwargs)
    return wrapped


def json_required(view):
    """Reject the request with 400 unless it has a JSON body; the view
    receives the body as its first argument."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        data = request.get_json()
        if not data:
            return error("No data received.", 400)
        return view(data, *args, **kwargs)
    return wrapped


def get_own_game(game_id):
    """The game with this id, if it belongs to the signed-in user."""
    game = games.get(game_id)

    if not game or game["user_id"] != current_user_id():
        return None

    return game


def with_own_game(view):
    """For routes that act on one of the signed-in user's games: the
    view receives the request body and that game, or the request gets
    404 if the game_id isn't one of theirs."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        data = request.get_json() or {}
        game = get_own_game(data.get("game_id"))
        if not game:
            return error("Game not found.", 404)
        return view(data, game, *args, **kwargs)
    return wrapped


# ------------------------------------------------------------
# Game state helpers
# ------------------------------------------------------------

def active_question(game):
    """The question the student is on: during a Game Over checkpoint
    the checkpoint's current question, otherwise the game's."""
    checkpoint = game.get("checkpoint")

    if checkpoint:
        return checkpoint["questions"][checkpoint["index"]]

    return game["current_question"]


def replace_active_question(game, question):
    """Put `question` where active_question(game) is."""
    checkpoint = game.get("checkpoint")

    if checkpoint:
        checkpoint["questions"][checkpoint["index"]] = question
    else:
        game["current_question"] = question


def clear_explanation(game):
    """The next question starts without an explanation."""
    game["explained"] = False
    game.pop("pending_remediation", None)


def game_question(question, is_boss=False, is_remediation=False, **extra):
    """A copy of a saved question with the flags every question in a
    game carries (plus `extra`, e.g. checkpoint numbering)."""
    return dict(
        question, is_boss=is_boss, is_remediation=is_remediation, **extra
    )


def answered_in_game(game_id):
    """Ids of the questions answered (right or wrong) in this game."""
    with closing(get_db()) as conn:
        return {
            row["question_id"] for row in conn.execute(
                "SELECT DISTINCT question_id FROM attempts "
                "WHERE session_id = ?",
                (game_id,)
            )
        }



@app.route("/")
def home():

    return render_template("index.html")


@app.route("/login", methods=["POST"])
@json_required
def login(data):

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email:
        return error("Email is required.", 400)

    if not password:
        return error("Password is required.", 400)

    with closing(get_db()) as conn, conn:

        user = conn.execute(
            "SELECT user_id, password_hash FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if user:
            # Existing account: the password must match.
            if not check_password_hash(user["password_hash"], password):
                return error("Incorrect password.", 401)

            user_id = user["user_id"]

        else:
            # New account: save the password the user just chose.
            if len(password) < 6:
                return error("Password must be at least 6 characters.", 400)

            cursor = conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)",
                (email, generate_password_hash(password))
            )
            user_id = cursor.lastrowid

    session.clear()
    session["user_id"] = user_id
    session["email"] = email

    return jsonify({
        "email": email
    })


@app.route("/logout", methods=["POST"])
def logout():

    session.clear()

    return "", 204


@app.route("/me")
def me():

    if not current_user_id():
        return error("Not signed in.", 401)

    return jsonify({
        "email": session.get("email")
    })
@app.route("/generate-lesson", methods=["POST"])
@login_required
@json_required
def generate_lesson(data):

    topic = data.get("topic", "").strip()

    if not topic:
        return error("Topic is required.", 400)
    topic_id = find_or_create_topic(topic)

    if not topic_id:
        return error(
            "Could not generate a lesson for that topic. Please try again.",
            500
        )

    package = load_package(topic_id)
    model = get_topic_model(current_user_id(), topic_id)

    return jsonify({
        "topic_id": topic_id,
        "topic": package["title"],
        "explanation": package["explanation"],
        "lesson": package["lesson"],
        "concept_map": concept_map(package["concepts"], model),
        "struggles": [c["name"] for c in get_struggles(model)]
    })


def concept_map(concepts, model):
    """Concept-map metadata joined with the student's mastery."""
    by_id = {c["concept_id"]: c for c in model}

    return [
        {
            "concept_id": concept["concept_id"],
            "name": concept["name"],
            "description": concept["description"],
            "learning_objective": concept["learning_objective"],
            "difficulty": concept["difficulty"],
            "prerequisites": concept["prerequisites"],
            "mastery": by_id[concept["concept_id"]]["mastery"],
            "attempts": by_id[concept["concept_id"]]["attempts"],
            "evidence": by_id[concept["concept_id"]]["evidence"]
        }
        for concept in concepts
    ]

# ============================================================
# START GAME
# ============================================================


def normalized(question):
    return question["question"].strip().lower()


def adaptive_questions(user_id, topic_id, topic_title, concept_ids,
                       exclude_ids):
    """
    One multiple-choice question for each concept in `concept_ids`
    (same order), at the difficulty the student model picks for this
    student on that concept (student_model.adaptive_difficulty).

    A saved question at that difficulty the student has never answered
    comes first; otherwise Gemini writes a new one at that level (side
    by side for several concepts), saved so others can reuse it.
    `exclude_ids`: questions this game has asked or will still ask.

    If Gemini fails, the concept gets the saved question nearest that
    difficulty that this game hasn't used, or None if there isn't one.

    Waits for Gemini and returns the list of questions.
    """
    questions, _ = pick_adaptive_questions(
        user_id, topic_id, topic_title, concept_ids, exclude_ids,
        defer=False
    )

    return questions


def adaptive_questions_deferred(user_id, topic_id, topic_title,
                                concept_ids, exclude_ids):
    """
    Like adaptive_questions(), but doesn't wait for Gemini when the
    first question is ready: the other missing concepts get the
    nearest saved question for now.

    Returns (questions, write_later), where write_later() writes the
    exact-level ones and returns [(index, question)]. write_later is
    None if nothing is left to write.
    """
    return pick_adaptive_questions(
        user_id, topic_id, topic_title, concept_ids, exclude_ids,
        defer=True
    )


def pick_adaptive_questions(user_id, topic_id, topic_title, concept_ids,
                            exclude_ids, defer):
    """
    The shared work behind adaptive_questions() and
    adaptive_questions_deferred(). Always returns (questions,
    write_later); write_later is only set when `defer` is True.
    """
    with closing(get_db()) as conn:

        seen = {
            row["question_id"] for row in conn.execute(
                "SELECT DISTINCT question_id FROM attempts WHERE user_id = ?",
                (user_id,)
            )
        }

        every = [
            (row["source"], question_from_row(row)) for row in conn.execute(
                "SELECT * FROM questions WHERE topic_id = ?", (topic_id,)
            )
        ]

    saved = [
        q for source, q in every
        if not (source == "package" and q["question_type"] == "transfer")
    ]

    used = seen | set(exclude_ids)

    used_texts = {normalized(q) for _, q in every if q["question_id"] in used}

    chosen = [None] * len(concept_ids)
    to_write = []

    for index, concept_id in enumerate(concept_ids):

        difficulty, familiarity = adaptive_difficulty(user_id, concept_id)

        candidates = [
            q for q in saved
            if q["concept_id"] == concept_id
            and q["difficulty"] == difficulty
            and q["question_id"] not in used
            and normalized(q) not in used_texts
        ]

        if candidates:
            chosen[index] = random.choice(candidates)
        else:
            to_write.append((index, concept_id, difficulty, familiarity))

    if not to_write:
        return chosen, None

    package = load_package(topic_id)

    concepts = {
        c["concept_id"]: {
            "id": c["slug"],
            "name": c["name"],
            "learning_objective": c["learning_objective"]
        }
        for c in package["concepts"]
    }

    write_all = partial(
        write_questions, topic_id, topic_title, concepts, every, to_write
    )

    # The first question is sent to the student straight away, so it
    # can't be swapped later: if it's missing, wait for all of them.
    if defer and chosen[0] is not None:
        for index, concept_id, difficulty, _ in to_write:
            chosen[index] = nearest_saved(
                saved, exclude_ids, concept_id, difficulty
            )

        return chosen, write_all

    written = dict(write_all())

    for index, concept_id, difficulty, _ in to_write:
        chosen[index] = (
            written.get(index)
            or nearest_saved(saved, exclude_ids, concept_id, difficulty)
        )

    return chosen, None


def write_question(topic_title, concepts, every, concept_id, difficulty,
                   familiarity):
    """Gemini writes one new question on this concept at this
    difficulty, unlike every saved question on it."""
    avoid = sorted({
        normalized(q) for _, q in every if q["concept_id"] == concept_id
    })

    return generate_checkpoint_questions(
        topic_title, [concepts[concept_id]], avoid, 1,
        difficulty=difficulty, familiarity=familiarity
    )


def write_questions(topic_id, topic_title, concepts, every, to_write):
    """
    Write a question for each (index, concept_id, difficulty,
    familiarity) in `to_write`, save them, and return [(index,
    question)] for the ones Gemini managed to write.
    """

    # Side by side, so the wait is one Gemini call, not several.
    with ThreadPoolExecutor(max_workers=len(to_write)) as executor:
        results = list(executor.map(
            lambda item: write_question(
                topic_title, concepts, every, *item[1:]
            ),
            to_write
        ))

    written = []

    for (index, concept_id, _, _), result in zip(to_write, results):

        if result:
            q = result[0]
            written.append((index, save_remediation_question(
                topic_id,
                concept_id,
                q["question_type"],
                DIFFICULTY_BY_TYPE[q["question_type"]],
                q
            )))

    return written


def nearest_saved(saved, exclude_ids, concept_id, difficulty):
    """The saved question on this concept nearest this difficulty that
    the game isn't using, or None if there isn't one."""
    fallback = [
        q for q in saved
        if q["concept_id"] == concept_id
        and q["question_id"] not in exclude_ids
    ]

    if not fallback:
        return None

    return min(
        fallback, key=lambda q: abs(q["difficulty"] - difficulty)
    )


def upgrade_queued_questions(game, stand_ins, write_later):
    """
    Background part of /start-game: write the exact-level ghost
    questions, and swap each in for its stand-in if that ghost hasn't
    asked it yet. A question already asked stays as it was.
    """
    try:
        written = write_later()
    except Exception as e:
        print("ADAPTIVE QUESTION ERROR:", e)
        return

    with game["lock"]:

        queue = game["question_queue"]

        for index, question in written:
            for position, queued in enumerate(queue):
                if queued is stand_ins[index]:
                    queue[position] = game_question(question)


@app.route("/start-game", methods=["POST"])
@login_required
@json_required
def start_game(data):

    package = load_package(data.get("topic_id"))

    if not package:
        return error("Search a topic before starting the game.", 400)

    # Questions 1-4 are the four ghosts, one per concept in the
    # package's order, each at the difficulty that fits this student
    # on that concept. The last one (the package's transfer question)
    # is the Boss Ghost.
    questions = package["questions"]

    # Play starts at once when the first ghost's question is saved: a
    # later concept with no saved question at the student's level gets
    # the nearest saved one for now, and the exact-level question is
    # written in the background and swapped in (below).
    ghost_questions, write_later = adaptive_questions_deferred(
        current_user_id(),
        package["topic_id"],
        package["title"],
        [q["concept_id"] for q in questions[:4]],
        set()
    )

    # No question at all (Gemini down): the package's own question.
    questions = [
        game_question(adaptive or original)
        for adaptive, original in zip(ghost_questions, questions[:4])
    ] + [game_question(questions[-1], is_boss=True)]

    concept_names = {
        c["concept_id"]: c["name"] for c in package["concepts"]
    }

    game_id = str(uuid.uuid4())

    game = {
        "user_id": current_user_id(),
        "topic_id": package["topic_id"],
        "topic": package["title"],
        "concept_names": concept_names,
        "question_queue": questions[1:],
        "current_question": questions[0],
        "number": 1,
        "total": len(questions),
        "complete": False,
        "score": 0,
        # True once the current question was answered wrong and
        # explained, so the retry is recorded as assisted.
        "explained": False,
        "lock": threading.Lock()
    }

    games[game_id] = game

    if write_later:
        threading.Thread(
            target=upgrade_queued_questions,
            args=(game, questions[:4], write_later),
            daemon=True
        ).start()

    return jsonify({
        "game_id": game_id,
        "topic": package["title"],
        "question": get_public_question(questions[0], game)
    })

# ============================================================
# CHECK ANSWER
# ============================================================

@app.route("/check-answer", methods=["POST"])
@login_required
@json_required
def check_answer(data):

    game_id = data.get("game_id")
    question_id = data.get("question_id")
    user_answer = data.get("answer")

    if not game_id or not question_id:
        return error("Game ID and question ID are required.", 400)

    game = get_own_game(game_id)

    if not game:
        return error("Game not found.", 404)

    # One answer at a time per game: a second request for the same
    # game waits here, then fails the question check below.
    with game["lock"]:
        return grade_answer(game_id, game, question_id, user_answer)


def grade_answer(game_id, game, question_id, user_answer):

    # During a Game Over checkpoint the student answers the checkpoint's
    # questions; the game's own current question waits untouched.
    checkpoint = game.get("checkpoint")

    current_question = active_question(game)

    # The answer must be for the question the student is looking at.
    # A double click, a retried request or an old tab would otherwise
    # grade the same question twice or skip ahead.
    if not current_question or current_question["question_id"] != question_id:
        return jsonify({
            "error": "That question was already answered.",
            "game_complete": game["complete"],
            "current_question": (
                get_public_question(current_question, game)
                if current_question else None
            )
        }), 409

    # --------------------------------------------------------
    # Grade and update the student model
    # --------------------------------------------------------

    concept = game["concept_names"][current_question["concept_id"]]
    grading = None

    if current_question["is_boss"]:

        # Boss Ghost: a typed answer, graded by Gemini against the
        # reference answer, which never leaves the server.
        problem = free_response_problem(user_answer)

        if problem:
            return error(problem, 400)

        grading = grade_boss_answer(
            game, concept, current_question, user_answer
        )

        if grading is None:
            # Nothing is recorded, so the student can simply resubmit.
            return error(
                "Your answer couldn't be graded right now. Please try again.",
                503
            )

        correct = grading["correct"]

    else:

        correct = user_answer == current_question["answer"]

    result = record_attempt(
        current_user_id(),
        game_id,
        current_question,
        correct,
        # A retry comes right after an explanation of this concept.
        assisted=game["explained"]
    )

    # Checkpoint answers are recorded above like any answer, but don't
    # count toward the game's own questions.
    if correct and not checkpoint:
        game["score"] += 1

    response = answer_response(
        game, current_question, concept, correct, grading, result
    )

    if not correct:
        retry_after_explanation(game, current_question, concept,
                                user_answer, response)

    elif checkpoint:
        clear_explanation(game)
        advance_checkpoint(game, checkpoint, response)

    else:
        clear_explanation(game)
        advance_game(game, response)

    return jsonify(response)


def free_response_problem(user_answer):
    """Why a typed Boss answer can't be graded, or None if it can."""
    if not isinstance(user_answer, str) or not user_answer.strip():
        return "Type your answer before submitting."

    if len(user_answer) > MAX_FREE_RESPONSE_LENGTH:
        return f"Keep your answer under {MAX_FREE_RESPONSE_LENGTH} characters."

    return None


def grade_boss_answer(game, concept, question, user_answer):
    """Gemini's grade for a typed Boss answer, or None if it failed."""
    return grade_free_response(
        game["topic"],
        concept,
        question["question"],
        question["answer"],
        # The grading prompt fences the answer with <<< >>>;
        # don't let the answer close that fence itself.
        user_answer.replace("<<<", "").replace(">>>", "").strip()
    )


def answer_response(game, question, concept, correct, grading, result):
    """The /check-answer response before the next step is filled in."""
    return {
        "correct": correct,
        # The Boss question's reference answer stays on the server.
        "correct_answer": (
            None if question["is_boss"]
            else question["answer"]
        ),
        "grading": (
            {
                "feedback": grading["feedback"],
                "concept_understood": grading["concept_understood"],
                "missing_idea": grading["missing_idea"]
            }
            if grading else None
        ),
        "score": game["score"],
        "concept": concept,
        "mastery": {
            "before": result["before"],
            "after": result["after"]
        },
        "needs_help": not correct,
        "remediation": None,
        "next_question": None,
        "retry_question": None,
        "retry": False,
        "game_complete": False
    }


def retry_after_explanation(game, question, concept, user_answer,
                            response):
    """
    WRONG ANSWER: explain the concept, then retry the SAME question.
    The current question and the queue are left untouched, so nothing
    is consumed and the number stays.
    """
    game["explained"] = True

    # Gemini takes a few seconds to write the explanation, so the
    # verdict isn't held back for it: the browser shows "Not quite"
    # straight away and fetches the explanation from /remediation.
    game["pending_remediation"] = {
        "question_id": question["question_id"],
        "concept": concept,
        "question": question["question"],
        # The Boss answer is free text; its grading feedback
        # already responds to what the student wrote.
        "student_answer": (
            None if question["is_boss"] else user_answer
        ),
        "explanation": None
    }

    # The retry question IS the original question.
    response["retry"] = True
    response["retry_question"] = get_public_question(question, game)
    response["explanation_pending"] = True


def advance_checkpoint(game, checkpoint, response):
    """CORRECT CHECKPOINT ANSWER: the next checkpoint question, or back
    to the game after the last one."""
    checkpoint["index"] += 1
    response["checkpoint"] = True

    if checkpoint["index"] == len(checkpoint["questions"]):

        game["checkpoint"] = None
        response["checkpoint_complete"] = True
        response["current_question"] = (
            get_public_question(game["current_question"], game)
            if game["current_question"] else None
        )

    else:

        response["next_question"] = get_public_question(
            checkpoint["questions"][checkpoint["index"]], game
        )


def advance_game(game, response):
    """CORRECT ANSWER: move to the next question, or finish the game
    after the Boss's."""
    if game["question_queue"]:

        next_question = game["question_queue"].pop(0)
        game["current_question"] = next_question
        game["number"] += 1

        response["next_question"] = get_public_question(
            next_question, game
        )

    else:

        # Only reached after the boss question is answered correctly.
        game["current_question"] = None
        game["complete"] = True
        response["game_complete"] = True


# ============================================================
# EXPLANATION FOR A WRONG ANSWER
# ============================================================
# Requested by the browser right after /check-answer says "wrong",
# so the verdict shows at once and the Gemini call happens here.

@app.route("/remediation", methods=["POST"])
@login_required
@with_own_game
def remediation(data, game):

    with game["lock"]:
        pending = game.get("pending_remediation")

        if not pending or pending["question_id"] != data.get("question_id"):
            return error("No explanation is waiting for that question.", 409)

        if pending["explanation"] is not None:
            return jsonify({
                "explanation": pending["explanation"],
                "question": pending.get("follow_up")
            })

        request_info = dict(pending)

        checkpoint = game.get("checkpoint")

        missed = active_question(game)

        # Questions this game has asked or will ask, so the follow-up
        # is new to it.
        exclude = {
            q["question_id"] for q in [
                missed,
                *game["question_queue"],
                *(checkpoint["questions"] if checkpoint else [])
            ]
        }

    exclude |= answered_in_game(data.get("game_id"))

    def explain():
        try:
            return generate_remediation(
                game["topic"],
                request_info["concept"],
                request_info["question"],
                student_answer=request_info["student_answer"]
            )
        except Exception as e:
            print("REMEDIATION ERROR:", e)
            return None

    # A new question on the same concept, at the difficulty the student
    # model picks now that the miss is recorded. The Boss keeps its
    # own question.
    def follow_up():
        if missed["is_boss"]:
            return None
        try:
            return adaptive_questions(
                game["user_id"], game["topic_id"], game["topic"],
                [missed["concept_id"]], exclude
            )[0]
        except Exception as e:
            print("FOLLOW-UP ERROR:", e)
            return None

    # Outside the lock, side by side: slow Gemini calls shouldn't hold
    # up the game, and the student waits for one, not two.
    with ThreadPoolExecutor(max_workers=2) as executor:
        explaining = executor.submit(explain)
        following = executor.submit(follow_up)
        result = explaining.result()
        new_question = following.result()

    explanation = (result or {}).get("explanation") or ""

    # Remember them, unless the student has moved on meanwhile. The
    # follow-up replaces the missed question; without one (Boss, or
    # nothing could be prepared) the student retries the same question.
    with game["lock"]:
        if game.get("pending_remediation") is pending:
            pending["explanation"] = explanation

            if new_question and active_question(game) is missed:
                new_question = game_question(
                    new_question,
                    is_remediation=True,
                    checkpoint=missed.get("checkpoint")
                )

                replace_active_question(game, new_question)

                pending["follow_up"] = get_public_question(new_question, game)

    return jsonify({
        "explanation": explanation,
        "question": pending.get("follow_up")
    })


# ============================================================
# GAME OVER CHECKPOINT
# ============================================================
# "Continue Playing" after Game Over: answer 3 questions correctly
# first. They come from this topic's saved package (no Gemini call)
# and are graded and recorded by /check-answer like any question.

CHECKPOINT_SIZE = 3

@app.route("/checkpoint/start", methods=["POST"])
@login_required
@with_own_game
def start_checkpoint(data, game):

    with game["lock"]:

        if game["complete"]:
            return error("This game is already finished.", 400)

        # Every question this game has already asked (answered, right
        # or wrong, including earlier checkpoints) or will still ask
        # (the one waiting, the remaining ghosts' and the Boss's).
        answered = answered_in_game(data.get("game_id"))

        upcoming = [game["current_question"], *game["question_queue"]]

        used_ids = answered | {q["question_id"] for q in upcoming if q}

        # One question for each of the student's 3 lowest concepts, by
        # the student model's current mastery. Concepts never practiced
        # have no mastery yet and aren't ranked.
        model = get_topic_model(game["user_id"], game["topic_id"])

        lowest = sorted(
            (c for c in model if c["mastery"] is not None),
            key=lambda c: c["mastery"]
        )[:CHECKPOINT_SIZE]

        targets = [c["concept_id"] for c in lowest]

        # Fewer than 3 concepts with mastery: fill the rest as before,
        # with other concepts, one question per concept.
        others = [
            c["concept_id"] for c in model if c["concept_id"] not in targets
        ]

        random.shuffle(others)

        targets += others[:CHECKPOINT_SIZE - len(targets)]

        user_id = game["user_id"]
        topic_id = game["topic_id"]
        topic_title = game["topic"]

    # Each at the difficulty that fits the student on that concept: a
    # saved question they haven't answered, or a new one from Gemini
    # (outside the lock: it takes a few seconds). New ones are saved,
    # graded and recorded like any other; answers stay on the server.
    chosen = adaptive_questions(
        user_id, topic_id, topic_title, targets, used_ids
    )

    if not all(chosen):
        return error(
            "Couldn't prepare new questions right now. Please try again.",
            503
        )

    with game["lock"]:

        if game["complete"]:
            return error("This game is already finished.", 400)

        chosen = [
            game_question(
                question,
                checkpoint={"number": number, "total": len(chosen)}
            )
            for number, question in enumerate(chosen, start=1)
        ]

        game["checkpoint"] = {"questions": chosen, "index": 0}
        clear_explanation(game)

        return jsonify({
            "question": get_public_question(chosen[0], game)
        })


# ============================================================
# BOSS (after the last white pellet is eaten)
# ============================================================
# The Boss Ghost arrives when Pac-Man clears the maze, whichever ghost
# questions are still left. The game moves straight on to its Boss
# (transfer) question, which is the game's final question as before.

@app.route("/boss/start", methods=["POST"])
@login_required
@with_own_game
def start_boss(_data, game):

    with game["lock"]:

        if game["complete"] or game.get("checkpoint"):
            return error("The Boss can't start right now.", 409)

        if not game["current_question"]["is_boss"]:

            # The Boss question is always the last one queued.
            game["current_question"] = game["question_queue"][-1]
            game["question_queue"] = []
            game["number"] = game["total"]
            clear_explanation(game)

        return jsonify({
            "question": get_public_question(game["current_question"], game)
        })


# ============================================================
# PUBLIC QUESTION (never includes the answer)
# ============================================================

def get_public_question(question, game):
    # The Boss Ghost's question is free response: no options are sent,
    # so the browser shows a text box instead of answer buttons.
    is_free_response = question["is_boss"]

    # Options are shown in a random order, fixed for this game: the
    # stored order often has the answer first. Answers are still
    # checked by their text, here on the server.
    if not is_free_response and "display_options" not in question:
        question["display_options"] = random.sample(
            question["options"], len(question["options"])
        )

    return {
        "question_id": question["question_id"],
        "question": question["question"],
        "format": "frq" if is_free_response else "mcq",
        "options": [] if is_free_response else question["display_options"],
        "concept": game["concept_names"].get(question["concept_id"], "General"),
        "question_type": question["question_type"],
        "number": game["number"],
        "total": game["total"],
        "is_boss": question["is_boss"],
        "is_remediation": question.get("is_remediation", False),
        # {"number", "total"} for a Game Over checkpoint question
        "checkpoint": question.get("checkpoint")
    }

# ============================================================
# LEARNING REPORT (per game)
# ============================================================

@app.route("/learning-report/<game_id>")
@login_required
def learning_report(game_id):

    # The report is for finished games only. (A game that's no longer
    # in memory after a restart is reported from its saved answers.)
    game = get_own_game(game_id)

    if game and not game["complete"]:
        return error(
            "Finish the game, including the Boss Ghost, to see the report.",
            409
        )

    # Built from the saved attempts, so it still works after a restart.
    concepts = get_session_gain(current_user_id(), game_id)

    if not concepts:
        return error("No answers recorded for this game.", 404)

    with closing(get_db()) as conn:
        topic = conn.execute(
            """
            SELECT t.title FROM topics t
            JOIN concepts c ON c.topic_id = t.topic_id
            WHERE c.concept_id = ?
            """,
            (concepts[0]["concept_id"],)
        ).fetchone()["title"]

    answered = sum(c["attempts"] for c in concepts)
    correct = sum(c["correct"] for c in concepts)

    weakest = min(concepts, key=lambda c: c["after"])

    return jsonify({
        "topic": topic,
        "accuracy": correct / answered,
        "questions_answered": answered,
        "session_gain": average_gain(concepts),
        "concepts": concepts,
        "recommended_review": weakest["name"]
    })


# ============================================================
# MY PROGRESS (the student model, across all topics)
# ============================================================

@app.route("/my-progress")
@login_required
def my_progress():
    return jsonify({
        "topics": get_progress(current_user_id())
    })


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":
    init_db()
    app.run(
        debug=True,
        port=5001
    )
