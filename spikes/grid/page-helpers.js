// addInitScript로 모든 페이지에 먼저 깔린다. 측정은 DOM이 기대한 글자가 되는 순간의 performance.now()다.
(() => {
  const frames = [];
  let recording = false;

  const cellText = (row, colId) => {
    const found = document.querySelector(window.__spike.sel.cell(row, colId));
    return found ? found.textContent.trim() : null;
  };

  function waitFor(predicate, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const finish = (fn, value) => { observer.disconnect(); clearInterval(poll); fn(value); };
      const check = () => {
        try { if (predicate()) finish(resolve, performance.now()); } catch { /* 아직 안 만들어짐 */ }
      };
      const observer = new MutationObserver(check);
      observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
      const poll = setInterval(() => {
        if (performance.now() - startedAt > timeoutMs) finish(reject, new Error('timeout'));
        else check();
      }, 5);
      check();
    });
  }

  function startFrames() {
    frames.length = 0;
    recording = true;
    const tick = (t) => { if (recording) { frames.push(t); requestAnimationFrame(tick); } };
    requestAnimationFrame(tick);
  }

  function stopFrames() {
    recording = false;
    return frames.slice();
  }

  const atEnd = (selector, axis) => {
    const el = document.querySelector(selector);
    return axis === 'v' ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2
      : el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
  };

  window.__h = { waitFor, cellText, startFrames, stopFrames, atEnd };
  window.__firstRowAt = waitFor(() => cellText(0, 'c0')).catch(() => null);
})();
