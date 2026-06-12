// dnd.js
// Handles global drag and drop for both homepage and chat

document.addEventListener('DOMContentLoaded', () => {
    // Create overlay if not exists
    let overlay = document.querySelector('.dnd-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'dnd-overlay hidden';
        overlay.innerHTML = `
            <div class="dnd-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <h2>Drop file to upload</h2>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.remove('hidden');
    });

    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            overlay.classList.add('hidden');
        }
    });

    document.addEventListener('drop', async (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.add('hidden');

        if (!e.dataTransfer || !e.dataTransfer.files.length) return;
        const file = e.dataTransfer.files[0];

        // Determine course
        const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
        let courseName = 'General';
        
        if (isHomePage) {
            let userPrompt = prompt(`Enter course name for ${file.name}:`, 'General');
            if (!userPrompt || !userPrompt.trim()) return; // Cancelled
            courseName = userPrompt.trim();
        } else {
            // We are in chat, load the current active course from localStorage
            courseName = localStorage.getItem('nexus_active_course') || 'General';
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('course', courseName);
        
        const sessionId = localStorage.getItem('nexus_session_id') || 'default';

        try {
            console.log(`Uploading ${file.name} to ${courseName}...`);
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'X-Session-ID': sessionId },
                body: formData
            });

            if (res.ok) {
                if (isHomePage) {
                    window.location.href = '/static/chat.html';
                } else {
                    // We are in chat, trigger a reload or UI update
                    // Since dnd is global, we can just reload the page or dispatch an event
                    window.location.reload(); 
                }
            } else {
                alert('Upload failed');
            }
        } catch (err) {
            console.error(err);
            alert('Upload error');
        }
    });
});
