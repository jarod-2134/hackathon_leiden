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
    const addCourseBtn = document.getElementById('add-course-btn');
    const searchWebToggle = document.getElementById('search-web-toggle');
    const tabContainer = document.getElementById('tab-container');
    const autoQuizToggle = document.getElementById('auto-quiz-toggle');
    
    let chatHistory = [];
    const sessionId = localStorage.getItem('nexus_session_id') || 'default';
    let activeCourse = 'General';
    let openTabs = ['General'];

    // Load open tabs and active course from localStorage
    const savedActive = localStorage.getItem('nexus_active_course');
    const savedTabsStr = localStorage.getItem('nexus_open_tabs');
    if (savedActive) {
        activeCourse = savedActive;
    }
    if (savedTabsStr) {
        try {
            const parsed = JSON.parse(savedTabsStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
                openTabs = parsed;
            }
        } catch(e) {
            console.error("Failed to parse saved tabs", e);
        }
    }
    // Always ensure General is in openTabs
    if (!openTabs.includes('General')) {
        openTabs.unshift('General');
    }

    function saveTabsState() {
        localStorage.setItem('nexus_active_course', activeCourse || 'General');
        localStorage.setItem('nexus_open_tabs', JSON.stringify(openTabs));
    }
    
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
                    if (!openTabs.includes(cname)) openTabs.push(cname);
                    activeCourse = cname;
                    await fetchDocuments();
                    await fetchChatHistory(activeCourse);
                    appendSystemMessage(`Switched to new course: ${cname}`);
                }
            }
            catch (err) {
                console.error(err);
            }
        });
    }
    async function fetchChatHistory(courseName) {
        try {
            const res = await fetch(`/api/chat/history?course=${encodeURIComponent(courseName)}`, {
                headers: { 'X-Session-ID': sessionId }
            });
            if (res.ok) {
                const data = await res.json();
                chatHistory = data.messages || [];
                renderChatHistory();
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderChatHistory() {
        if (!chatArea) return;
        chatArea.innerHTML = '';
        if (chatHistory.length === 0) {
            appendSystemMessage(`System initialized. Upload your study materials or links to begin course context: ${activeCourse}`);
        } else {
            chatHistory.forEach(msg => {
                if (msg.role === 'system') return; // backend doesn't save system but just in case
                appendMessage(msg.role, msg.content);
            });
        }
    }

    async function fetchUserState() {
        try {
            const res = await fetch('/api/user/state', {
                headers: { 'X-Session-ID': sessionId }
            });
            if (res.ok) {
                const data = await res.json();
                const readinessBar = document.getElementById('readiness-bar');
                const readinessText = document.getElementById('readiness-text');
                if (readinessBar && readinessText) {
                    readinessBar.style.width = `${data.readiness}%`;
                    readinessText.textContent = `${data.readiness}%`;
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Course selector removed in favor of tabs
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
    function renderTabs() {
        if (!tabContainer) return;
        saveTabsState();
        tabContainer.innerHTML = '';
        
        if (openTabs.length === 0 && activeCourse) {
            openTabs.push(activeCourse);
        }

        openTabs.forEach(cName => {
            const tab = document.createElement('div');
            tab.className = `course-tab ${cName === activeCourse ? 'active' : ''}`;
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = cName;
            tab.appendChild(titleSpan);
            
            if (cName !== 'General') {
                const closeBtn = document.createElement('button');
                closeBtn.className = 'tab-close-btn';
                closeBtn.innerHTML = '&times;';
                closeBtn.title = "Close tab";
                
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeTab(cName);
                });
                
                tab.appendChild(closeBtn);
            }
            
            tab.addEventListener('click', () => {
                if (activeCourse !== cName) {
                    activeCourse = cName;
                    renderTabs();
                    fetchChatHistory(activeCourse).then(() => {
                        appendSystemMessage(`Active Context changed to: ${activeCourse}`);
                    });
                }
            });
            
            tabContainer.appendChild(tab);
        });
    }

    function closeTab(cName) {
        openTabs = openTabs.filter(t => t !== cName);
        if (activeCourse === cName) {
            if (openTabs.length > 0) {
                activeCourse = openTabs[openTabs.length - 1];
            } else {
                activeCourse = null;
            }
        }
        renderTabs();
        if (activeCourse) {
            fetchChatHistory(activeCourse).then(() => {
                appendSystemMessage(`Active Context changed to: ${activeCourse}`);
            });
        } else {
            if (chatArea) chatArea.innerHTML = '';
            appendSystemMessage("All tabs closed. Select a course from the sidebar to begin.");
        }
    }

    function renderCourses(courses) {
        if (!docListContainer)
            return;
        docListContainer.innerHTML = '';
        const courseNames = Object.keys(courses);
        
        // Filter openTabs to only keep courses that actually exist (plus 'General')
        openTabs = openTabs.filter(t => t === 'General' || courseNames.includes(t));
        
        // Ensure activeCourse is valid and exists in openTabs (or falls back)
        if (!openTabs.includes(activeCourse)) {
            if (openTabs.length > 0) {
                activeCourse = openTabs[openTabs.length - 1];
            } else {
                activeCourse = 'General';
            }
        }
        
        renderTabs();

        courseNames.forEach(cName => {
            const group = document.createElement('div');
            group.className = 'course-group';
            group.style.marginBottom = '1rem';
            const header = document.createElement('div');
            header.className = 'course-header';
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = cName;
            header.appendChild(titleSpan);
            
            const iconSvg = document.createElement('div');
            iconSvg.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.6;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
            iconSvg.style.display = 'flex';
            header.appendChild(iconSvg);
            
            header.addEventListener('click', () => {
                if (!openTabs.includes(cName)) {
                    openTabs.push(cName);
                }
                if (activeCourse !== cName) {
                    activeCourse = cName;
                    renderTabs();
                    fetchChatHistory(activeCourse).then(() => {
                        appendSystemMessage(`Active Context changed to: ${activeCourse}`);
                    });
                } else {
                    renderTabs();
                }
            });

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
        if (!activeCourse) {
            alert("Please open or select a course tab first.");
            return;
        }
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
            const auto_quiz = autoQuizToggle ? autoQuizToggle.checked : false;
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId
                },
                body: JSON.stringify({ messages: chatHistory, search_web, course: activeCourse, auto_quiz: auto_quiz })
            });
            removeMessage(typingId);
            if (res.ok) {
                const data = await res.json();
                chatHistory.push({ role: data.role, content: data.content });
                appendMessage('assistant', data.content, data.inline_quiz);
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
    function appendMessage(role, text, inlineQuiz = null) {
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
        
        if (inlineQuiz && inlineQuiz.questions && inlineQuiz.questions.length > 0) {
            const quizContainer = document.createElement('div');
            quizContainer.className = 'inline-quiz-container';
            quizContainer.style.marginTop = '1rem';
            quizContainer.style.paddingTop = '1rem';
            quizContainer.style.borderTop = '1px solid var(--border)';
            
            const title = document.createElement('div');
            title.style.fontWeight = '600';
            title.style.color = 'var(--primary)';
            title.style.marginBottom = '0.75rem';
            title.textContent = 'Interactive Challenge';
            quizContainer.appendChild(title);
            
            inlineQuiz.questions.forEach((q) => {
                const qDiv = document.createElement('div');
                qDiv.style.marginBottom = '1rem';
                
                const qText = document.createElement('div');
                qText.style.fontWeight = '500';
                qText.style.marginBottom = '0.5rem';
                qText.textContent = q.question;
                qDiv.appendChild(qText);
                
                if (q.type === 'multiple_choice' && q.options) {
                    const optList = document.createElement('div');
                    optList.style.display = 'flex';
                    optList.style.flexDirection = 'column';
                    optList.style.gap = '0.5rem';
                    
                    Object.entries(q.options).forEach(([key, val]) => {
                        const btn = document.createElement('button');
                        btn.className = 'secondary-btn inline-quiz-opt';
                        btn.style.textAlign = 'left';
                        btn.style.justifyContent = 'flex-start';
                        btn.style.whiteSpace = 'normal';
                        btn.style.padding = '0.5rem 0.75rem';
                        btn.innerHTML = `<strong style="margin-right: 0.5rem;">${key}</strong> ${val}`;
                        
                        btn.addEventListener('click', async () => {
                            btn.innerHTML = `<strong style="margin-right: 0.5rem;">...</strong> Submitting...`;
                            try {
                                const res = await fetch('/api/quiz/submit', {
                                    method: 'POST',
                                    headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({
                                        quiz_id: inlineQuiz.quiz_id,
                                        answers: { [q.id]: key }
                                    })
                                });
                                const resultData = await res.json();
                                const ansInfo = resultData.questions_analysis[0];
                                
                                // Disable all
                                optList.querySelectorAll('button').forEach(b => {
                                    b.disabled = true;
                                    b.style.opacity = '0.5';
                                    b.style.cursor = 'not-allowed';
                                });
                                
                                btn.style.opacity = '1';
                                btn.innerHTML = `<strong style="margin-right: 0.5rem;">${key}</strong> ${val}`;
                                if (ansInfo.is_correct) {
                                    btn.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                                    btn.style.borderColor = '#10b981';
                                } else {
                                    btn.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                    btn.style.borderColor = '#ef4444';
                                }
                                
                                const feedback = document.createElement('div');
                                feedback.style.marginTop = '0.5rem';
                                feedback.style.fontSize = '0.85rem';
                                feedback.style.color = ansInfo.is_correct ? '#10b981' : '#ef4444';
                                feedback.textContent = ansInfo.feedback;
                                qDiv.appendChild(feedback);
                                
                            } catch (err) {
                                console.error(err);
                                btn.textContent = 'Error submitting';
                            }
                        });
                        optList.appendChild(btn);
                    });
                    qDiv.appendChild(optList);
                }
                quizContainer.appendChild(qDiv);
            });
            bubble.appendChild(quizContainer);
        }
        
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
    
    async function init() {
        await fetchDocuments();
        await fetchUserState();
        await fetchChatHistory(activeCourse);
    }
    init();
});
