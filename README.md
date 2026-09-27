# Project-1
# 🎮 AI Learning Game

An interactive educational game that uses Google's Gemini API to teach users about a topic of their choice through short lessons and multiple-choice questions.

The long-term goal is to combine **AI-generated education with gameplay** so that learning feels more interactive than simply reading information.

---

## 🎯 Project Goal

The goal of this project is to create a learning game where the user can enter **any topic they want to learn about**, such as:

- Photosynthesis
- Derivatives
- Python loops
- World War II
- SQL
- Computer science
- Biology
- etc.

The application then uses Gemini to dynamically generate educational content about that topic.

The planned game flow is:

```text
User enters a topic
        ↓
Gemini generates a beginner explanation
        ↓
User reads the lesson
        ↓
User starts the game
        ↓
Gemini-generated questions are presented
        ↓
User selects an answer
        ↓
Backend checks whether the answer is correct
        ↓
Game continues
        ↓
If the learner struggles:
simpler explanation is generated