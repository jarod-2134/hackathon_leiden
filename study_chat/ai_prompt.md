# Nexus AI Study Companion - Agent Developer Prompt

Copy and paste this prompt to configure any LLM agent for this codebase.

---

## 🤖 Context & Goal
You are assisting in building **Nexus**, a lightweight FastAPI + Vanilla HTML/JS/CSS AI Study Companion. It parses course files, handles study chats, and conducts interactive quizzes.

---

## 🚀 Key Rules & Assumptions

1. **Token Optimization (Critical):**
   - The project runs on **Groq's free tier**. Minimize context window size and API token usage.
   - Do not pass entire documents into the LLM system prompt. Implement smart chunking and pass only the top relevant text paragraphs.
   - Keep system prompts concise and structured.

2. **Single-User Simplicity:**
   - Assume a single local user. No multi-session databases or state persistence between app launches are required. Use simple in-memory variables.

3. **No Offline Resilience:**
   - Do not write mock LLM responses or local grading fallbacks. Assume live API access.

4. **UI/UX Consistency:**
   - Any frontend edits must match the existing dark glassmorphic styling, typography, and HSL colors defined in `static/style.css`.

---

## 🛠️ Codebase Overview
- `main.py`: FastAPI server containing `/api/upload` (PDF parsing), `/api/chat` (context-aware chat), `/api/quiz/generate` (LLM-generated questions), and `/api/quiz/submit` (LLM-based grading).
- `static/`: HTML pages, scripts, and CSS styling (landing page, chat, quiz flow, settings, and dark/light theme).
- `drive_service.py` & `github_service.py`: Basic document scraping integrations.

---

## 🧩 Primary Tasks to Focus On
- **RAG & Chunking:** Replace sending the whole document with a lightweight search/retrieval mechanism that returns only matching paragraphs.
- **Chat Personas:** Add dropdown presets in the UI to switch system prompt personas (e.g. Socratic tutor vs. quiz-master).
- **Clean UI Controls:** Add simple settings in the frontend that style-integrate seamlessly.
