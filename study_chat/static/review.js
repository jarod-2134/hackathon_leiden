"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const summaryEl = document.getElementById('quiz-summary');

    let chatHistory = [];
    let quizAvailable = false;

    // --- LOAD QUIZ SUMMARY INTO SIDEBAR ---
    async function loadSummary() {
        try {
            const res = await fetch('/api/quiz/results');
            const data = await res.json();
            if (!data.available) {
                summaryEl.innerHTML = `
                    <div style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.5;">
                        No quiz results yet.<br><br>
                        <a href="/quiz" class="nav-link" style="color: var(--accent, var(--text-main)); text-decoration: underline;">Take a quiz</a>
                        first, then come back here to review it.
                    </div>`;
                appendSystemMessage("No quiz results found. Take a quiz first, then return to review it.");
                return;
            }
            quizAvailable = true;
            renderSummary(data.result);
        } catch (err) {
            console.error(err);
            summaryEl.innerHTML = `<div style="color: #ef4444; font-size: 0.9rem;">Failed to load quiz results.</div>`;
        }
    }

    function renderSummary(r) {
        const fs = r.feedback_summary || {};
        const strong = Array.isArray(fs.strong_points) ? fs.strong_points : (fs.strong_points ? [fs.strong_points] : []);
        const weak = Array.isArray(fs.weak_points) ? fs.weak_points : (fs.weak_points ? [fs.weak_points] : []);

        let html = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 2.5rem; font-weight: 700; color: var(--text-main);">${r.overall_score_pct}%</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Overall Score</div>
            </div>`;

        if (r.multiple_choice) {
            html += `<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                Multiple choice: <strong style="color: var(--text-main);">${r.multiple_choice.correct}/${r.multiple_choice.total} (${r.multiple_choice.score_pct}%)</strong></div>`;
        }
        if (r.open_ended) {
            html += `<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                Open-ended avg: <strong style="color: var(--text-main);">${r.open_ended.score_pct}%</strong></div>`;
        }

        if (weak.length) {
            html += `<h3 style="font-size: 0.9rem; margin: 1rem 0 0.5rem; color: var(--text-main);">Weak Topics</h3><ul style="margin: 0; padding-left: 1.1rem; font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">`;
            weak.forEach(w => { html += `<li>${escapeHtml(w)}</li>`; });
            html += `</ul>`;
        }
        if (strong.length) {
            html += `<h3 style="font-size: 0.9rem; margin: 1rem 0 0.5rem; color: var(--text-main);">Strong Topics</h3><ul style="margin: 0; padding-left: 1.1rem; font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">`;
            strong.forEach(s => { html += `<li>${escapeHtml(s)}</li>`; });
            html += `</ul>`;
        }
        summaryEl.innerHTML = html;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- CHAT ---
    if (messageInput) {
        messageInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    async function sendMessage() {
        if (!messageInput) return;
        const content = messageInput.value.trim();
        if (!content) return;

        if (!quizAvailable) {
            appendSystemMessage("No quiz results loaded yet. Take a quiz first.");
            return;
        }

        appendMessage('user', content);
        messageInput.value = '';
        messageInput.style.height = 'auto';
        chatHistory.push({ role: 'user', content });
        const typingId = appendTypingIndicator();

        try {
            const res = await fetch('/api/quiz/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistory })
            });
            removeMessage(typingId);
            if (res.ok) {
                const data = await res.json();
                chatHistory.push({ role: data.role, content: data.content });
                appendMessage('assistant', data.content);
            } else {
                const err = await res.json().catch(() => ({}));
                appendSystemMessage(err.detail || "Error connecting to the review tutor.");
            }
        } catch (err) {
            console.error(err);
            removeMessage(typingId);
            appendSystemMessage("Network error.");
        }
    }

    function appendMessage(role, text) {
        if (!chatArea) return;
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
        if (!chatArea) return;
        const div = document.createElement('div');
        div.className = 'message system-msg';
        div.innerHTML = `
            <div class="avatar" style="background: transparent; color: var(--text-muted); border: none;">[SYS]</div>
            <div class="bubble" style="color: var(--text-muted); font-style: italic; background: transparent; border: none; padding-left: 0;">${text}</div>`;
        chatArea.appendChild(div);
        scrollToBottom();
    }
    function appendTypingIndicator() {
        if (!chatArea) return '';
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.className = 'message assistant-msg';
        div.id = id;
        div.innerHTML = `<div class="avatar">N</div><div class="bubble" style="color: var(--text-muted);">Analyzing...</div>`;
        chatArea.appendChild(div);
        scrollToBottom();
        return id;
    }
    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
    function scrollToBottom() {
        if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
    }

    loadSummary();
});
