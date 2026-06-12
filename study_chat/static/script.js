document.addEventListener('DOMContentLoaded', () => {
    // Generate a simple session ID for this tab/user
    const sessionId = 'sess-' + Math.random().toString(36).substring(2, 15);

    // Views
    const landingPage = document.getElementById('landing-page');
    const chatInterface = document.getElementById('chat-interface');
    const enterBtn = document.getElementById('enter-btn');

    // UI Elements
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const searchWebToggle = document.getElementById('search-web-toggle');
    const statusDot = document.querySelector('.status-dot');

    // Knowledge Base Elements
    const fileUpload = document.getElementById('file-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const linkInput = document.getElementById('link-input');
    const addLinkBtn = document.getElementById('add-link-btn');
    const documentsList = document.getElementById('documents-list');

    let chatHistory = [];

    // Switch view
    enterBtn.addEventListener('click', () => {
        landingPage.classList.remove('active');
        chatInterface.classList.add('active');
        fetchDocuments();
    });

    // Toggle Web Search Visuals
    searchWebToggle.addEventListener('change', (e) => {
        if(e.target.checked) {
            statusDot.style.backgroundColor = 'var(--text-main)';
            statusDot.style.boxShadow = '0 0 8px var(--text-main)';
            appendSystemMessage("Web Search enabled. The model will use external knowledge if context is insufficient.");
        } else {
            statusDot.style.backgroundColor = 'var(--text-muted)';
            statusDot.style.boxShadow = 'none';
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
    
    fileUpload.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        const file = e.target.files[0];
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            uploadBtn.textContent = 'Uploading...';
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'X-Session-ID': sessionId
                },
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
                headers: {
                    'X-Session-ID': sessionId
                }
            });
            const docs = await res.json();
            renderDocuments(docs);
        } catch (err) {
            console.error(err);
        }
    }

    function renderDocuments(docs) {
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

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await deleteDocument(id);
            });
        });
    }

    async function deleteDocument(id) {
        try {
            const res = await fetch(`/api/documents/${id}`, { 
                method: 'DELETE',
                headers: {
                    'X-Session-ID': sessionId
                }
            });
            if (res.ok) {
                fetchDocuments();
            }
        } catch(err) {
            console.error(err);
        }
    }

    // Chat Logic
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content) return;

        // UI Update
        appendMessage('user', content);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        chatHistory.push({ role: 'user', content });

        // Show typing indicator
        const typingId = appendTypingIndicator();

        try {
            const search_web = searchWebToggle.checked;
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

    function appendMessage(role, text) {
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

    function appendSystemMessage(text) {
        const div = document.createElement('div');
        div.className = 'message system-msg';
        div.innerHTML = `
            <div class="avatar">N</div>
            <div class="bubble" style="color: var(--text-muted); font-style: italic; background: transparent; border: none;">
                [SYSTEM] ${text}
            </div>
        `;
        chatArea.appendChild(div);
        scrollToBottom();
    }

    function appendTypingIndicator() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.className = 'message assistant-msg';
        div.id = id;
        div.innerHTML = `
            <div class="avatar">N</div>
            <div class="bubble" style="color: var(--text-muted);">Analyzing context...</div>
        `;
        chatArea.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }
});
