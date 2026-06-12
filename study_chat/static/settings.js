"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const searchWebToggle = document.getElementById('search-web-toggle');
    const resetDataBtn = document.getElementById('reset-data-btn');
    const inspectorContainer = document.getElementById('inspector-container');
    
    // Preview Modal Elements
    const previewModal = document.getElementById('preview-modal');
    const previewTitle = document.getElementById('preview-modal-title');
    const previewBody = document.getElementById('preview-modal-body');
    const closePreviewBtn = document.getElementById('close-preview-modal');

    // Get Session ID helper
    function getSessionId() {
        let sid = localStorage.getItem('nexus_session_id');
        if (!sid) {
            sid = 'sess-' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('nexus_session_id', sid);
        }
        return sid;
    }
    const sessionId = getSessionId();

    // 1. Web Search Toggle Initialization and Event
    const savedSearchWeb = localStorage.getItem('nexus_search_web');
    if (savedSearchWeb === 'true' && searchWebToggle) {
        searchWebToggle.checked = true;
    }
    
    if (searchWebToggle) {
        searchWebToggle.addEventListener('change', (e) => {
            localStorage.setItem('nexus_search_web', e.target.checked ? 'true' : 'false');
        });
    }

    // 2. Reset User Data Handler
    if (resetDataBtn) {
        resetDataBtn.addEventListener('click', async () => {
            const confirmed = confirm(
                "Are you sure you want to permanently reset all user data?\n\n" +
                "This will delete all uploaded syllabus files, scraped links, chat logs, readiness scores, and active courses. This cannot be undone."
            );
            if (!confirmed) return;

            try {
                resetDataBtn.disabled = true;
                resetDataBtn.textContent = "Resetting...";
                
                const res = await fetch('/api/reset', {
                    method: 'POST',
                    headers: { 'X-Session-ID': sessionId }
                });

                if (res.ok) {
                    alert("All user data has been successfully reset.");
                    
                    // Clear all related localStorage items to ensure clean state
                    localStorage.removeItem('nexus_active_course');
                    localStorage.removeItem('nexus_open_tabs');
                    localStorage.removeItem('nexus_search_web');
                    localStorage.removeItem('nexus_session_id'); // Regenerate session id next load
                    
                    window.location.href = "/static/index.html";
                } else {
                    alert("Failed to reset user data. Server returned an error.");
                    resetDataBtn.disabled = false;
                    resetDataBtn.textContent = "Reset All Data";
                }
            } catch (err) {
                console.error(err);
                alert("Network error occurred while resetting data.");
                resetDataBtn.disabled = false;
                resetDataBtn.textContent = "Reset All Data";
            }
        });
    }

    // 3. Document Inspector Logic
    async function loadInspector() {
        if (!inspectorContainer) return;

        try {
            const res = await fetch('/api/documents', {
                headers: { 'X-Session-ID': sessionId }
            });
            if (!res.ok) {
                inspectorContainer.innerHTML = `<p style="color: #ef4444; font-style: italic;">Failed to fetch active contexts.</p>`;
                return;
            }
            const courses = await res.json();
            renderInspector(courses);
        } catch (err) {
            console.error(err);
            inspectorContainer.innerHTML = `<p style="color: #ef4444; font-style: italic;">Network error loading inspector.</p>`;
        }
    }

    function renderInspector(courses) {
        inspectorContainer.innerHTML = '';
        const courseNames = Object.keys(courses);

        if (courseNames.length === 0 || courseNames.every(name => courses[name].length === 0)) {
            inspectorContainer.innerHTML = `<p style="color: var(--text-muted); font-style: italic; font-size: 0.95rem;">No active course contexts are loaded. Upload study materials in the Chat interface to populate them.</p>`;
            return;
        }

        courseNames.forEach(cName => {
            const docs = courses[cName];
            if (docs.length === 0) return; // Skip empty courses for cleaner display

            const courseCard = document.createElement('div');
            courseCard.style.background = 'var(--bg-surface)';
            courseCard.style.border = '1px solid var(--border)';
            courseCard.style.borderRadius = '6px';
            courseCard.style.padding = '1.25rem';

            const title = document.createElement('h4');
            title.style.margin = '0 0 1rem 0';
            title.style.color = 'var(--accent-primary)';
            title.style.fontSize = '1rem';
            title.style.fontWeight = '600';
            title.style.letterSpacing = '0.05rem';
            title.textContent = `Course: ${cName.toUpperCase()}`;
            courseCard.appendChild(title);

            const docList = document.createElement('div');
            docList.style.display = 'flex';
            docList.style.flexDirection = 'column';
            docList.style.gap = '0.75rem';

            docs.forEach(doc => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.background = 'var(--bg-base)';
                item.style.border = '1px solid var(--border)';
                item.style.borderRadius = '4px';
                item.style.padding = '0.75rem 1rem';
                item.style.gap = '1rem';

                // Document Info Left Column
                const infoCol = document.createElement('div');
                infoCol.style.overflow = 'hidden';
                infoCol.style.flex = '1';

                const badge = document.createElement('span');
                badge.style.display = 'inline-block';
                badge.style.fontSize = '0.7rem';
                badge.style.fontWeight = '700';
                badge.style.padding = '0.15rem 0.4rem';
                badge.style.borderRadius = '3px';
                badge.style.marginRight = '0.5rem';
                badge.style.textTransform = 'uppercase';

                if (doc.source_type === 'url') {
                    badge.textContent = 'Link';
                    badge.style.background = 'rgba(2, 132, 199, 0.15)';
                    badge.style.color = 'var(--accent-primary)';
                } else {
                    badge.textContent = 'File';
                    badge.style.background = 'rgba(22, 101, 52, 0.15)';
                    badge.style.color = 'var(--text-muted)';
                }
                infoCol.appendChild(badge);

                const nameSpan = document.createElement('span');
                nameSpan.style.fontSize = '0.9rem';
                nameSpan.style.color = 'var(--text-main)';
                nameSpan.style.wordBreak = 'break-all';
                
                if (doc.source_type === 'url') {
                    const link = document.createElement('a');
                    link.href = doc.source_name;
                    link.target = '_blank';
                    link.style.color = 'var(--accent-primary)';
                    link.style.textDecoration = 'underline';
                    link.textContent = doc.source_name;
                    nameSpan.appendChild(link);
                } else {
                    nameSpan.textContent = doc.source_name;
                }
                infoCol.appendChild(nameSpan);
                item.appendChild(infoCol);

                // Actions Right Column
                const inspectBtn = document.createElement('button');
                inspectBtn.className = 'btn';
                inspectBtn.style.padding = '0.4rem 0.8rem';
                inspectBtn.style.fontSize = '0.8rem';
                inspectBtn.textContent = 'View Value';
                
                inspectBtn.addEventListener('click', async () => {
                    inspectBtn.disabled = true;
                    inspectBtn.textContent = 'Loading...';
                    try {
                        const detailRes = await fetch(`/api/documents/${doc.id}/content`, {
                            headers: { 'X-Session-ID': sessionId }
                        });
                        if (detailRes.ok) {
                            const detailData = await detailRes.json();
                            previewTitle.textContent = doc.source_name;
                            previewBody.textContent = detailData.content || "(No text value extracted)";
                            previewModal.classList.add('active');
                        } else {
                            alert("Failed to load document content.");
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Network error loading document content.");
                    } finally {
                        inspectBtn.disabled = false;
                        inspectBtn.textContent = 'View Value';
                    }
                });
                item.appendChild(inspectBtn);

                docList.appendChild(item);
            });

            courseCard.appendChild(docList);
            inspectorContainer.appendChild(courseCard);
        });
    }

    // 4. Modal Interactions
    if (closePreviewBtn && previewModal) {
        closePreviewBtn.addEventListener('click', () => {
            previewModal.classList.remove('active');
        });

        // Close on background click
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) {
                previewModal.classList.remove('active');
            }
        });
    }

    // Load contexts on settings page startup
    loadInspector();
});
