"""
The student model: what each student knows, concept by concept.

Every answer is stored in `attempts`; `concept_mastery` holds the
current estimate. Recent accuracy, confidence (evidence), difficulty
reached and learning gain are all calculated from those two tables.
"""

from contextlib import closing

import mastery
from db import get_db

# Below this mastery, a practiced concept counts as a struggle.
STRUGGLE_BELOW = 0.50

# How many recent answers "recent accuracy" looks at.
RECENT_WINDOW = 5


# ============================================================
# RECORDING ANSWERS
# ============================================================

def record_attempt(user_id, session_id, question, correct, assisted=False):
    """
    Save one answer and update the student's mastery of its concept.

    `question` is a question dict from packages.py. Returns
    {"concept_id", "before", "after", "attempts"}.
    """
    concept_id = question["concept_id"]
    difficulty = question["difficulty"]

    with closing(get_db()) as conn, conn:

        row = conn.execute(
            "SELECT mastery, attempts FROM concept_mastery "
            "WHERE user_id = ? AND concept_id = ?",
            (user_id, concept_id)
        ).fetchone()

        before = row["mastery"] if row else mastery.STARTING_MASTERY
        previous_attempts = row["attempts"] if row else 0

        after = mastery.update(
            before, previous_attempts, difficulty, correct, assisted
        )

        conn.execute(
            """
            INSERT INTO attempts (user_id, session_id, question_id,
                concept_id, is_correct, difficulty, assisted,
                mastery_before, mastery_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, session_id, question["question_id"], concept_id,
             int(correct), difficulty, int(assisted), before, after)
        )

        conn.execute(
            """
            INSERT INTO concept_mastery (user_id, concept_id, mastery,
                attempts, correct, max_difficulty_correct, last_seen)
            VALUES (?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, concept_id) DO UPDATE SET
                mastery = excluded.mastery,
                attempts = attempts + 1,
                correct = correct + excluded.correct,
                max_difficulty_correct = MAX(max_difficulty_correct,
                                             excluded.max_difficulty_correct),
                last_seen = excluded.last_seen
            """,
            (user_id, concept_id, after, int(correct),
             difficulty if correct else 0)
        )

    return {
        "concept_id": concept_id,
        "before": before,
        "after": after,
        "attempts": previous_attempts + 1
    }


# ============================================================
# READING THE MODEL
# ============================================================

def get_topic_model(user_id, topic_id):
    """
    The student's model for every concept in a topic, in concept-map
    order. Concepts they haven't practiced have attempts = 0 and
    mastery = None.
    """
    with closing(get_db()) as conn:

        rows = conn.execute(
            """
            SELECT c.concept_id, c.name, c.position,
                   m.mastery, m.attempts, m.correct,
                   m.max_difficulty_correct, m.last_seen
            FROM concepts c
            LEFT JOIN concept_mastery m
                   ON m.concept_id = c.concept_id AND m.user_id = ?
            WHERE c.topic_id = ?
            ORDER BY c.position
            """,
            (user_id, topic_id)
        ).fetchall()

        recent = recent_accuracy(conn, user_id, topic_id)
        misconceptions = open_misconceptions(conn, user_id, topic_id)

    model = []

    for row in rows:
        attempts = row["attempts"] or 0
        concept_id = row["concept_id"]

        model.append({
            "concept_id": concept_id,
            "name": row["name"],
            "mastery": row["mastery"] if attempts else None,
            "attempts": attempts,
            "correct": row["correct"] or 0,
            "recent_accuracy": recent.get(concept_id),
            "difficulty_reached": row["max_difficulty_correct"] or 0,
            "evidence": mastery.evidence(attempts),
            "last_seen": row["last_seen"],
            "misconceptions": misconceptions.get(concept_id, [])
        })

    return model


def adaptive_difficulty(user_id, concept_id):
    """
    The difficulty (1-4) for this student's next question on a concept,
    from their mastery and history (mastery.next_difficulty), and a
    short summary of that evidence for the question writer. The summary
    holds only learning data about this concept, nothing personal.

    Returns (difficulty, summary).
    """
    with closing(get_db()) as conn:

        row = conn.execute(
            "SELECT mastery, attempts, correct, max_difficulty_correct "
            "FROM concept_mastery WHERE user_id = ? AND concept_id = ?",
            (user_id, concept_id)
        ).fetchone()

        recent = conn.execute(
            "SELECT is_correct, difficulty, assisted FROM attempts "
            "WHERE user_id = ? AND concept_id = ? "
            "ORDER BY attempt_id DESC LIMIT ?",
            (user_id, concept_id, RECENT_WINDOW)
        ).fetchall()

    current = row["mastery"] if row else mastery.STARTING_MASTERY
    max_solved = row["max_difficulty_correct"] if row else 0

    last = {
        "difficulty": recent[0]["difficulty"],
        "correct": bool(recent[0]["is_correct"]),
        "assisted": bool(recent[0]["assisted"])
    } if recent else None

    accuracy = (
        sum(r["is_correct"] for r in recent) / len(recent)
        if recent else None
    )

    difficulty = mastery.next_difficulty(current, max_solved, last, accuracy)

    summary = {
        "mastery_percent": round(current * 100),
        "answers_so_far": row["attempts"] if row else 0,
        "correct_so_far": row["correct"] if row else 0,
        "recent_accuracy_percent": (
            None if accuracy is None else round(accuracy * 100)
        ),
        "hardest_level_solved": max_solved,
        "last_answer": (
            None if last is None else {
                "level": last["difficulty"],
                "correct": last["correct"],
                "after_an_explanation": last["assisted"]
            }
        )
    }

    return difficulty, summary


def recent_accuracy(conn, user_id, topic_id):
    """{concept_id: share of the last RECENT_WINDOW answers that were right}"""
    rows = conn.execute(
        """
        SELECT concept_id, AVG(is_correct) AS accuracy
        FROM (
            SELECT a.concept_id, a.is_correct,
                   ROW_NUMBER() OVER (
                       PARTITION BY a.concept_id
                       ORDER BY a.attempt_id DESC
                   ) AS n
            FROM attempts a
            JOIN concepts c ON c.concept_id = a.concept_id
            WHERE a.user_id = ? AND c.topic_id = ?
        )
        WHERE n <= ?
        GROUP BY concept_id
        """,
        (user_id, topic_id, RECENT_WINDOW)
    ).fetchall()

    return {row["concept_id"]: row["accuracy"] for row in rows}


def open_misconceptions(conn, user_id, topic_id):
    """{concept_id: [labels]} for misconceptions not yet resolved."""
    rows = conn.execute(
        """
        SELECT s.concept_id, s.label, s.status
        FROM student_misconceptions s
        JOIN concepts c ON c.concept_id = s.concept_id
        WHERE s.user_id = ? AND c.topic_id = ? AND s.status != 'resolved'
        ORDER BY s.last_seen DESC
        """,
        (user_id, topic_id)
    ).fetchall()

    result = {}

    for row in rows:
        result.setdefault(row["concept_id"], []).append(
            {"label": row["label"], "status": row["status"]}
        )

    return result


def get_struggles(model):
    """
    What the student is currently struggling with, weakest first:
    concepts below STRUGGLE_BELOW mastery that they've missed recently,
    and any concept with an unresolved misconception.

    Low mastery alone isn't enough: one right answer on a new concept
    can still leave it under 50%, and that isn't a struggle.
    """
    struggles = [
        concept for concept in model
        if concept["attempts"] and (
            concept["misconceptions"]
            or (
                concept["mastery"] < STRUGGLE_BELOW
                and concept["recent_accuracy"] < 1
            )
        )
    ]

    return sorted(struggles, key=lambda concept: concept["mastery"])


def get_session_gain(user_id, session_id):
    """
    Mastery change per concept during one game session:
    [{concept_id, name, before, after, attempts, correct}] in
    concept-map order.
    """
    with closing(get_db()) as conn:
        rows = conn.execute(
            """
            SELECT a.concept_id, c.name, c.position,
                   COUNT(*) AS attempts,
                   SUM(a.is_correct) AS correct,
                   MIN(a.attempt_id) AS first_attempt,
                   MAX(a.attempt_id) AS last_attempt
            FROM attempts a
            JOIN concepts c ON c.concept_id = a.concept_id
            WHERE a.user_id = ? AND a.session_id = ?
            GROUP BY a.concept_id
            ORDER BY c.position
            """,
            (user_id, session_id)
        ).fetchall()

        gains = []

        for row in rows:
            before = conn.execute(
                "SELECT mastery_before FROM attempts WHERE attempt_id = ?",
                (row["first_attempt"],)
            ).fetchone()["mastery_before"]

            after = conn.execute(
                "SELECT mastery_after FROM attempts WHERE attempt_id = ?",
                (row["last_attempt"],)
            ).fetchone()["mastery_after"]

            gains.append({
                "concept_id": row["concept_id"],
                "name": row["name"],
                "before": before,
                "after": after,
                "attempts": row["attempts"],
                "correct": row["correct"]
            })

    return gains


def get_progress(user_id):
    """
    Everything for the My Progress dashboard: one entry per topic the
    student has practiced, most recent first.
    """
    with closing(get_db()) as conn:
        topics = conn.execute(
            """
            SELECT t.topic_id, t.title,
                   COUNT(*) AS questions_answered,
                   MAX(a.attempt_id) AS last_attempt
            FROM attempts a
            JOIN concepts c ON c.concept_id = a.concept_id
            JOIN topics t ON t.topic_id = c.topic_id
            WHERE a.user_id = ?
            GROUP BY t.topic_id
            ORDER BY last_attempt DESC
            """,
            (user_id,)
        ).fetchall()

        last_sessions = {
            row["topic_id"]: row["session_id"]
            for row in conn.execute(
                """
                SELECT c.topic_id, a.session_id
                FROM attempts a
                JOIN concepts c ON c.concept_id = a.concept_id
                WHERE a.attempt_id IN (
                    SELECT MAX(a2.attempt_id)
                    FROM attempts a2
                    JOIN concepts c2 ON c2.concept_id = a2.concept_id
                    WHERE a2.user_id = ?
                    GROUP BY c2.topic_id
                )
                """,
                (user_id,)
            ).fetchall()
        }

    progress = []

    for topic in topics:
        model = get_topic_model(user_id, topic["topic_id"])
        practiced = [c for c in model if c["attempts"]]

        overall = (
            sum(c["mastery"] for c in practiced) / len(practiced)
            if practiced else None
        )

        gains = get_session_gain(
            user_id, last_sessions.get(topic["topic_id"])
        )

        progress.append({
            "topic_id": topic["topic_id"],
            "title": topic["title"],
            "overall_mastery": overall,
            "concepts_practiced": len(practiced),
            "concepts_total": len(model),
            "questions_answered": topic["questions_answered"],
            "concepts": model,
            "struggles": get_struggles(model),
            "last_session_gain": average_gain(gains)
        })

    return progress


def average_gain(gains):
    """Average mastery change across the concepts in a session."""
    if not gains:
        return None

    return sum(g["after"] - g["before"] for g in gains) / len(gains)
