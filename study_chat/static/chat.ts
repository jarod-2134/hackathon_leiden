// chat.ts
// Handles the chat interface logic.

interface ChatMessage {
    role: string;
    content: string;
}

interface DocumentInfo {
    id: string;
    source_name: string;
    source_type: string;
}

document.addEventListener('DOMContentLoaded', () => {
    // Type casting elements
    const chatArea = document.getElementById('chat-area') as HTMLDivElement;
    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
    
    const fileUpload = document.getElementById('file-upload') as HTMLInputElement;
    const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;
    const linkInput = document.getElementById('link-input') as HTMLInputElement;
    const addLinkBtn = document.getElementById('add-link-btn') as HTMLButtonElement;
    const documentsList = document.getElementById('documents-list') as HTMLDivElement;

    let chatHistory: ChatMessage[] = [];
    const sessionId = localStorage.getItem('nexus_session_id') || 'default';

    const searchWebToggle = document.getElementById('search-web-toggle') as HTMLInputElement;
    const savedSearchWeb = localStorage.getItem('nexus_search_web');
    if (savedSearchWeb === 'true') {
        searchWebToggle.checked = true;
    }

    searchWebToggle.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        localStorage.setItem('nexus_search_web', target.checked ? 'true' : 'false');
        if(target.checked) {
            appendWarningMessage("WARNING: Web Search Enabled. Requests may now go outside of the provided course material. Hallucination risk increased.");
        } else {
            appendSystemMessage("Web Search disabled. Strict hallucination protocol active.");
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // File Upload
    uploadBtn.addEventListener('click', () => fileUpload.click());
    
    fileUpload.addEventListener('change', async (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || !target.files.length) return;
        const file = target.files[0];
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            uploadBtn.textContent = 'Uploading...';
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'X-Session-ID': sessionId },
                body: formData
            });
            if (res.ok) {
                await fetchDocuments();
                appendSystemMessage(`Document added: ${file.name}`);
            } else {
                alert('Upload failed');
            }
        } catch (err) {
            console.error(err);
        } finally {
            uploadBtn.textContent = 'Upload File';
            fileUpload.value = '';
        }
    });

    // Add Link
    addLinkBtn.addEventListener('click', async () => {
        const url = linkInput.value.trim();
        if (!url) return;

        try {
            addLinkBtn.textContent = '...';
            const res = await fetch('/api/add_link', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId
                },
                body: JSON.stringify({ url })
            });
            if (res.ok) {
                await fetchDocuments();
                appendSystemMessage(`Link added: ${url}`);
                linkInput.value = '';
            } else {
                alert('Failed to parse link');
            }
        } catch (err) {
            console.error(err);
        } finally {
            addLinkBtn.textContent = '+';
        }
    });

    // Fetch Documents
    async function fetchDocuments() {
        try {
            const res = await fetch('/api/documents', {
                headers: { 'X-Session-ID': sessionId }
            });
            const docs: DocumentInfo[] = await res.json();
            renderDocuments(docs);
        } catch (err) {
            console.error(err);
        }
    }

    function renderDocuments(docs: DocumentInfo[]) {
        documentsList.innerHTML = '';
        docs.forEach(doc => {
            const div = document.createElement('div');
            div.className = 'document-item';
            div.innerHTML = `
                <div class="document-name" title="${doc.source_name}">${doc.source_name}</div>
                <button class="delete-btn" data-id="${doc.id}">×</button>
            `;
            documentsList.appendChild(div);
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e: Event) => {
                const target = e.target as HTMLButtonElement;
                const id = target.getAttribute('data-id');
                if (id) await deleteDocument(id);
            });
        });
    }

    async function deleteDocument(id: string) {
        try {
            const res = await fetch(`/api/documents/${id}`, { 
                method: 'DELETE',
                headers: { 'X-Session-ID': sessionId }
            });
            if (res.ok) fetchDocuments();
        } catch(err) {
            console.error(err);
        }
    }

    // Chat Logic
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content) return;

        appendMessage('user', content);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        chatHistory.push({ role: 'user', content });

        const typingId = appendTypingIndicator();

        try {
            const search_web = localStorage.getItem('nexus_search_web') === 'true';
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId
                },
                body: JSON.stringify({ messages: chatHistory, search_web })
            });

            removeMessage(typingId);

            if (res.ok) {
                const data = await res.json();
                chatHistory.push({ role: data.role, content: data.content });
                appendMessage('assistant', data.content);
            } else {
                appendSystemMessage("Error connecting to the intelligence core.");
            }
        } catch (err) {
            console.error(err);
            removeMessage(typingId);
            appendSystemMessage("Network error.");
        }
    }

    function appendMessage(role: string, text: string) {
        const div = document.createElement('div');
        div.className = `message ${role === 'user' ? 'user-msg' : 'assistant-msg'}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = role === 'user' ? 'U' : 'N';

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = text; 

        div.appendChild(avatar);
        div.appendChild(bubble);
        chatArea.appendChild(div);
        scrollToBottom();
    }

    function appendSystemMessage(text: string) {
        const div = document.createElement('div');
        div.className = 'message system-msg';
        div.innerHTML = `
            <div class="avatar" style="background: transparent; color: var(--text-muted); border: none;">[SYS]</div>
            <div class="bubble" style="color: var(--text-muted); font-style: italic; background: transparent; border: none; padding-left: 0;">
                ${text}
            </div>
        `;
        chatArea.appendChild(div);
        scrollToBottom();
    }

    function appendWarningMessage(text: string) {
        const div = document.createElement('div');
        div.className = 'message warning-msg';
        div.innerHTML = `
            <div class="avatar" style="background: #ef4444; color: white; border: none; font-weight: bold;">!</div>
            <div class="bubble" style="color: #ef4444; font-weight: 600; background: #fef2f2; border: 2px solid #ef4444;">
                ${text}
            </div>
        `;
        chatArea.appendChild(div);
        scrollToBottom();
    }

    function appendTypingIndicator(): string {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.className = 'message assistant-msg';
        div.id = id;
        div.innerHTML = `
            <div class="avatar">N</div>
            <div class="bubble" style="color: var(--text-muted);">Analyzing...</div>
        `;
        chatArea.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeMessage(id: string) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    // Initial Fetch
    fetchDocuments();
});
