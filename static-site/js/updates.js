class UpdatesManager {
    constructor() {
        this.updates = [];
        this.updatesFilePath = 'data/updates.json';
    }
    async init() {
        await this.loadUpdates();
        this.displayLatestUpdate();
        this.displayRecentUpdates();
        this.displayUpcomingSession();
    }
    async loadUpdates() {
        try {
            const data = await fetchJSON(this.updatesFilePath);
            this.updates = data.updates || [];
            this.updates.sort((a, b) => new Date(b.date) - new Date(a.date));
            console.log(`Loaded ${this.updates.length} updates`);
        } catch (error) {
            console.error('Failed to load updates:', error);
            this.updates = [];
        }
    }
    displayLatestUpdate() {
        const container = document.getElementById('latest-update');
        if (!container) return;
        if (this.updates.length === 0) {
            showError(container, 'No updates available');
            return;
        }
        const latest = this.updates[0];
        container.innerHTML = this.createHeroUpdateHTML(latest);
    }
    createHeroUpdateHTML(update) {
        return `
            <div class="update-header">
                <span class="update-type-badge">${getUpdateTypeBadge(update.type)}</span>
                <h1 class="update-title">${update.title}</h1>
                <div class="update-meta">
                    <span>📅 ${formatDate(update.date)}</span>
                    <span>⏰ ${getRelativeTime(update.date)}</span>
                    ${update.session ? `<span>🎲 Session ${update.session}</span>` : ''}
                </div>
            </div>
            <div class="update-content">
                <p>${update.content}</p>
                ${update.wikiLink ? `<a href="${update.wikiLink}" class="read-more">Read More in Wiki →</a>` : ''}
            </div>
            ${update.tags ? this.createTagsHTML(update.tags) : ''}
        `;
    }
    displayRecentUpdates() {
        const container = document.getElementById('recent-updates');
        if (!container) return;
        const recentUpdates = this.updates.slice(1, 6);
        if (recentUpdates.length === 0) {
            container.innerHTML = '<p>No recent updates</p>';
            return;
        }
        container.innerHTML = recentUpdates.map(update => 
            this.createUpdateCardHTML(update)
        ).join('');
    }
    createUpdateCardHTML(update) {
        return `
            <div class="update-card">
                <span class="update-type-badge">${getUpdateTypeBadge(update.type)}</span>
                <h3>${update.title}</h3>
                <div class="update-meta">
                    <span>📅 ${formatDate(update.date)}</span>
                    <span>⏰ ${getRelativeTime(update.date)}</span>
                </div>
                <p>${truncateText(update.content, 200)}</p>
                ${update.wikiLink ? `<a href="${update.wikiLink}" class="read-more">Read More →</a>` : ''}
                ${update.tags ? this.createTagsHTML(update.tags) : ''}
            </div>
        `;
    }
    createTagsHTML(tags) {
        return `
            <div class="update-tags">
                ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        `;
    }
    displayUpcomingSession() {
        const container = document.getElementById('upcoming-session');
        if (!container) return;
        const nextSession = {
            date: '2026-01-20',
            time: '7:00 PM',
            location: 'The Tavern Room',
            agenda: 'Continue the assault on the Crimson Hand stronghold'
        };
        container.innerHTML = `
            <div class="session-info">
                <h3>📅 ${formatDate(nextSession.date)} at ${nextSession.time}</h3>
                <p><strong>Location:</strong> ${nextSession.location}</p>
                <p><strong>Agenda:</strong> ${nextSession.agenda}</p>
            </div>
        `;
    }
}
async function loadRecentWikiEdits() {
    const container = document.getElementById('recent-wiki-edits');
    if (!container) return;
    const recentEdits = [
        { title: 'Valdris the Blade', url: '/wiki/npcs/valdris', time: '2 hours ago' },
        { title: 'Thornkeep Districts', url: '/wiki/locations/thornkeep', time: '1 day ago' },
        { title: 'The Crimson Hand', url: '/wiki/factions/crimson-hand', time: '2 days ago' },
        { title: 'Session 47 Recap', url: '/wiki/sessions/session-47', time: '3 days ago' }
    ];
    container.innerHTML = recentEdits.map(edit => `
        <div class="wiki-edit-item">
            <a href="${edit.url}" class="wiki-edit-title">${edit.title}</a>
            <div class="wiki-edit-time">${edit.time}</div>
        </div>
    `).join('');
}
document.addEventListener('DOMContentLoaded', async () => {
    const updatesManager = new UpdatesManager();
    await updatesManager.init();
    await loadRecentWikiEdits();
});
