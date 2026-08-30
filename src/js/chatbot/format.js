export function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function renderMarkdown(text) {
    // Split on fenced code blocks first so we don't mangle them
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            const code = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
            return `<pre style="white-space:pre-wrap;margin:0.4em 0;padding:0.5em;background:rgba(0,0,0,0.3);border-radius:3px;font-size:0.85em"><code>${escapeHtml(code)}</code></pre>`;
        }
        let p = escapeHtml(part);
        // Inline code
        p = p.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:0.1em 0.3em;border-radius:2px;font-size:0.88em">$1</code>');
        // Headers → bold + line break
        p = p.replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>');
        // Bold
        p = p.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        p = p.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        // HR
        p = p.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid rgba(212,165,116,0.3);margin:0.5em 0">');
        // List items — collect runs then wrap
        p = p.replace(/((?:^[*-] .+\n?)+)/gm, match => {
            const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[*-] /, '')}</li>`).join('');
            return `<ul style="margin:0.4em 0;padding-left:1.4em">${items}</ul>`;
        });
        // Paragraph breaks
        p = p.replace(/\n\n+/g, '<br><br>');
        p = p.replace(/\n/g, '<br>');
        return p;
    }).join('');
}
export function saveToLocalStorage(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (error) { console.error('Error saving to localStorage:', error); }
}
export function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return null;
    }
}
