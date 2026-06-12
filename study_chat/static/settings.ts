// settings.ts
// Handles the settings logic.

document.addEventListener('DOMContentLoaded', () => {
    const themeSelector = document.getElementById('theme-selector') as HTMLSelectElement;
    const searchWebToggle = document.getElementById('search-web-toggle') as HTMLInputElement;

    // Load initial states
    const savedTheme = localStorage.getItem('nexus_theme') || 'light';
    if (themeSelector) {
        themeSelector.value = savedTheme;
    }

    const savedSearchWeb = localStorage.getItem('nexus_search_web');
    if (savedSearchWeb === 'true' && searchWebToggle) {
        searchWebToggle.checked = true;
    }

    // Event Listeners
    if (themeSelector) {
        themeSelector.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            const newTheme = target.value;
            localStorage.setItem('nexus_theme', newTheme);
            
            document.body.classList.remove('dark-theme', 'theme-ocean', 'theme-forest');
            
            if (newTheme === 'dark') document.body.classList.add('dark-theme');
            if (newTheme === 'ocean') document.body.classList.add('theme-ocean');
            if (newTheme === 'forest') document.body.classList.add('theme-forest');
        });
    }

    searchWebToggle.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
            localStorage.setItem('nexus_search_web', 'true');
        } else {
            localStorage.setItem('nexus_search_web', 'false');
        }
    });
});
