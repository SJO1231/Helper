// addInitScript로 뷰어 페이지에 먼저 깔린다. 시각은 페이지 안 performance.now()라 Playwright 왕복이 끼지 않는다.
// "그려졌다"는 DOM이 기대한 글자가 된 뒤 첫 requestAnimationFrame이 불린 때다.
(() => {
  const frames = [];
  let recording = false;

  // AG Grid의 DOM 이름은 여기 한 곳에만 둔다.
  const SEL = {
    cell: (row, colId) => `.ag-row[row-index="${row}"] .ag-cell[col-id="${colId}"]`,
    header: (colId) => `.ag-header-cell[col-id="${colId}"]`,
    floatingInput: (colId) => `.ag-floating-filter[col-id="${colId}"] input`,
    // 36.x는 세로·가로가 한 뷰포트에서 같이 스크롤된다.
    vScroll: '.ag-grid-viewport',
    hScroll: '.ag-grid-viewport',
  };

  const cellText = (row, colId) => {
    const found = document.querySelector(SEL.cell(row, colId));
    return found ? found.textContent.trim() : null;
  };

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(performance.now())));

  function waitFor(predicate, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const finish = (action, value) => {
        observer.disconnect();
        clearInterval(poll);
        action(value);
      };
      const check = () => {
        try {
          if (predicate()) finish(resolve, null);
        } catch {
          // 아직 만들어지지 않은 DOM
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
      const poll = setInterval(() => {
        if (performance.now() - startedAt > timeoutMs) finish(reject, new Error('timeout'));
        else check();
      }, 5);
      check();
    }).then(nextFrame);
  }

  function startFrames() {
    frames.length = 0;
    recording = true;
    const tick = (time) => {
      if (!recording) return;
      frames.push(time);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function stopFrames() {
    recording = false;
    return frames.slice();
  }

  const atEnd = (selector, axis) => {
    const element = document.querySelector(selector);
    if (axis === 'v') return element.scrollTop + element.clientHeight >= element.scrollHeight - 2;
    return element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
  };

  window.__h = { SEL, waitFor, cellText, startFrames, stopFrames, atEnd };
  // 페이지 이동 시작(performance.now() == 0)부터 첫 행 글자가 그려질 때까지.
  window.__firstRowAt = waitFor(() => cellText(0, 'key00')).catch(() => null);
})();
