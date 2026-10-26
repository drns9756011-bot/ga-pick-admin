(() => {
  const release = '20261026-history-shell';
  let checking = false;
  window.addEventListener('pageshow', async (event) => {
    if (!event.persisted || checking) return;
    checking = true;
    try {
      const response = await fetch('/admin-release.json', {
        cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return;
      const current = await response.json();
      if (typeof current.version === 'string' && current.version !== release) location.reload();
    } catch {
      // Keep the restored page usable when the release check is offline.
    } finally {
      checking = false;
    }
  });
})();
