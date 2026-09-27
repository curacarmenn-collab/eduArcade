"""
Concept mastery estimate for the student model.

Elo-style update, like chess ratings: the more surprising an answer,
the more it moves mastery. Getting a hard question right when you were
expected to miss it raises mastery a lot; missing an easy question
lowers it a lot. No ML model needed.
"""

import math

# Mastery a student starts with on a concept they have never seen.
STARTING_MASTERY = 0.30

# Mastery at which a student has about a 50% chance at each difficulty.
THRESHOLD = {1: 0.25, 2: 0.50, 3: 0.70, 4: 0.85}

# Difficulty of each question type.
DIFFICULTY_BY_TYPE = {
    "basic": 1,
    "conceptual": 2,
    "procedural": 2,
    "application": 3,
    "transfer": 4,
}

# An answer given right after an explanation is weaker evidence.
ASSISTED_WEIGHT = 0.6


def expected(mastery, difficulty):
    """Probability of answering a question of this difficulty correctly."""
    return 1 / (1 + math.exp(-6 * (mastery - THRESHOLD[difficulty])))


def update(mastery, attempts, difficulty, correct, assisted=False):
    """Return the new mastery after one answer.

    `attempts` is how many answers were recorded for this concept
    before this one; steps shrink as evidence builds up.
    """
    step = max(0.12, 0.45 / (1 + 0.15 * attempts))
    weight = ASSISTED_WEIGHT if assisted else 1.0
    result = 1 if correct else 0
    mastery += step * weight * (result - expected(mastery, difficulty))
    return min(0.98, max(0.02, mastery))


def level(mastery):
    """Difficulty to ask next: 1-3 for regular questions, 4 = transfer."""
    if mastery < 0.40:
        return 1
    if mastery < 0.70:
        return 2
    if mastery < 0.90:
        return 3
    return 4


# Adaptive difficulty: recent accuracy (last few answers on a concept)
# below this means the student is struggling right now, so the next
# question doesn't get harder than the last one.
RECENT_STRUGGLE_BELOW = 0.5


def next_difficulty(mastery, max_solved, last=None, recent_accuracy=None):
    """Difficulty (1-4) of the next question on a concept.

    Mastery picks the band (level()); the student's history keeps the
    changes gradual:

    - climb one level at a time: never more than one above the hardest
      difficulty already answered correctly (`max_solved`, 0 = none)
    - after a miss, reinforce one level below the missed question, but
      not more than one level below the hardest one already solved
    - right after help, or while recent accuracy is low, don't climb
      above the last question's level

    `last` is the latest answer on this concept, {"difficulty",
    "correct", "assisted"}, or None if there isn't one.
    """
    target = min(level(mastery), max_solved + 1)

    if last is not None:
        if not last["correct"]:
            target = min(target, last["difficulty"] - 1)
            target = max(target, max_solved - 1)
        elif last["assisted"] or (
            recent_accuracy is not None
            and recent_accuracy < RECENT_STRUGGLE_BELOW
        ):
            target = min(target, last["difficulty"])

    return min(4, max(1, target))


def evidence(attempts):
    """How much the mastery estimate is based on."""
    if attempts == 0:
        return "none"
    if attempts < 3:
        return "low"
    if attempts < 6:
        return "medium"
    return "high"
