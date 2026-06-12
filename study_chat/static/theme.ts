// theme.ts
// Handles the global theme state logic.
// This is loaded in the <head> or at start of <body> on all pages.

(function() {
    const savedTheme = localStorage.getItem('nexus_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');
    if (savedTheme === 'ocean') document.body.classList.add('theme-ocean');
    if (savedTheme === 'forest') document.body.classList.add('theme-forest');
})();

// Global session ID management
function getSessionId(): string {
    let sid = localStorage.getItem('nexus_session_id');
    if (!sid) {
        sid = 'sess-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('nexus_session_id', sid);
    }
    return sid;
}

// Ensure it exists on load
getSessionId();
