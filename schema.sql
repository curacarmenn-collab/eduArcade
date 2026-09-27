-- ============================================================
-- Learning Pac-Man schema
--
-- topics / concepts / questions   = the learning package (concept map
--                                   + questions), generated once per
--                                   topic and reused.
-- attempts / concept_mastery /
-- student_misconceptions          = the student model.
-- ============================================================

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    user_id        INTEGER PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Topics: one saved learning package per topic
CREATE TABLE IF NOT EXISTS topics (
    topic_id     INTEGER PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,      -- 'python-loops'
    title        TEXT NOT NULL,             -- 'Python Loops'
    explanation  TEXT NOT NULL,
    lesson       TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Concepts: the concept map (exactly 4 per topic, one per ghost)
CREATE TABLE IF NOT EXISTS concepts (
    concept_id          INTEGER PRIMARY KEY,
    topic_id            INTEGER NOT NULL REFERENCES topics(topic_id) ON DELETE CASCADE,
    slug                TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT NOT NULL,
    learning_objective  TEXT NOT NULL,
    difficulty          INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    position            INTEGER NOT NULL,             -- 1..4, prerequisite order
    prerequisites_json  TEXT NOT NULL DEFAULT '[]',   -- concept slugs in this topic
    UNIQUE (topic_id, slug)
);

-- 4. Questions: the topic's questions plus remediation questions
CREATE TABLE IF NOT EXISTS questions (
    question_id    INTEGER PRIMARY KEY,
    topic_id       INTEGER NOT NULL REFERENCES topics(topic_id) ON DELETE CASCADE,
    concept_id     INTEGER NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    position       INTEGER,                           -- order in the game; NULL for remediation
    question_type  TEXT NOT NULL CHECK (question_type IN
                     ('basic', 'conceptual', 'procedural', 'application', 'transfer')),
    difficulty     INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 4),
    question       TEXT NOT NULL,
    options_json   TEXT NOT NULL,                     -- 4 option strings
    answer         TEXT NOT NULL,
    source         TEXT NOT NULL CHECK (source IN ('package', 'remediation')),
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Attempts: every answer a student gives
CREATE TABLE IF NOT EXISTS attempts (
    attempt_id      INTEGER PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_id      TEXT NOT NULL,                    -- the game_id this answer belongs to
    question_id     INTEGER NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    concept_id      INTEGER NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    is_correct      INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    difficulty      INTEGER NOT NULL,
    assisted        INTEGER NOT NULL DEFAULT 0,       -- answered right after an explanation
    mastery_before  REAL NOT NULL,
    mastery_after   REAL NOT NULL,
    created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Concept mastery: the current estimate per student and concept
CREATE TABLE IF NOT EXISTS concept_mastery (
    user_id                 INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    concept_id              INTEGER NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    mastery                 REAL NOT NULL,
    attempts                INTEGER NOT NULL DEFAULT 0,
    correct                 INTEGER NOT NULL DEFAULT 0,
    max_difficulty_correct  INTEGER NOT NULL DEFAULT 0,
    last_seen               TEXT,
    PRIMARY KEY (user_id, concept_id)
);

-- 7. Misconceptions a student has shown. Filled in by the
--    misconception-detection feature; empty until then.
CREATE TABLE IF NOT EXISTS student_misconceptions (
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    concept_id      INTEGER NOT NULL REFERENCES concepts(concept_id) ON DELETE CASCADE,
    label           TEXT NOT NULL,
    times_observed  INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL CHECK (status IN ('possible', 'likely', 'resolved')),
    first_seen      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, concept_id, label)
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_concept ON attempts(user_id, concept_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_session      ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_concepts_topic        ON concepts(topic_id, position);
CREATE INDEX IF NOT EXISTS idx_questions_topic       ON questions(topic_id, position);
