"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('dnd-overlay');
    if (!overlay) return;

    let dragCounter = 0;
    const sessionId = localStorage.getItem('nexus_session_id') || 'default';

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.remove('hidden');
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            overlay.classList.add('hidden');
        }
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('drop', async (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.add('hidden');

        if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        const file = e.dataTransfer.files[0];

        const formData = new FormData();
        formData.append('file', file);

        try {
            // Upload the file
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'X-Session-ID': sessionId },
                body: formData
            });
            
            if (res.ok) {
                // If not on chat page, redirect
                if (!window.location.href.includes('chat.html')) {
                    window.location.href = '/static/chat.html';
                } else {
                    // We are on chat, reload documents (a simple reload of page or calling fetchDocuments)
                    // We can just reload to trigger the document fetch if we don't have access to chat.js scope
                    window.location.reload();
                }
            } else {
                alert('Drop upload failed');
            }
        } catch (err) {
            console.error(err);
        }
    });
});
