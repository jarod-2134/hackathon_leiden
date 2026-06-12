import os
import io
import uuid
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from pypdf import PdfReader

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

class CourseRequest(BaseModel):
    name: str

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...), 
    course: str = Form(default="General"),
    x_session_id: str = Header(default="default-session")
):
    try:
        content_bytes = await file.read()
        text_content = ""
        
        if file.filename.endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content_bytes))
            for page in reader.pages:
                text_content += page.extract_text() + "\n"
        else:
            # Assume text based
            text_content = content_bytes.decode("utf-8", errors="ignore")
        
        doc_id = str(uuid.uuid4())
        doc = {
            "id": doc_id,
            "source_type": "file",
            "source_name": file.filename,
            "content": text_content
        }
        
        docs = get_course_docs(x_session_id, course)
        docs.append(doc)
        
        return {"id": doc_id, "source_name": doc["source_name"], "source_type": doc["source_type"]}
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
        
        docs = get_course_docs(x_session_id, link_req.course)
        docs.append(doc)
        
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
        return {"role": "assistant", "content": response.choices[0].message.content}
    except Exception as e:
        # Fallback for hackathon testing without an API key
        if "AuthenticationError" in str(type(e)) or "Connection" in str(type(e)):
            return {
                "role": "assistant", 
                "content": f"[MOCK RESPONSE] Could not connect to LLM API. Context docs loaded: {len(docs)}. Error: {str(e)}"
            }
        raise HTTPException(status_code=500, detail=str(e))
