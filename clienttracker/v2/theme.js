// ClientTracker v2 — applies the saved theme before first paint (kept out of the HTML: no inline scripts, T-5).
try { const t = JSON.parse(localStorage.getItem('ct2-theme')); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
