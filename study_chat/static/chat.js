"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const menuBtn = document.getElementById('menu-btn');
    const popoverMenu = document.getElementById('popover-menu');
    const fileUpload = document.getElementById('file-upload');
    const menuAddFile = document.getElementById('menu-add-file');
    const menuAddDrive = document.getElementById('menu-add-drive');
    const menuAddGithub = document.getElementById('menu-add-github');
    const docListContainer = document.getElementById('doc-list-container');
    const courseSelector = document.getElementById('course-selector');
    const addCourseBtn = document.getElementById('add-course-btn');
    const searchWebToggle = document.getElementById('search-web-toggle');
    
    let chatHistory = [];
    const sessionId = localStorage.getItem('nexus_session_id') || 'default';
    let activeCourse = 'General';
    
    let contextMenu = document.getElementById('custom-context-menu');
    if (!contextMenu) {
        contextMenu = document.createElement('div');
        contextMenu.id = 'custom-context-menu';
        contextMenu.className = 'custom-context-menu hidden';
        document.body.appendChild(contextMenu);
        document.addEventListener('click', () => {
            contextMenu.classList.add('hidden');
        });
    }

    function showContextMenu(x, y, url) {
        contextMenu.innerHTML = `
            <div class="context-item url-display" title="${url}">${url}</div>
            <div class="context-item copy-btn">Copy Link</div>
        `;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.classList.remove('hidden');

        const copyBtn = contextMenu.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(url);
            appendSystemMessage("Link copied to clipboard!");
        });
    }

    const savedSearchWeb = localStorage.getItem('nexus_search_web');
    if (savedSearchWeb === 'true' && searchWebToggle) {
        searchWebToggle.checked = true;
    }
    if (searchWebToggle) {
        searchWebToggle.addEventListener('change', (e) => {
            const target = e.target;
            localStorage.setItem('nexus_search_web', target.checked ? 'true' : 'false');
            if (target.checked)
                appendWarningMessage("WARNING: Web Search Enabled. Requests may now go outside of the provided course material. Hallucination risk increased.");
            else
                appendSystemMessage("Web Search disabled. Strict hallucination protocol active.");
        });
    }
    if (messageInput) {
        messageInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
    if (menuBtn && popoverMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popoverMenu.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!popoverMenu.contains(e.target) && !menuBtn.contains(e.target)) {
                popoverMenu.classList.add('hidden');
            }
        });
    }
    if (menuAddFile && fileUpload) {
        menuAddFile.addEventListener('click', () => {
            fileUpload.click();
            popoverMenu.classList.add('hidden');
        });
        fileUpload.addEventListener('change', async (e) => {
            const target = e.target;
            if (!target.files || !target.files.length)
                return;
            const file = target.files[0];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('course', activeCourse);
            try {
                appendSystemMessage(`Uploading ${file.name} to ${activeCourse}...`);
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'X-Session-ID': sessionId },
                    body: formData
                });
                if (res.ok) {
                    await fetchDocuments();
                    appendSystemMessage(`Document added: ${file.name}`);
                }
                else {
                    alert('Upload failed');
                }
            }
            catch (err) {
                console.error(err);
            }
            finally {
                fileUpload.value = '';
            }
        });
    }
    async function handleAddLink(promptText) {
        if (popoverMenu)
            popoverMenu.classList.add('hidden');
        const url = prompt(promptText);
        if (!url)
            return;
        try {
            appendSystemMessage(`Adding link to ${activeCourse}...`);
            const res = await fetch('/api/add_link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId
                },
                body: JSON.stringify({ url, course: activeCourse })
            });
            if (res.ok) {
                await fetchDocuments();
                appendSystemMessage(`Link added: ${url}`);
            }
            else {
                alert('Failed to parse link');
            }
        }
        catch (err) {
            console.error(err);
        }
    }
    if (menuAddDrive)
        menuAddDrive.addEventListener('click', () => handleAddLink("Enter Google Drive URL:"));
    if (menuAddGithub)
        menuAddGithub.addEventListener('click', () => handleAddLink("Enter GitHub URL:"));
    if (addCourseBtn) {
        addCourseBtn.addEventListener('click', async () => {
            const name = prompt("Enter new course name:");
            if (!name || !name.trim())
                return;
            const cname = name.trim();
            try {
                const res = await fetch('/api/courses', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-ID': sessionId
                    },
                    body: JSON.stringify({ name: cname })
                });
                if (res.ok) {
                    activeCourse = cname;
                    await fetchDocuments();
                    appendSystemMessage(`Switched to new course: ${cname}`);
                }
            }
            catch (err) {
                console.error(err);
            }
        });
    }
    if (courseSelector) {
        courseSelector.addEventListener('change', (e) => {
            const target = e.target;
            activeCourse = target.value;
            appendSystemMessage(`Active Context changed to: ${activeCourse}`);
        });
    }
    async function fetchDocuments() {
        try {
            const res = await fetch('/api/documents', {
                headers: { 'X-Session-ID': sessionId }
            });
            const courses = await res.json();
            renderCourses(courses);
        }
        catch (err) {
            console.error(err);
        }
    }
    function renderCourses(courses) {
        if (!docListContainer || !courseSelector)
            return;
        docListContainer.innerHTML = '';
        courseSelector.innerHTML = '';
        const courseNames = Object.keys(courses);
        if (!courseNames.includes(activeCourse) && courseNames.length > 0) {
            activeCourse = courseNames[0];
        }
        courseNames.forEach(cName => {
            const opt = document.createElement('option');
            opt.value = cName;
            opt.textContent = cName;
            if (cName === activeCourse)
                opt.selected = true;
            courseSelector.appendChild(opt);
            const group = document.createElement('div');
            group.className = 'course-group';
            group.style.marginBottom = '1rem';
            const header = document.createElement('div');
            header.className = 'course-header';
            header.style.fontWeight = 'bold';
            header.style.color = 'var(--text-main)';
            header.style.borderBottom = '1px solid var(--border)';
            header.style.paddingBottom = '0.5rem';
            header.style.marginBottom = '0.5rem';
            header.textContent = cName;
            group.appendChild(header);
            const docList = document.createElement('div');
            docList.className = 'course-docs';
            if (courses[cName].length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No documents yet.';
                empty.style.color = 'var(--text-muted)';
                empty.style.fontSize = '0.85rem';
                empty.style.padding = '0.5rem';
                docList.appendChild(empty);
            }
            else {
                let linkCounter = 1;
                courses[cName].forEach(doc => {
                    const div = document.createElement('div');
                    div.className = 'document-item';
                    
                    let displayName = doc.source_name;
                    const isUrl = doc.source_type === 'url';
                    if (isUrl) {
                        displayName = `Link ${linkCounter++}`;
                        div.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            showContextMenu(e.pageX, e.pageY, doc.source_name);
                        });
                    }

                    div.innerHTML = `
                        <div class="document-name" title="${displayName}">${displayName}</div>
                        <button class="delete-btn" data-id="${doc.id}">×</button>
                    `;
                    docList.appendChild(div);
                });
            }
            group.appendChild(docList);
            docListContainer.appendChild(group);
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.target;
                const id = target.getAttribute('data-id');
                if (id)
                    await deleteDocument(id);
            });
        });
    }
    async function deleteDocument(id) {
        try {
            const res = await fetch(`/api/documents/${id}`, {
                method: 'DELETE',
                headers: { 'X-Session-ID': sessionId }
            });
            if (res.ok)
                fetchDocuments();
        }
        catch (err) {
            console.error(err);
        }
    }
    if (sendBtn)
        sendBtn.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    async function sendMessage() {
        if (!messageInput)
            return;
        const content = messageInput.value.trim();
        if (!content)
            return;
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
                body: JSON.stringify({ messages: chatHistory, search_web, course: activeCourse })
            });
            removeMessage(typingId);
            if (res.ok) {
                const data = await res.json();
                chatHistory.push({ role: data.role, content: data.content });
                appendMessage('assistant', data.content);
            }
            else {
                appendSystemMessage("Error connecting to the intelligence core.");
            }
        }
        catch (err) {
            console.error(err);
            removeMessage(typingId);
            appendSystemMessage("Network error.");
        }
    }
    function appendMessage(role, text) {
        if (!chatArea)
            return;
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
        if (!chatArea)
            return;
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
        if (!chatArea)
            return;
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
        if (!chatArea)
            return '';
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
        if (el)
            el.remove();
    }
    function scrollToBottom() {
        if (chatArea)
            chatArea.scrollTop = chatArea.scrollHeight;
    }
    fetchDocuments();
});
