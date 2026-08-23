export function enhanceWikiLinkedLists() {
  const shells = document.querySelectorAll('.vos-is-wiki-page .vos-page-shell:not(.vos-home-shell)');
  shells.forEach((shell) => {
    shell.querySelectorAll(':scope > ul, :scope > ol').forEach((list) => {
      const items = Array.from(list.children).filter((item) => item.matches('li'));
      if (items.length < 2) return;

      const linkedItems = items.filter((item) => item.querySelector('a[href]'));
      const mostlyLinks = linkedItems.length === items.length ||
        (linkedItems.length >= 3 && linkedItems.length / items.length >= 0.7);
      if (!mostlyLinks) return;

      list.classList.add('vos-linked-row-list');
      items.forEach((item) => {
        const firstLink = item.querySelector('a[href]');
        if (!firstLink) return;

        item.classList.add('vos-linked-row');
        item.setAttribute('role', 'link');
        item.setAttribute('tabindex', '0');
        item.addEventListener('click', (event) => {
          if (event.target.closest('a, button, input, textarea, select, label')) return;
          window.location.href = firstLink.href;
        });
        item.addEventListener('keydown', (event) => {
          if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          window.location.href = firstLink.href;
        });
      });
    });
  });
}
