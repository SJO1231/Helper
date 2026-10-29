// 엑셀 기준 진단: 엑셀을 누른 뒤 안내창·새 창·파일 응답·다운로드·눌린 사이트 버튼·새 레이어 제목만 모은다.
// 판정에는 쓰지 않는다. 경로만 남기고 쿼리값·화면 데이터는 남기지 않는다.
const WATCH_MS = 15000;
const FILE_TYPE = /excel|spreadsheet|octet-stream|zip/i;
const LAYER_ID = /(_header|_title|_popup|_window|_layer)/i;

const pathOf = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return '(알 수 없음)';
  }
};

// 사이트 쪽에서 실제로 click이 간 요소의 버튼 자체 정보. 확장이 el.click()으로 눌러도 잡힌다.
const installClickRecorder = (page) => page.evaluate(() => {
  window.__excelClicks = [];
  document.addEventListener('click', (e) => {
    const el = e.target;
    window.__excelClicks.push({
      tag: el.tagName.toLowerCase(),
      idPrefix: (el.id || '').slice(0, 12),
      label: (el.value || el.textContent || el.alt || '').replace(/\s+/g, ' ').trim().slice(0, 20),
      hasOnclick: Boolean(el.getAttribute('onclick')),
    });
  }, true);
});

// 확장이 WebSquare trigger로 눌렀는지 보려고 모든 프레임의 컴포넌트 trigger/fireEvent 호출을 센다(id 앞 12자만).
const installTriggerSpy = async (page) => {
  for (const frame of page.frames()) {
    await frame.evaluate(() => {
      const util = window.WebSquare?.util;
      if (!util || util.__spied) return;
      const original = util.getComponentById.bind(util);
      util.__spied = true;
      window.__excelTriggers = [];
      // 둘째 인자(스코프)를 떨어뜨리면 사이트의 $p.getComponentById가 맵을 못 찾아 "Map Id" 안내창이 뜬다.
      util.getComponentById = (id, ...rest) => {
        const component = original(id, ...rest);
        for (const name of ['trigger', 'fireEvent']) {
          if (component && typeof component[name] === 'function' && !component[name].__spied) {
            const fn = component[name].bind(component);
            component[name] = (...args) => {
              window.__excelTriggers.push({ 방법: name, idPrefix: String(id).slice(0, 12), 이벤트: String(args[0]) });
              return fn(...args);
            };
            component[name].__spied = true;
          }
        }
        return component;
      };
    }).catch(() => {});
  }
};

const readTriggers = async (page) => {
  const found = [];
  for (const frame of page.frames()) {
    found.push(...(await frame.evaluate(() => window.__excelTriggers ?? []).catch(() => [])));
  }
  return found;
};

const visibleLayerTitles = (page) => page.evaluate((source) => {
  const re = new RegExp(source, 'i');
  const found = {};
  for (const el of document.querySelectorAll('[id]')) {
    if (re.test(el.id) && el.getClientRects().length > 0) {
      found[el.id] = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    }
  }
  return found;
}, LAYER_ID.source);

// 엑셀을 누르는 동작(press) 전에 걸어 두고, press의 결과와 15초간 모은 관측을 돌려준다.
export async function observeExcelPress(s, press) {
  const { page } = s;
  const seen = { dialogs: [], popups: [], files: [], downloads: 0, downloadAt: null, excelRequests: [] };
  let pressedAt = null;
  const onDialog = (d) => {
    seen.dialogs.push({ 종류: d.type(), 문구: d.message().replace(/\s+/g, ' ').slice(0, 80) });
    d.accept().catch(() => {});
  };
  const onPopup = (p) => seen.popups.push(pathOf(p.url()));
  // 엑셀 버튼의 실제 효과는 /...Excel.do 요청이다. 파일 응답은 서버 사정으로 15초를 넘길 수 있다.
  const onRequest = (r) => {
    if (pressedAt !== null && /excel/i.test(pathOf(r.url()))) seen.excelRequests.push(pathOf(r.url()));
  };
  const onResponse = (r) => {
    if (pressedAt === null) return;
    const h = r.headers();
    if (FILE_TYPE.test(h['content-type'] ?? '') || h['content-disposition']) {
      seen.files.push({ 초: Number(((Date.now() - pressedAt) / 1000).toFixed(1)), 경로: pathOf(r.url()), 형식: (h['content-type'] ?? '').split(';')[0] });
    }
  };
  const onDownload = (file) => {
    seen.downloads += 1;
    seen.downloadAt ??= Date.now() - pressedAt; // 밀리초
    file.cancel().catch(() => {});
  };
  page.on('dialog', onDialog);
  page.context().on('page', onPopup);
  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('download', onDownload);
  try {
    await installClickRecorder(page);
    await installTriggerSpy(page);
    const layersBefore = await visibleLayerTitles(page);
    pressedAt = Date.now();
    const pressResult = await press();
    await page.waitForTimeout(WATCH_MS);
    const layersAfter = await visibleLayerTitles(page);
    const newLayers = Object.entries(layersAfter).filter(([id]) => !(id in layersBefore)).map(([, t]) => t);
    const clicks = await page.evaluate(() => window.__excelClicks ?? []);
    const triggers = await readTriggers(page);
    return { pressResult, observed: { ...seen, clicks, triggers, newLayers } };
  } finally {
    page.off('dialog', onDialog);
    page.context().off('page', onPopup);
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('download', onDownload);
  }
}
