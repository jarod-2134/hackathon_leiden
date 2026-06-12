"use strict";
document.addEventListener('DOMContentLoaded', () => {
    // Theme logic moved to global theme.js
    
    // Web Search Toggle
    const searchWebToggle = document.getElementById('search-web-toggle');
    
    const savedSearchWeb = localStorage.getItem('nexus_search_web');
    if (savedSearchWeb === 'true' && searchWebToggle) {
        searchWebToggle.checked = true;
    }
    
    if (searchWebToggle) {
        searchWebToggle.addEventListener('change', (e) => {
            const target = e.target;
            if (target.checked) {
                localStorage.setItem('nexus_search_web', 'true');
            } else {
                localStorage.setItem('nexus_search_web', 'false');
            }
        });
    }
});
