// 7. 테마: 주입 CSS를 하나씩 넣고 계산값이 바뀌는지 본 뒤 지운다.
// page.evaluate로 넘기므로 이 함수는 바깥 변수를 쓰지 않는다.

export async function themeTest(rootId) {
  const rootEl = document.getElementById(rootId);
  const td = [...rootEl.querySelectorAll('.w2grid tbody td.gridBodyDefault_data')]
    .find((e) => e.getClientRects().length > 0);
  const lbl = rootEl.querySelector('label[for]');
  if (!td || !lbl) return { skipped: 'no grid row or label' };
  const firstFont = (el) => getComputedStyle(el).fontFamily.split(',')[0].replace(/"/g, '');
  const measure = () => ({
    font: firstFont(td),
    lblFont: firstFont(lbl),
    size: getComputedStyle(td).fontSize,
    rowH: Math.round(td.closest('tr').getBoundingClientRect().height),
    bg: getComputedStyle(document.body).backgroundColor,
  });
  const tick = () => new Promise((r) => setTimeout(r, 300));
  const cases = {
    'body *{font-family}': 'body, body *{font-family:"Courier New",monospace !important}',
    '.w2grid .gridBodyDefault{font-size}': '.w2grid .gridBodyDefault{font-size:12px !important}',
    '.w2grid .gridBodyDefault{height}': '.w2grid .gridBodyDefault{height:28px !important}',
    // 두 줄 셀이 있는 그리드는 height만으로는 내용 높이 밑으로 안 줄어든다.
    '.w2grid .gridBodyDefault{height+padding+font-size+line-height}':
      '.w2grid .gridBodyDefault{height:28px !important;padding-top:0 !important;padding-bottom:0 !important;'
      + 'font-size:12px !important;line-height:14px !important}'
      + '.w2grid .gridBodyDefault *{line-height:14px !important}',
    'body{background}': 'body{background-color:rgb(1, 2, 3) !important}',
  };

  const st = document.createElement('style');
  document.head.appendChild(st);
  const base = measure();
  const cells = [...td.closest('tbody').querySelectorAll('td.gridBodyDefault_data')];
  const isTwoLine = (t) => t.firstElementChild && t.firstElementChild.getBoundingClientRect().height > 24;
  const out = { base, multiLineCells: cells.filter(isTwoLine).length };
  for (const [name, css] of Object.entries(cases)) {
    st.textContent = css;
    await tick();
    const now = measure();
    const changed = Object.keys(now).filter((k) => now[k] !== base[k]);
    out[name] = Object.fromEntries(changed.map((k) => [k, now[k]]));
  }
  st.remove();
  await tick();
  out.restored = JSON.stringify(measure()) === JSON.stringify(base);
  return out;
}
