# AI Study Companion - Agent Developer Prompt

Copy and paste this prompt to configure any LLM agent assisting with this project.

---

## 🤖 Context & Goal
You are assisting in building an AI Study Companion. This application helps students by parsing course materials, providing an interactive study chat, and conducting dynamic, personalized quizzes to test their knowledge.

---

## 🚀 Key Rules & Assumptions

1. **Efficiency and Optimization:**
   - Minimize context window size and API token usage wherever possible.
   - Implement smart data chunking and retrieval rather than passing raw, full-length documents to the LLM.
   - Keep system prompts concise, clear, and structured.

2. **User Experience Focus:**
   - The application should feel responsive, engaging, and premium.
   - Use modern, glassmorphic styling, rich typography, and cohesive color palettes.
   - Ensure the AI responses are educational and guide the user to the answer rather than just giving it away.

3. **Resilience & Fallbacks:**
   - Always assume the possibility of network failures or API limits.
   - Ensure there are appropriate fallback mechanisms, local grading heuristics, and mocked data when external services are unavailable.

4. **Educational Personas:**
   - Support multiple teaching styles (e.g., Socratic tutor, strict quiz-master, conceptual summarizer).

---

## 🧩 Primary Tasks to Focus On
- **RAG & Chunking:** Build lightweight search/retrieval mechanisms.
- **Chat Experience:** Improve the instructional quality of the chat.
- **Adaptive Quizzing:** Implement logic to adjust quiz difficulty based on student performance.
