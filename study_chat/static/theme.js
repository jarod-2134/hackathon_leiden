"use strict";
(function () {
    const savedTheme = localStorage.getItem('nexus_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');
    if (savedTheme === 'ocean') document.body.classList.add('theme-ocean');
    if (savedTheme === 'forest') document.body.classList.add('theme-forest');
})();
function getSessionId() {
    let sid = localStorage.getItem('nexus_session_id');
    if (!sid) {
        sid = 'sess-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('nexus_session_id', sid);
    }
    return sid;
}
getSessionId();

document.addEventListener('DOMContentLoaded', () => {
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        const savedTheme = localStorage.getItem('nexus_theme') || 'light';
        themeSelector.value = savedTheme;
        
        themeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.classList.remove('dark-theme', 'theme-ocean', 'theme-forest');
            if (newTheme === 'dark') document.body.classList.add('dark-theme');
            else if (newTheme === 'ocean') document.body.classList.add('theme-ocean');
            else if (newTheme === 'forest') document.body.classList.add('theme-forest');
            
            localStorage.setItem('nexus_theme', newTheme);
        });
    }
});
