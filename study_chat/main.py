import os
import io
import uuid
import json
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Form, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from pypdf import PdfReader
from transformers import pipeline

from scripts.scraper import scrape_web_files
from scripts.summariser import summariser

COURSE_CONTENT = (
    "Introduction to Quantum Computing: This course covers the fundamental concepts of quantum mechanics applied to "
    "information science, including qubits, superposition, quantum entanglement, quantum gates, and quantum circuits. "
    "Students will learn how quantum computers differ from classical computers, the principles of quantum superposition "
    "(where qubits can exist in states of 0 and 1 simultaneously), entanglement (a quantum phenomenon where particles "
    "remain connected so actions on one affect the other), and basic quantum algorithms like Deutsch-Jozsa, Shor's "
    "factoring algorithm, and Grover's search algorithm."
)

CURRENT_QUIZ: Dict[str, dict] = {} # Deprecated, use QUIZ_STORE
QUIZ_STORE: Dict[str, dict] = {}

from drive_service import extract_drive_content
from github_service import extract_github_content

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# OpenAI/Grok Configuration
API_KEY = os.getenv("GROK_API_KEY", "your-grok-api-key")
client = OpenAI(
    api_key=API_KEY,
    base_url="https://api.x.ai/v1",
)

# --- IN-MEMORY STORAGE ---
# Structure: { session_id: { course_name: [ {"id": "uuid", "source_name": "filename", "source_type": "file|url", "content": "text..."} ] } }
MEMORY_STORE: Dict[str, Dict[str, List[dict]]] = {}

def get_session_courses(session_id: str):
    if session_id not in MEMORY_STORE:
        MEMORY_STORE[session_id] = {"General": []}
    return MEMORY_STORE[session_id]

def get_course_docs(session_id: str, course_name: str):
    courses = get_session_courses(session_id)
    if course_name not in courses:
        courses[course_name] = []
    return courses[course_name]

class LinkRequest(BaseModel):
    url: str
    course: str = "General"

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    search_web: bool = False
    course: str = "General"
    auto_quiz: bool = False

class ScrapeRequest(BaseModel):
    url: str
    output_dir: str
    subject: Optional[str] = None

class CourseRequest(BaseModel):
    name: str

class DeleteDocRequest(BaseModel):
    path: str

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...), 
    course: str = Form(default="General"),
    x_session_id: str = Header(default="default-session")
):
    try:
        # upload file to structure
        PATH = f"files/{course}/files/{file.filename}"
        os.makedirs(os.path.dirname(PATH), exist_ok=True)
        with open(PATH, "wb") as f:
            contents = await file.read()
            f.write(contents)
        
        return {"filename": file.filename, "course": course}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/add_link")
async def add_link(
    link_req: LinkRequest, 
    x_session_id: str = Header(default="default-session")
):
    url = link_req.url
    try:
        if "drive.google.com" in url:
            text_content = extract_drive_content(url)
        elif "github.com" in url or "raw.githubusercontent.com" in url:
            text_content = extract_github_content(url)
        else:
            # Standard URL scraping
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            text_content = soup.get_text(separator=' ', strip=True)
        
        doc_id = str(uuid.uuid4())
        doc = {
            "id": doc_id,
            "source_type": "url",
            "source_name": url,
            "content": text_content
        }
        
        # Save it to the file-structure
        course_dir = f"files/{link_req.course}/links"
        os.makedirs(course_dir, exist_ok=True)
        filename = f"{doc_id}.txt"
        with open(os.path.join(course_dir, filename), "w", encoding="utf-8") as f:
            f.write(text_content)
        # Also save it to in-memory store for immediate access
        course_docs = get_course_docs(x_session_id, link_req.course)
        course_docs.append(doc)
        
        return {"id": doc_id, "source_name": doc["source_name"], "source_type": doc["source_type"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/courses")
def create_course(req: CourseRequest, x_session_id: str = Header(default="default-session")):
    courses = get_session_courses(x_session_id)
    if req.name not in courses:
        courses[req.name] = []
    return {"success": True, "courses": list(courses.keys())}

@app.get("/api/documents")
def get_documents(x_session_id: str = Header(default="default-session")):
    courses = get_session_courses(x_session_id)
    # Strip full content to save bandwidth
    safe_courses = {}
    for c_name, c_docs in courses.items():
        safe_courses[c_name] = [{"id": d["id"], "source_name": d["source_name"], "source_type": d["source_type"]} for d in c_docs]
    return safe_courses

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str, x_session_id: str = Header(default="default-session")):
    courses = get_session_courses(x_session_id)
    for c_name, c_docs in courses.items():
        courses[c_name] = [d for d in c_docs if d["id"] != doc_id]
    return {"success": True}

@app.post("/api/chat")
async def chat(
    request: ChatRequest, 
    x_session_id: str = Header(default="default-session")
):
    docs = get_course_docs(x_session_id, request.course)
    context_text = "\n\n".join([f"Source: {d['source_name']}\nContent: {d['content']}" for d in docs])
    
    system_prompt = (
        "You are an AI study assistant. Your task is to answer the user's question based strictly on the provided context. "
        "If the answer cannot be found in the context, you MUST state that you do not have enough information and refuse to answer. "
        "DO NOT hallucinate or use outside knowledge. Provide the source of your answer when applicable.\n\n"
        f"CONTEXT:\n{context_text}"
    )

    if request.search_web:
        system_prompt = (
            "You are an AI study assistant. The user has enabled 'Search the Web'. "
            "You should still prioritize the provided context, but you are now ALLOWED to use your general knowledge "
            "to answer the question if it's not found in the context. Be helpful and educational.\n\n"
            f"CONTEXT:\n{context_text}"
        )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})

    try:
        response = client.chat.completions.create(
            model="grok-beta",
            messages=messages,
            temperature=0.3
        )
        assistant_content = response.choices[0].message.content
        
        inline_quiz = None
        if request.auto_quiz:
            try:
                quiz_req = QuizGenerateRequest(test_type="multiple_choice", num_questions=1)
                inline_quiz = await generate_quiz(quiz_req)
                if inline_quiz and "quiz_id" in inline_quiz:
                    QUIZ_STORE[inline_quiz["quiz_id"]]["title"] = f"Mini Quiz: {request.course}"
            except Exception as e:
                print(f"Error generating inline quiz: {e}")
                
        return {"role": "assistant", "content": assistant_content, "inline_quiz": inline_quiz}
    except Exception as e:
        # Fallback for hackathon testing without an API key
        if "AuthenticationError" in str(type(e)) or "Connection" in str(type(e)):
            return {
                "role": "assistant", 
                "content": f"[MOCK RESPONSE] Could not connect to LLM API. Context docs loaded: {len(docs)}. Error: {str(e)}"
            }
        raise HTTPException(status_code=500, detail=str(e))


# --- QUIZ ROUTING & LOGIC ---

class QuizGenerateRequest(BaseModel):
    test_type: str  # "multiple_choice", "open_ended", "mixed"
    duration: Optional[int] = None   # in minutes
    num_questions: int
    num_open_questions: Optional[int] = None

class QuizSubmitRequest(BaseModel):
    quiz_id: Optional[str] = None
    answers: Dict[str, str]  # question_id -> user answer (option letter or free text)

def clean_and_parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())

TOPIC_MAP = {
    "mc1": "Qubits and basic quantum states",
    "mc2": "Quantum superposition principles",
    "mc3": "Shor's factoring algorithm",
    "mc4": "Grover's search algorithm",
    "mc5": "Quantum entanglement mechanics",
    "oe1": "Classical-quantum bit boundaries",
    "oe2": "Quantum entanglement significance",
    "oe3": "Shor's factoring algorithm in cryptography",
    "oe4": "Grover's search algorithm complexity speedups",
    "oe5": "Quantum gates and circuit configurations"
}

def get_fallback_quiz(test_type: str, num_questions: int, num_open_questions: Optional[int] = None) -> dict:
    mc_pool = [
        {
            "id": "mc1",
            "type": "multiple_choice",
            "question": "What is a qubit?",
            "options": {
                "A": "A classical bit that is always 1.",
                "B": "A quantum bit that can exist in a superposition of 0 and 1 states.",
                "C": "A component of a classical transistor.",
                "D": "A type of fiber-optic cable used in quantum key distribution."
            },
            "correct_answer": "B",
            "explanation": "A qubit (quantum bit) is the basic unit of quantum information. Unlike classical bits, which can only be 0 or 1, a qubit can be in a superposition of both states simultaneously."
        },
        {
            "id": "mc2",
            "type": "multiple_choice",
            "question": "What is quantum superposition?",
            "options": {
                "A": "The state when a qubit is in a fixed 0 or 1 state.",
                "B": "The process of copying quantum information perfectly.",
                "C": "The ability of a quantum system to exist in multiple states at the same time until measured.",
                "D": "The interference of classical electromagnetic waves."
            },
            "correct_answer": "C",
            "explanation": "Superposition is a fundamental principle of quantum mechanics that allows quantum systems to exist in linear combinations of basis states simultaneously."
        },
        {
            "id": "mc3",
            "type": "multiple_choice",
            "question": "Which of the following is a quantum algorithm designed for factoring large integers?",
            "options": {
                "A": "Grover's Algorithm",
                "B": "Deutsch-Jozsa Algorithm",
                "C": "Shor's Algorithm",
                "D": "Dijkstra's Algorithm"
            },
            "correct_answer": "C",
            "explanation": "Shor's algorithm is a quantum algorithm capable of factoring integers in polynomial time, posing a significant challenge to modern cryptographic systems like RSA."
        },
        {
            "id": "mc4",
            "type": "multiple_choice",
            "question": "Which quantum algorithm provides a quadratic speedup for searching unsorted databases?",
            "options": {
                "A": "Shor's Algorithm",
                "B": "Grover's Algorithm",
                "C": "Deutsch-Jozsa Algorithm",
                "D": "Merge Sort"
            },
            "correct_answer": "B",
            "explanation": "Grover's algorithm searches an unsorted database of N items in O(sqrt(N)) time, representing a quadratic speedup over classical linear search."
        },
        {
            "id": "mc5",
            "type": "multiple_choice",
            "question": "What is quantum entanglement?",
            "options": {
                "A": "A method of classical encryption.",
                "B": "A quantum phenomenon where particles remain connected so that actions on one affect the state of the other instantly.",
                "C": "The physical overheating of a quantum computer's dilution refrigerator.",
                "D": "The loss of quantum coherence over time."
            },
            "correct_answer": "B",
            "explanation": "Quantum entanglement occurs when particles interact in such a way that the quantum state of each particle cannot be described independently of the state of the others, regardless of distance."
        }
    ]
    
    oe_pool = [
        {
            "id": "oe1",
            "type": "open_ended",
            "question": "Describe the main difference between a classical bit and a qubit.",
            "ideal_answer": "A classical bit can only exist in one of two binary states (0 or 1) at any given time. In contrast, a qubit can exist in a superposition state, meaning it represents a linear combination of both 0 and 1 simultaneously. This superposition allows quantum computers to perform massive parallel computations that classical computers cannot replicate easily."
        },
        {
            "id": "oe2",
            "type": "open_ended",
            "question": "Explain the concept of quantum entanglement and its significance in quantum information.",
            "ideal_answer": "Quantum entanglement is a phenomenon where two or more particles become correlated in such a way that the state of one instantly determines the state of the other, no matter how far apart they are. In quantum information science, entanglement is critical for quantum teleportation, quantum cryptography (such as secure key distribution), and quantum computing algorithms to share information between qubits."
        },
        {
            "id": "oe3",
            "type": "open_ended",
            "question": "Explain Shor's algorithm and why it is significant for modern cybersecurity.",
            "ideal_answer": "Shor's algorithm is a quantum algorithm that can find the prime factors of an integer in polynomial time (specifically, log N time). This is significant for cybersecurity because classical encryption schemes, like RSA, rely on the difficulty of integer factorization to secure communications. Shor's algorithm on a sufficiently powerful quantum computer would break these systems."
        },
        {
            "id": "oe4",
            "type": "open_ended",
            "question": "What is Grover's search algorithm and how does its computational complexity compare to classical search?",
            "ideal_answer": "Grover's algorithm is a quantum search algorithm that can search an unsorted database of N entries in O(sqrt(N)) operations. Classically, searching an unsorted database requires checking each item one by one, resulting in a complexity of O(N). Grover's algorithm provides a quadratic speedup, which is highly useful for unstructured database searches and optimization problems."
        },
        {
            "id": "oe5",
            "type": "open_ended",
            "question": "What are quantum gates and quantum circuits in the context of computing?",
            "ideal_answer": "Quantum gates are basic quantum circuits operating on a small number of qubits. They are the analogs to classical logic gates, but they are reversible and can manipulate superpositions and entanglement. A quantum circuit is a sequence of quantum gates, measurements, and resets, which represents a quantum computation."
        }
    ]
    
    import random
    selected = []
    
    if num_open_questions is not None:
        num_oe = min(num_open_questions, num_questions)
        num_mc = num_questions - num_oe
        
        shuffled_mc = list(mc_pool)
        random.shuffle(shuffled_mc)
        shuffled_oe = list(oe_pool)
        random.shuffle(shuffled_oe)
        
        selected = shuffled_mc[:num_mc] + shuffled_oe[:num_oe]
        random.shuffle(selected)
    elif test_type == "multiple_choice":
        pool = list(mc_pool)
        random.shuffle(pool)
        selected = pool[:num_questions]
    elif test_type == "open_ended":
        pool = list(oe_pool)
        random.shuffle(pool)
        selected = pool[:num_questions]
    else:  # mixed
        half_mc = num_questions // 2
        half_oe = num_questions - half_mc
        
        shuffled_mc = list(mc_pool)
        random.shuffle(shuffled_mc)
        shuffled_oe = list(oe_pool)
        random.shuffle(shuffled_oe)
        
        selected = shuffled_mc[:half_mc] + shuffled_oe[:half_oe]
        random.shuffle(selected)
        
    return {"questions": selected[:num_questions]}

@app.get("/")
def read_root():
    return RedirectResponse(url="/static/index.html")

@app.get("/quiz")
def read_quiz():
    return FileResponse("static/quiz.html")

@app.get("/api/quizzes")
def get_quizzes():
    res = []
    for q_id, q_data in QUIZ_STORE.items():
        res.append({
            "quiz_id": q_id,
            "title": q_data.get("title", "Interactive Challenge"),
            "question_count": len(q_data.get("questions", []))
        })
    return {"quizzes": res}

@app.post("/api/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest):
    global CURRENT_QUIZ
    global QUIZ_STORE
    
    quiz_id = str(uuid.uuid4())
    
    num_oe = req.num_open_questions if req.num_open_questions is not None else (req.num_questions // 2 if req.test_type == "mixed" else (req.num_questions if req.test_type == "open_ended" else 0))
    num_mc = req.num_questions - num_oe
    
    system_prompt = (
        "You are a professor specializing in Quantum Computing. Generate a quiz based strictly on the following course content:\n\n"
        f"{COURSE_CONTENT}\n\n"
        f"You must generate exactly {req.num_questions} questions: specifically generate exactly {num_mc} multiple-choice questions and {num_oe} open-ended questions.\n\n"
        "Return the output as a JSON object with a single 'questions' key. The schema of the objects in the 'questions' list MUST be:\n"
        "For multiple_choice:\n"
        "{\n"
        "  \"id\": \"q1\",\n"
        "  \"type\": \"multiple_choice\",\n"
        "  \"question\": \"Question text here...\",\n"
        "  \"options\": {\n"
        "    \"A\": \"Option A text...\",\n"
        "    \"B\": \"Option B text...\",\n"
        "    \"C\": \"Option C text...\",\n"
        "    \"D\": \"Option D text...\"\n"
        "  },\n"
        "  \"correct_answer\": \"A\" or \"B\" or \"C\" or \"D\",\n"
        "  \"explanation\": \"Detailed explanation of why the correct answer is correct.\"\n"
        "}\n"
        "For open_ended:\n"
        "{\n"
        "  \"id\": \"q2\",\n"
        "  \"type\": \"open_ended\",\n"
        "  \"question\": \"Question text here...\",\n"
        "  \"ideal_answer\": \"Model ideal answer points/description to grade against.\"\n"
        "}\n\n"
        "Make sure to output ONLY the raw JSON. Do not include any text before or after the JSON."
    )
    
    try:
        response = client.chat.completions.create(
            model="grok-beta",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the quiz now."}
            ],
            temperature=0.3
        )
        content = response.choices[0].message.content
        quiz_data = clean_and_parse_json(content)
    except Exception as e:
        # Fallback if API key is not valid or other API errors occur
        quiz_data = get_fallback_quiz(req.test_type, req.num_questions, req.num_open_questions)
        
    # Store the quiz data with correct/ideal answers globally
    CURRENT_QUIZ = {
        "quiz_id": quiz_id,
        "questions": quiz_data.get("questions", [])
    }
    QUIZ_STORE[quiz_id] = {
        "quiz_id": quiz_id,
        "title": f"Challenge ({req.num_questions} Qs)",
        "questions": quiz_data.get("questions", [])
    }
    
    # Strip correct answers and ideal answers before sending to client
    client_questions = []
    for q in CURRENT_QUIZ["questions"]:
        client_q = {
            "id": q["id"],
            "type": q["type"],
            "question": q["question"]
        }
        if q["type"] == "multiple_choice":
            client_q["options"] = q["options"]
        client_questions.append(client_q)
        
    return {
        "quiz_id": quiz_id,
        "duration": req.duration,
        "questions": client_questions
    }

@app.post("/api/quiz/submit")
async def submit_quiz(req: QuizSubmitRequest):
    global CURRENT_QUIZ
    
    quiz_context = CURRENT_QUIZ
    if req.quiz_id and req.quiz_id in QUIZ_STORE:
        quiz_context = QUIZ_STORE[req.quiz_id]
        
    if not quiz_context or "questions" not in quiz_context:
        raise HTTPException(status_code=400, detail="No active quiz session found. Please generate a quiz first.")
        
    questions = quiz_context["questions"]
    answers = req.answers
    
    mc_correct = 0
    mc_total = 0
    oe_questions_to_grade = []
    analysis_list = []
    
    for q in questions:
        q_id = q["id"]
        q_type = q["type"]
        user_ans = answers.get(q_id, "").strip()
        
        if q_type == "multiple_choice":
            mc_total += 1
            correct_ans = q["correct_answer"]
            is_correct = (user_ans.upper() == correct_ans.upper())
            if is_correct:
                mc_correct += 1
            
            analysis_list.append({
                "id": q_id,
                "type": "multiple_choice",
                "question": q["question"],
                "options": q["options"],
                "user_answer": user_ans,
                "correct_answer": correct_ans,
                "is_correct": is_correct,
                "feedback": f"Correct! {q.get('explanation', '')}" if is_correct else f"Incorrect. The correct answer was {correct_ans}. {q.get('explanation', '')}"
            })
        elif q_type == "open_ended":
            oe_questions_to_grade.append({
                "id": q_id,
                "question": q["question"],
                "ideal_answer": q["ideal_answer"],
                "student_answer": user_ans
            })
            
    oe_grades = {}
    if oe_questions_to_grade:
        try:
            grade_prompt = (
                "You are an AI teaching assistant grading a student's open-ended answers for a Quantum Computing quiz.\n"
                f"Course Syllabus/Context:\n{COURSE_CONTENT}\n\n"
                "Please grade the student's answers based on the questions and model answers provided below.\n"
                "For each question, return:\n"
                "1. A score between 0 and 100.\n"
                "2. Constructive feedback highlighting: (a) what they got right, (b) what they missed/got wrong, and (c) how they can improve.\n\n"
                "Submissions to grade:\n"
                f"{json.dumps(oe_questions_to_grade, indent=2)}\n\n"
                "Return the output strictly as a JSON object where the keys are the question IDs. "
                "The schema for the JSON object MUST be:\n"
                "{\n"
                "  \"question_id_here\": {\n"
                "    \"score\": 85,\n"
                "    \"feedback\": \"Your detailed feedback here...\"\n"
                "  }\n"
                "}\n"
                "Make sure to output ONLY the raw JSON. Do not include any text before or after the JSON."
            )
            
            response = client.chat.completions.create(
                model="grok-beta",
                messages=[
                    {"role": "system", "content": grade_prompt},
                    {"role": "user", "content": "Grade the submissions now."}
                ],
                temperature=0.2
            )
            content = response.choices[0].message.content
            oe_grades = clean_and_parse_json(content)
        except Exception as e:
            # Local fallback grading if Grok is not available
            for q in oe_questions_to_grade:
                q_id = q["id"]
                ans = q["student_answer"]
                ideal = q["ideal_answer"]
                
                # Simple keyword checking
                keywords = [w.lower().strip(",.?!:;") for w in ideal.split() if len(w) > 4][:10]
                matches = sum(1 for kw in keywords if kw in ans.lower())
                
                if not ans:
                    score = 0
                    feedback = "No answer was provided. You must write a response to get points."
                else:
                    score = min(30 + (matches * 7) + min(len(ans) // 10, 30), 100)
                    feedback = (
                        f"[LOCAL EVALUATION] Your response has been analyzed. You correctly touched upon some relevant "
                        f"concepts (match strength: {matches}/10). To improve, ensure you explain all key mechanics "
                        f"such as superposition, entanglement, or Shor/Grover algorithms in detail. Ideal answer points: {ideal}"
                    )
                
                oe_grades[q_id] = {
                    "score": score,
                    "feedback": feedback
                }
                
    oe_total_score = 0
    oe_count = 0
    for q in oe_questions_to_grade:
        q_id = q["id"]
        grade_info = oe_grades.get(q_id, {"score": 0, "feedback": "Unable to grade."})
        score = grade_info.get("score", 0)
        feedback = grade_info.get("feedback", "")
        
        oe_total_score += score
        oe_count += 1
        
        analysis_list.append({
            "id": q_id,
            "type": "open_ended",
            "question": q["question"],
            "user_answer": q["student_answer"],
            "correct_answer": q["ideal_answer"],
            "is_correct": score >= 70,
            "grade_score": score,
            "feedback": feedback
        })
        
    mc_score_pct = (mc_correct / mc_total * 100) if mc_total > 0 else None
    oe_score_pct = (oe_total_score / oe_count) if oe_count > 0 else None
    
    if mc_score_pct is not None and oe_score_pct is not None:
        overall_score = round((mc_score_pct + oe_score_pct) / 2)
    elif mc_score_pct is not None:
        overall_score = round(mc_score_pct)
    elif oe_score_pct is not None:
        overall_score = round(oe_score_pct)
    else:
        overall_score = 0

    # Generate overall summary paragraph using Grok, fallback to local-based if Grok is down
    summary_obj = {}
    try:
        summary_prompt = (
            "You are an AI teaching assistant. A student completed a Quantum Computing quiz based on the following course content:\n"
            f"{COURSE_CONTENT}\n\n"
            f"Here is the detailed question-by-question breakdown of their results:\n"
            f"{json.dumps(analysis_list, indent=2)}\n\n"
            "Analyse their performance and output a JSON object containing two keys: "
            "'strong_points' (a list of strings representing specific strengths) and "
            "'weak_points' (a list of strings representing specific weaknesses/missed items).\n"
            "Requirements for the points:\n"
            "- Make the points organic and directly related to specific conceptual syllabus/course topics (e.g., qubits, superposition, quantum gates, Shor's algorithm, Grover's algorithm) rather than referencing question numbers or saying generic things like 'struggled with question X'.\n"
            "- Focus on what specific conceptual topics the student understood well (strong points) and what specific topics they need to review or put more emphasis on (weak points) based on their answers.\n"
            "JSON Schema:\n"
            "{\n"
            "  \"strong_points\": [\n"
            "    \"Strength bullet 1...\",\n"
            "    \"Strength bullet 2...\"\n"
            "  ],\n"
            "  \"weak_points\": [\n"
            "    \"Weakness bullet 1...\",\n"
            "    \"Weakness bullet 2...\"\n"
            "  ]\n"
            "}\n"
            "Make sure to output ONLY the raw JSON. Do not include any text before or after the JSON."
        )
        response = client.chat.completions.create(
            model="grok-beta",
            messages=[
                {"role": "system", "content": summary_prompt},
                {"role": "user", "content": "Write the summary now."}
            ],
            temperature=0.4
        )
        content = response.choices[0].message.content
        summary_obj = clean_and_parse_json(content)
    except Exception as e:
        # Local fallback heuristic summary generator using TOPIC_MAP
        correct_topics = []
        incorrect_topics = []
        for item in analysis_list:
            q_id = item["id"]
            topic_name = TOPIC_MAP.get(q_id, "Quantum computing foundations")
            if item.get("is_correct", False) or item.get("grade_score", 0) >= 70:
                correct_topics.append(topic_name)
            else:
                incorrect_topics.append(topic_name)
                
        strong_bullets = []
        weak_bullets = []
        
        if not incorrect_topics:
            strong_bullets = [
                "Demonstrated excellent understanding of all core quantum computing concepts tested.",
                "Showing strong command over quantum algorithms, superposition, and entanglement logic."
            ]
            weak_bullets = ["No major weaknesses identified in this session. Ready for advanced syllabus topics."]
        else:
            for topic in correct_topics:
                strong_bullets.append(f"Demonstrated solid conceptual mastery of {topic}.")
            if not correct_topics:
                strong_bullets.append("Showing introductory familiarity with quantum computing terminology.")
                
            for topic in incorrect_topics:
                weak_bullets.append(f"Needs further review and conceptual reinforcement on {topic}.")
            
        summary_obj = {
            "strong_points": strong_bullets,
            "weak_points": weak_bullets
        }

    return {
        "overall_score_pct": overall_score,
        "multiple_choice": {
            "correct": mc_correct,
            "total": mc_total,
            "score_pct": round(mc_score_pct) if mc_score_pct is not None else None
        } if mc_total > 0 else None,
        "open_ended": {
            "score_pct": round(oe_total_score / oe_count) if oe_count > 0 else None
        } if oe_count > 0 else None,
        "feedback_summary": summary_obj,
        "questions_analysis": analysis_list
    }

@app.post("/api/scrape")
def scrape_books(scrape_req: ScrapeRequest):
    TARGET_URL = scrape_req.url
    OUTPUT_DIR = scrape_req.output_dir
    SUBJECT = scrape_req.subject or "General"
    scrape_web_files(TARGET_URL, OUTPUT_DIR, SUBJECT)
    return {"status": "success"}

@app.get("/api/summarize")
def summarize_all(background_tasks: BackgroundTasks):
    # Inject background_tasks into the function arguments, 
    # then pass your heavy function into it without the parenthesis ()
    background_tasks.add_task(summariser)
    
    # This returns INSTANTLY to the user/frontend (under 5 milliseconds)
    return {
        "status": "processing", 
        "message": "Summarization task started in the background. Check server logs for progress."
    }

@app.get("/api/get_model")
def get_model():
    pipe = pipeline("text-generation", model="facebook/bart-large-cnn", device="cpu")
    pipe.save_pretrained("./local_model")
    return {"status": "success", "message": "Model downloaded and saved locally."}

@app.post("/api/delete")
def delete_one_pdf(delete_req: DeleteDocRequest):
    try:
        os.remove(delete_req.path)
        return {"status": "success", "message": "File deleted successfully."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/delete_course")
def delete_course(delete_req: CourseRequest):
    course_dir = f"files/{delete_req.name}"
    try:
        if os.path.exists(course_dir):
            shutil.rmtree(course_dir)
            return {"status": "success", "message": f"Course '{delete_req.name}' and all associated files deleted successfully."}
        else:
            return {"status": "error", "message": f"Course '{delete_req.name}' does not exist."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    

@app.post("/api/delete_all")
def delete_all():
    base_dir = "files"
    try:
        if os.path.exists(base_dir):
            shutil.rmtree(base_dir)
            return {"status": "success", "message": "All courses and files deleted successfully."}
        else:
            return {"status": "error", "message": "No courses found to delete."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    