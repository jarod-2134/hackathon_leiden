"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const documentsList = document.getElementById('documents-list');
    
    // Menu elements
    const menuBtn = document.getElementById('menu-btn');
    const popoverMenu = document.getElementById('popover-menu');
    const fileUpload = document.getElementById('file-upload');
    const menuAddFile = document.getElementById('menu-add-file');
    const menuAddDrive = document.getElementById('menu-add-drive');
    const menuAddGithub = document.getElementById('menu-add-github');

    // Inline Web Search toggle
    const searchWebToggle = document.getElementById('search-web-toggle');
    const savedSearchWeb = localStorage.getItem('nexus_search_web');
    if (savedSearchWeb === 'true') {
        searchWebToggle.checked = true;
    }

    searchWebToggle.addEventListener('change', (e) => {
        const target = e.target;
        localStorage.setItem('nexus_search_web', target.checked ? 'true' : 'false');
        if(target.checked) {
            appendWarningMessage("WARNING: Web Search Enabled. Requests may now go outside of the provided course material. Hallucination risk increased.");
        } else {
            appendSystemMessage("Web Search disabled. Strict hallucination protocol active.");
        }
    });

    let chatHistory = [];
    const sessionId = localStorage.getItem('nexus_session_id') || 'default';
    
    // Toggle Menu
    menuBtn.addEventListener('click', () => {
        popoverMenu.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuBtn.contains(e.target) && !popoverMenu.contains(e.target)) {
            popoverMenu.classList.add('hidden');
        }
    });

    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // File upload via menu
    menuAddFile.addEventListener('click', () => {
        popoverMenu.classList.add('hidden');
        fileUpload.click();
    });

    fileUpload.addEventListener('change', async (e) => {
        const target = e.target;
        if (!target.files || !target.files.length) return;
        const file = target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            appendSystemMessage(`Uploading ${file.name}...`);
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
            fileUpload.value = '';
        }
    });
    
    // Add Link (Drive / Github) via prompt
    const handleLinkPrompt = async (type, placeholder) => {
        popoverMenu.classList.add('hidden');
        const url = prompt(`Enter ${type} URL:`, placeholder);
        if (!url) return;
        try {
            appendSystemMessage(`Fetching content from ${url}...`);
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
            } else {
                alert(`Failed to parse ${type} link`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    menuAddDrive.addEventListener('click', () => {
        handleLinkPrompt('Google Drive', 'https://drive.google.com/...');
    });

    menuAddGithub.addEventListener('click', () => {
        handleLinkPrompt('GitHub', 'https://github.com/...');
    });
    
    async function fetchDocuments() {
        try {
            const res = await fetch('/api/documents', {
                headers: { 'X-Session-ID': sessionId }
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
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.target;
                const id = target.getAttribute('data-id');
                if (id) await deleteDocument(id);
            });
        });
    }
    
    async function deleteDocument(id) {
        try {
            const res = await fetch(`/api/documents/${id}`, {
                method: 'DELETE',
                headers: { 'X-Session-ID': sessionId }
            });
            if (res.ok) fetchDocuments();
        } catch (err) {
            console.error(err);
        }
    }
    
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
        appendMessage('user', content);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        chatHistory.push({ role: 'user', content });
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
            <div class="avatar" style="background: transparent; color: var(--text-muted); border: none;">[SYS]</div>
            <div class="bubble" style="color: var(--text-muted); font-style: italic; background: transparent; border: none; padding-left: 0;">
                ${text}
            </div>
        `;
        chatArea.appendChild(div);
        scrollToBottom();
    }
    
    function appendWarningMessage(text) {
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
    
    function appendTypingIndicator() {
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
    
    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
    
    function scrollToBottom() {
        chatArea.scrollTop = chatArea.scrollHeight;
    }
    
    fetchDocuments();
});
