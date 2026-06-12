"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const themeSelector = document.getElementById('theme-selector');
    const searchWebToggle = document.getElementById('search-web-toggle');
    
    const savedTheme = localStorage.getItem('nexus_theme') || 'light';
    if (themeSelector) {
        themeSelector.value = savedTheme;
    }
    
    const savedSearchWeb = localStorage.getItem('nexus_search_web');
    if (savedSearchWeb === 'true' && searchWebToggle) {
        searchWebToggle.checked = true;
    }
    
    if (themeSelector) {
        themeSelector.addEventListener('change', (e) => {
            const target = e.target;
            const newTheme = target.value;
            localStorage.setItem('nexus_theme', newTheme);
            
            // Remove existing theme classes
            document.body.classList.remove('dark-theme', 'theme-ocean', 'theme-forest');
            
            // Add new theme class if not light
            if (newTheme === 'dark') document.body.classList.add('dark-theme');
            if (newTheme === 'ocean') document.body.classList.add('theme-ocean');
            if (newTheme === 'forest') document.body.classList.add('theme-forest');
        });
    }
    searchWebToggle.addEventListener('change', (e) => {
        const target = e.target;
        if (target.checked) {
            localStorage.setItem('nexus_search_web', 'true');
        } else {
            localStorage.setItem('nexus_search_web', 'false');
        }
    });
});
