(async function() {
  "use strict";
  var ROOT = (function() {
    try {
      return window.top.document ? window.top : window;
    } catch (e) {
      return window;
    }
  })();
  if (ROOT.__G2B_TOOLBOX_V4__ && ROOT.__G2B_TOOLBOX_V4__.alive || ROOT.__G2B_ANALYZER_V5__) {
    ROOT.alert("V4.1 또는 V5가 실행 중입니다. 기존 도구를 종료하거나 별도 화면에서 V4.2를 실행해 주세요.");
    return;
  }
  var DOC = ROOT.document;
  var NS = "__G2B_TOOLBOX_V42__";
  var PANEL_ID = "__g2b_tb_v42_panel";
  var BUBBLE_ID = "__g2b_tb_v42_bubble";
  var MODAL_ID = "__g2b_tb_v42_modal";
  var DB_NAME = "G2BToolboxDB_v42";
  var DB_VER = 8;
  var BUILD = "4.2";
  var DOUBLE_MS = 1600;
  var UI_POS_KEY = "g2b_tb_v42_position";
  var UI_INVOKE_KEY = "g2b_tb_v42_last_invoke";
  var UI_TAB_KEY = "g2b_tb_v42_tab";
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function stamp() {
    var d = /* @__PURE__ */ new Date();
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "_" + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
  }
  function uid(p) {
    try {
      return (p || "id") + "_" + crypto.randomUUID();
    } catch (e) {
      return (p || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
    }
  }
  function s(v) {
    return v == null ? "" : String(v);
  }
  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function esc(v) {
    return s(v).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lsGet(k, d) {
    try {
      var v = ROOT.localStorage.getItem(k);
      return v === null ? d : v;
    } catch (e) {
      return d;
    }
  }
  function lsSet(k, v) {
    try {
      ROOT.localStorage.setItem(k, v);
    } catch (e) {
    }
  }
  function download(obj, name) {
    var b = new Blob([typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)], { type: "application/json" });
    var u = URL.createObjectURL(b), a = DOC.createElement("a");
    a.href = u;
    a.download = name;
    a.style.display = "none";
    DOC.body.appendChild(a);
    a.click();
    setTimeout(function() {
      try {
        a.remove();
        URL.revokeObjectURL(u);
      } catch (e) {
      }
    }, 1e3);
  }
  function isEmptyValue(v) {
    return v === void 0 || v === null || v === "" || Array.isArray(v) && v.length === 0;
  }
  function additiveMerge(oldData, newData) {
    var out = Object.assign({}, oldData || {});
    Object.keys(newData || {}).forEach(function(k) {
      var v = newData[k];
      if (!isEmptyValue(v)) out[k] = v;
      else if (!(k in out)) out[k] = v;
    });
    return out;
  }
  function isVisible(el) {
    try {
      if (!el) return false;
      var r = el.getBoundingClientRect(), st = el.ownerDocument.defaultView.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden";
    } catch (e) {
      return false;
    }
  }
  var FIXED_TABLES = [{ id: "procurement.receipt", name: "접수", physical: "procurement_receipt", pk: ["ctrtDmndRcptNo", "ctrtDmndRcptOrd"] }, { id: "procurement.receipt_item", name: "접수 물품", physical: "procurement_receipt_item", pk: ["ctrtDmndRcptNo", "ctrtDmndRcptOrd", "ctrtDmndRcptItemSqno"] }, { id: "procurement.bid", name: "입찰공고", physical: "procurement_bid", pk: ["bidPbancNo", "bidPbancOrd"] }, { id: "procurement.bid_item", name: "입찰 물품", physical: "procurement_bid_item", pk: ["bidPbancNo", "bidPbancOrd", "itemClsfNo", "bidPbancItemSqno"] }, { id: "procurement.contract", name: "계약", physical: "procurement_contract", pk: ["ctrtNo", "ctrtChgOrd"] }, { id: "procurement.contract_item", name: "계약 물품", physical: "procurement_contract_item", pk: ["ctrtNo", "ctrtChgOrd", "ctrtItemSqno"] }, { id: "contacts", name: "연락처", physical: "contacts", pk: ["internalContactId"] }, { id: "classification", name: "분류번호", physical: "classification", pk: ["classificationNumber"] }, { id: "memos", name: "업무 메모", physical: "memos", pk: ["stage", "businessNumber"] }];
  var FIXED_MAP = {};
  FIXED_TABLES.forEach(function(t) {
    FIXED_MAP[t.id] = t;
  });
  var KEY_LABELS = { areaCd: "영역코드", depth1: "1차 메뉴분류코드", depth2: "2차 메뉴분류코드", depth3: "3차 메뉴분류코드", __rowId: "내부 행 고유식별자", __storeVersion: "저장 버전", rawPayload: "원본 JSON", ctrtDmndRcptNo: "접수번호", ctrtDmndRcptOrd: "접수차수", ctrtDmndBizNm: "조달요청사업명", dmstUntyGrpNo: "수요기관통합그룹번호", dmstNm: "수요기관명", engDmstNm: "영문수요기관명", dmndInstUntyGrpNo: "요청기관통합그룹번호", dmndInstNm: "요청기관명", dmndInstBizPicNm: "요청기관담당자명", dmndInstBizPicTlphNo: "요청기관담당자전화번호", dmndInstPicFaxNo: "요청기관담당자팩스번호", rcptBrcoOrgnNm: "접수지청명", rcptInstPicNm: "접수담당자명", rcptInstPicTlphNo: "접수담당자전화", wrtYmd: "작성접수일자", dmndTxCmptnDt: "요청전송완료일자", atrzSttsNm: "결재상태명", aprvrNm: "결재승인자명", atrzDt: "결재일시", prspPrce: "추정가격", totlPymtAmt: "총지급액", bgtAmt: "예산금액", antcPrcmFee: "예상조달수수료", stdCtrtMthdCd: "표준계약방법코드", scsbdMthdCd: "낙찰방법코드", lcrtTyCd: "공고유형코드", ctrtTyCd: "계약유형코드", prcmMthoSeNm: "조달방법구분명", newLotmSeNm: "신규장기구분명", drpmSbpySeCd: "대금지급구분코드", flawGrntePrdMhctYy: "하자보증년수", flawGtnrt: "하자보증율", rqdcOdn1BdcnCn: "조달요청서본문", ctrtDmndRcptItemSqno: "접수물품순번", dtlsPrnmNo: "세부품명번호", dtlsPrnm: "세부품명", itemClsfNo: "물품분류번호", itemCfnm: "품명", itemIdnfNo: "물품식별번호", itemIdnfNm: "규격식별명칭", ctrtDmndQty: "요청수량", qtyUntNm: "수량단위", ctrtDmndUprc: "단가", ctrtDmndAmt: "금액", dlvgdsTermNody: "납품기한일수", dlvgdsPlacNm: "납품장소", devyCndtCd: "인도조건코드", devyCndtNm: "인도조건명", ndfsPrcmDmndNo: "국방조달요구번호", ndfsIvtrNo: "국방재물조사번호", bidPbancNo: "입찰공고번호", bidPbancOrd: "공고차수", bidPbancNm: "입찰공고명", pbancInstUntyGrpNm: "공고기관명", pbancPicNm: "공고담당자명", presTlphNo: "담당자전화번호", bidBlffNm: "입찰집행관명", bfssPicNm: "사업담당자명", bizAmt: "사업금액", vatAmt: "부가세금액", alotBgtAmt: "배정예산금액", bizAmtFeeSumAmt: "사업금액수수료총액", scsbdLwlmRat: "낙찰하한율", dlvgdsTermCn: "납품기한설명", fctrRspbPrdAplcnYn: "하자책임적용여부", fctrRspbNbyr: "하자담보년수", pbancSttsCd: "공고상태코드", pbancSttsNm: "공고상태명", bidMthdCd: "입찰방식코드", slprRcptBgngDay: "제안서접수시작일", slprRcptDdlnDay: "제안서접수마감일", onbsPrnmntDay: "개찰일", onbsPrnmntTime: "개찰시간", bfSpecRegNo: "사전규격등록번호", oderPlanUntyNo: "발주계획통합번호", bidPbancItemSqno: "입찰공고물품순번", bidClsfNo: "입찰분류번호", itemClsfNm: "품명", dtlsPrnmNm: "세부품명", itemDtlSpecCn: "규격서참고내용", prchsDtlItemQty: "구매수량", prchsDtlItemUntVal: "단위", prchsDtlItemUprc: "단가", rowAmtSum: "금액합계", dmstUntyGrpNm: "수요기관명", ctrtNo: "계약번호", ctrtChgOrd: "계약차수", ctrtNm: "계약건명", ctrtDt: "계약일자", frstCtrtDt: "최초계약일자", ctrtAmt: "계약금액", ctrtFee: "조달수수료", ctrtGtnrt: "계약보증율", ctrtGrnteAmt: "계약보증금", dmstPicNm: "수요기관담당자명", dmstTlphNo: "수요기관전화번호", rprsCtentUntyGrpNm: "대표계약상대자명", bzmnRegNo: "사업자등록번호", ctentPicNm: "업체담당자명", ctentTlphNo: "업체전화번호", ctrtBrcoOrgnCd: "계약지청코드", ctrtPicNm: "계약담당자명", ctrtMthdCd: "계약방법코드", dlvgdsTermYmd: "납품기한일자", ctrtItemSqno: "계약물품순번", itemDtlClsfNo: "세부물품분류번호", ctrtItemNm: "계약물품명", itemSpecVal: "물품규격설명", ctrtQty: "계약수량", ctrtUntVal: "단위", ctrtUprc: "계약단가", internalContactId: "고유식별자", category: "범주", organization: "기관/업체명", personName: "담당자명", phone: "일반전화", mobile: "휴대전화", fax: "팩스", email: "이메일", businessRegistrationNumber: "사업자등록번호", remarks: "비고", memo: "메모", classificationNumber: "물품분류번호", detailProductNumber: "세부품명번호", productName: "품명", detailProductName: "세부품명", explanation: "해설 및 규격요약", stage: "조달단계", businessNumber: "업무번호", businessOrder: "업무차수", content: "메모내용", createdAt: "생성일시", updatedAt: "수정일시", ctrtDmndNo: "조달요청번호" };
  var KEY_TYPES = { prspPrce: "numeric", totlPymtAmt: "numeric", bgtAmt: "numeric", antcPrcmFee: "numeric", flawGrntePrdMhctYy: "integer", flawGtnrt: "numeric", ctrtDmndRcptItemSqno: "integer", ctrtDmndQty: "numeric", ctrtDmndUprc: "numeric", ctrtDmndAmt: "numeric", dlvgdsTermNody: "integer", bizAmt: "numeric", vatAmt: "numeric", alotBgtAmt: "numeric", bizAmtFeeSumAmt: "numeric", scsbdLwlmRat: "numeric", fctrRspbNbyr: "integer", bidPbancItemSqno: "integer", prchsDtlItemQty: "numeric", prchsDtlItemUprc: "numeric", rowAmtSum: "numeric", ctrtAmt: "numeric", ctrtFee: "numeric", ctrtGtnrt: "numeric", ctrtGrnteAmt: "numeric", ctrtItemSqno: "integer", ctrtQty: "numeric", ctrtUprc: "numeric", __storeVersion: "integer" };
  var CODE_SEED = { prcmBsneSeCd: { "조070001": "물품", "조070002": "공사", "조070003": "용역", "조070004": "외자" }, slCprcmBsneSeCd: { "조070001": "물품", "조070002": "공사", "조070003": "용역", "조070004": "외자" }, stdCtrtMthdCd: { "계030001": "일반경쟁", "계030003": "제한경쟁", "계030004": "수의계약" }, ctrtMthdCd: { "계030001": "일반경쟁", "계030003": "제한경쟁", "계030004": "수의계약" }, ctrtTyCd: { "계120001": "총액계약", "계120002": "단가계약" }, scsbdMthdCd: { "낙030001": "적격심사", "낙030002": "규격가격동시입찰", "낙030003": "협상에의한계약", "낙030009": "수의(총액)" }, pbancKndCd: { "공440002": "실공고" }, pbancSttsCd: { "공400001": "등록공고", "공400002": "변경공고", "공400003": "취소공고" }, atrzSttsCd: { "결020003": "결재완료" }, devyCndtCd: { "인010001": "공장인도", "인010003": "납품장소하차도", "인010004": "납품장소차상도", "인010005": "현장설치도" }, jintSyddCmnMthoCd: { "공500004": "단독계약" }, drpmSbpySeCd: { "직130001": "직접지급", "직130002": "대지급" }, newLotmSeCd: { "신120001": "신규(단기)" }, bgtImplSeCd: { "예060001": "자체예산" }, bidMthdCd: { "입180002": "전자입찰" }, lcrtTyCd: { "계040001": "일반공고" }, ctrtPgstCd: { "계020011": "송신완료", "계020013": "응답작성중", "계020014": "응답완료", "계020018": "체결통보서접수", "계020021": "미작성" } };
  var EXCLUDED_SEED = ["", "CHK", "chk", "no", "rowNum", "outNum", "totCnt", "mUnikey", "cancel", "rowStatus", "befRowStatus", "atmtCntt01", "untyAtchFileNo", "bsneClsfCd", "atchFileSqno", "atchFileDscr", "atchFileKndCd", "orgnlAtchFileNm", "fileExtnNm", "fileSz", "atchFileNm", "kbrdrNm", "inptDt", "scrnIndtOdr", "delYn", "sessUserNo", "nIndex", "dwnldPrmsYn"];
  var STORES = { rawCaptures: "rawCaptures", rawSessions: "rawSessions", toolMemos: "toolMemos", notes: "notes", launcherScripts: "launcherScripts", tableRegistry: "tableRegistry", tableRows: "tableRows", collectionSources: "collectionSources", staging: "staging", dictKeys: "dictKeys", dictCodes: "dictCodes", dictExcluded: "dictExcluded", dictHeaders: "dictHeaders", tableColumns: "tableColumns", screenRegistry: "screenRegistry", relationships: "relationships", collectorEvents: "collectorEvents", settings: "settings" };
  var dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function() {
        var db = req.result, tx = req.transaction;
        function ensure(name, opt, indexes) {
          var st;
          if (!db.objectStoreNames.contains(name)) st = db.createObjectStore(name, opt || { keyPath: "id" });
          else st = tx.objectStore(name);
          (indexes || []).forEach(function(x) {
            try {
              if (!st.indexNames.contains(x[0])) st.createIndex(x[0], x[1], x[2] || { unique: false });
            } catch (e) {
            }
          });
        }
        ensure(STORES.rawCaptures, { keyPath: "id", autoIncrement: true }, [["sessionId", "sessionId"], ["capturedAt", "capturedAt"], ["screenKey", "screenKey"], ["screenHash", "screenHash"]]);
        ensure(STORES.rawSessions, { keyPath: "sessionId" });
        ensure(STORES.toolMemos, { keyPath: "id" }, [["scope", "scope"], ["screenKey", "screenKey"]]);
        ensure(STORES.notes, { keyPath: "id" }, [["kind", "kind"], ["createdAt", "createdAt"], ["dueAt", "dueAt"], ["deletedAt", "deletedAt"]]);
        ensure(STORES.launcherScripts, { keyPath: "id" }, [["sortOrder", "sortOrder"]]);
        ensure(STORES.tableRegistry, { keyPath: "id" }, [["kind", "kind"]]);
        ensure(STORES.tableRows, { keyPath: "id" }, [["tableId", "tableId"], ["updatedAt", "updatedAt"]]);
        ensure(STORES.collectionSources, { keyPath: "id" }, [["targetTable", "targetTable"], ["screenKey", "screenKey"]]);
        ensure(STORES.staging, { keyPath: "id" }, [["targetTable", "targetTable"], ["createdAt", "createdAt"]]);
        ensure(STORES.dictKeys, { keyPath: "id" });
        ensure(STORES.dictCodes, { keyPath: "id" }, [["key", "key"]]);
        ensure(STORES.dictExcluded, { keyPath: "id" });
        ensure(STORES.dictHeaders, { keyPath: "id" }, [["tableId", "tableId"]]);
        ensure(STORES.tableColumns, { keyPath: "id" }, [["tableId", "tableId"]]);
        ensure(STORES.screenRegistry, { keyPath: "key" }, [["depth2", "depth2"], ["url", "url"]]);
        ensure(STORES.relationships, { keyPath: "id" }, [["fromTable", "fromTable"], ["toTable", "toTable"]]);
        ensure(STORES.collectorEvents, { keyPath: "id" }, [["kind", "kind"], ["capturedAt", "capturedAt"], ["screenKey", "screenKey"]]);
        ensure(STORES.settings, { keyPath: "id" });
      };
      req.onsuccess = function() {
        resolve(req.result);
      };
      req.onerror = function() {
        reject(req.error);
      };
    });
    return dbPromise;
  }
  function dbReq(store, mode, fn) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(store, mode || "readonly"), st = tx.objectStore(store), r, result, error;
        tx.oncomplete = function() {
          resolve(r && "onsuccess" in r ? result : r);
        };
        tx.onabort = tx.onerror = function() {
          reject(error || tx.error || new Error("DB 트랜잭션이 중단되었습니다."));
        };
        try {
          r = fn(st);
        } catch (e) {
          error = e;
          try { tx.abort(); } catch (abortError) {}
          reject(e);
          return;
        }
        if (r && "onsuccess" in r) {
          r.onsuccess = function() {
            result = r.result;
          };
          r.onerror = function() {
            error = r.error;
            reject(error);
          };
        }
      });
    });
  }
  function dbPut(store, v) {
    return dbReq(store, "readwrite", function(st) {
      return st.put(v);
    });
  }
  function dbAdd(store, v) {
    return dbReq(store, "readwrite", function(st) {
      return st.add(v);
    });
  }
  function dbGet(store, id) {
    return dbReq(store, "readonly", function(st) {
      return st.get(id);
    });
  }
  function dbDel(store, id) {
    return dbReq(store, "readwrite", function(st) {
      return st.delete(id);
    });
  }
  function dbAll(store) {
    return dbReq(store, "readonly", function(st) {
      return st.getAll();
    }).then(function(x) {
      return x || [];
    });
  }
  function dbIndexAll(store, index, key) {
    return dbReq(store, "readonly", function(st) {
      return st.index(index).getAll(key);
    }).then(function(rows) {
      return rows || [];
    });
  }
  function dbClear(store) {
    return dbReq(store, "readwrite", function(st) {
      return st.clear();
    });
  }
  async function seedDB() {
    for (var i = 0; i < FIXED_TABLES.length; i++) {
      var t = FIXED_TABLES[i];
      if (!await dbGet(STORES.tableRegistry, t.id)) await dbPut(STORES.tableRegistry, Object.assign({ kind: "fixed", createdAt: nowIso() }, t));
    }
    var keys = Object.keys(KEY_LABELS);
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!await dbGet(STORES.dictKeys, key)) await dbPut(STORES.dictKeys, { id: key, key, label: KEY_LABELS[key], type: KEY_TYPES[key] || "string", updatedAt: nowIso() });
    }
    var ckeys = Object.keys(CODE_SEED);
    for (var ci = 0; ci < ckeys.length; ci++) {
      var ck = ckeys[ci], vals = CODE_SEED[ck], vks = Object.keys(vals);
      for (var vi = 0; vi < vks.length; vi++) {
        var vv = vks[vi], id = ck + "::" + vv;
        if (!await dbGet(STORES.dictCodes, id)) await dbPut(STORES.dictCodes, { id, key: ck, value: vv, label: vals[vv], updatedAt: nowIso() });
      }
    }
    for (var e = 0; e < EXCLUDED_SEED.length; e++) {
      var ex = EXCLUDED_SEED[e];
      if (!await dbGet(STORES.dictExcluded, ex)) await dbPut(STORES.dictExcluded, { id: ex, key: ex, excluded: true, updatedAt: nowIso() });
    }
    var relSeed = [{ id: "rel_bid_receipt", name: "입찰→접수", fromTable: "procurement.bid", fromKey: "ctrtDmndRcptNo", toTable: "procurement.receipt", toKey: "ctrtDmndRcptNo", enabled: true }, { id: "rel_contract_bid", name: "계약→입찰", fromTable: "procurement.contract", fromKey: "bidPbancNo", toTable: "procurement.bid", toKey: "bidPbancNo", enabled: true }];
    for (var ri = 0; ri < relSeed.length; ri++) if (!await dbGet(STORES.relationships, relSeed[ri].id)) await dbPut(STORES.relationships, Object.assign({ createdAt: nowIso(), updatedAt: nowIso() }, relSeed[ri]));
    if (navigator.storage && navigator.storage.persist) {
      try {
        navigator.storage.persist();
      } catch (e2) {
      }
    }
  }
  function getWindows() {
    var out = [];
    function walk(w, path, depth) {
      try {
        var d = w.document;
        if (!d || !d.documentElement) return;
        out.push({ w, d, path, depth });
        for (var i = 0; i < w.frames.length; i++) {
          var fw = w.frames[i], nm = "frame" + i;
          try {
            nm = fw.name || nm;
          } catch (e) {
          }
          walk(fw, path + ">" + nm, depth + 1);
        }
      } catch (e) {
      }
    }
    walk(ROOT, "top", 0);
    return out;
  }
  function wsComp(w, id) {
    try {
      return w.WebSquare && w.WebSquare.util ? w.WebSquare.util.getComponentById(id) : null;
    } catch (e) {
      return null;
    }
  }
  function wsClick(w, el) {
    if (!el) return false;
    try {
      var c = el.id ? wsComp(w, el.id) : null;
      if (c) {
        if (typeof c.trigger === "function") {
          c.trigger("onclick");
          return true;
        }
        if (typeof c.fireEvent === "function") {
          c.fireEvent("onclick");
          return true;
        }
      }
    } catch (e) {
    }
    try {
      el.click();
      return true;
    } catch (e) {
      return false;
    }
  }
  function wsSet(w, el, val) {
    if (!el) return;
    try {
      el.value = val;
    } catch (e) {
    }
    try {
      ["input", "change", "blur"].forEach(function(ev) {
        el.dispatchEvent(new Event(ev, { bubbles: true }));
      });
    } catch (e) {
    }
    try {
      var c = el.id ? wsComp(w, el.id) : null;
      if (c && c.setValue) c.setValue(val);
    } catch (e) {
    }
  }
  function getOriginalId(c, fallback) {
    try {
      return c && c.getOriginalID ? s(c.getOriginalID()) || fallback : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function collectRaw(includeTables) {
    var raw = { pointInfo: {}, tables: {}, frames: {} };
    getWindows().forEach(function(x) {
      var f = { pointInfo: {}, tables: {} };
      try {
        var WS = x.w.WebSquare;
        if (!WS || !WS.util) return;
        var els = x.d.querySelectorAll("[id]"), seen = {};
        for (var i = 0; i < els.length; i++) {
          var id = els[i].id;
          if (!id || seen[id]) continue;
          seen[id] = 1;
          var c = wsComp(x.w, id);
          if (!c) continue;
          try {
            if (c.getPluginName && c.getPluginName() === "gridView") {
              if (includeTables === false) continue;
              var dl = WS.util.getComponentById(c.getDataList());
              if (dl && dl.getAllJSON) {
                var rows = dl.getAllJSON();
                var oid = getOriginalId(c, id);
                f.tables[oid] = rows;
                raw.tables[x.path + "::" + oid] = rows;
              }
            } else if (c.getValue) {
              var ref = id;
              try {
                ref = c.getRef ? s(c.getRef()).split(".").pop() : getOriginalId(c, id);
              } catch (e) {
                ref = getOriginalId(c, id);
              }
              var v;
              try {
                v = c.getValue();
              } catch (e) {
                v = "";
              }
              if (!ref) ref = getOriginalId(c, id);
              f.pointInfo[ref] = v;
              raw.pointInfo[x.path + "::" + ref] = v;
            }
          } catch (e) {
          }
        }
      } catch (e) {
      }
      if (Object.keys(f.pointInfo).length || Object.keys(f.tables).length) raw.frames[x.path] = f;
    });
    return raw;
  }
  function depthHints(raw) {
    var o = { areaCd: "", depth1: "", depth2: "", depth3: "" };
    Object.keys(raw.frames || {}).some(function(p) {
      var pi = raw.frames[p].pointInfo || {};
      ["areaCd", "depth1", "depth2", "depth3"].forEach(function(k) {
        if (!o[k] && pi[k] != null) o[k] = s(pi[k]);
      });
      return false;
    });
    return o;
  }
  function normalizedUrl() {
    try {
      var u = new URL(ROOT.location.href);
      return u.origin + u.pathname;
    } catch (e) {
      return s(ROOT.location.href).split("#")[0].split("?")[0];
    }
  }
  function screenInfo(rawOpt) {
    var raw = rawOpt || collectRaw(), wins = getWindows(), sig = [], maxDepth = 0, hints = [];
    wins.forEach(function(x) {
      maxDepth = Math.max(maxDepth, x.depth);
      try {
        sig.push("F|" + x.path + "|" + s(x.w.name));
        var WS = x.w.WebSquare;
        if (WS && WS.util) {
          var els = x.d.querySelectorAll("[id]"), seen = {};
          for (var i = 0; i < els.length; i++) {
            var id = els[i].id;
            if (!id || seen[id]) continue;
            seen[id] = 1;
            var c = wsComp(x.w, id);
            if (!c) continue;
            var pl = "", oid = id, src = "";
            try {
              pl = c.getPluginName ? s(c.getPluginName()) : "";
            } catch (e) {
            }
            oid = getOriginalId(c, id);
            try {
              if (pl === "wframe" && c.getSrc) src = s(c.getSrc());
            } catch (e) {
            }
            sig.push("C|" + x.path + "|" + pl + "|" + oid + (src ? "|" + src : ""));
          }
        }
        var h = x.d.querySelector("h1,h2,h3,.page_title,.pageTitle,.tit_page,.sub_title,.title");
        if (h && isVisible(h)) {
          var t = s(h.innerText || h.textContent).trim().replace(/\s+/g, " ");
          if (t && t.length < 100) hints.push(t);
        }
      } catch (e) {
      }
    });
    sig.sort();
    var dh = depthHints(raw), url = normalizedUrl(), host = "";
    try {
      host = ROOT.location.hostname || "";
    } catch (e) {
    }
    var isG2B = /g2b\.go\.kr$/i.test(host) || /\.g2b\.go\.kr$/i.test(host);
    var legacy = "WS-" + hashString(sig.join("\n"));
    var stableBase = url;
    if (isG2B) stableBase += "|" + dh.areaCd + "|" + dh.depth1 + "|" + dh.depth2;
    var key = (isG2B ? "G2B-" : "URL-") + hashString(stableBase);
    var label = (hints[0] || DOC.title || "현재 화면").trim();
    return { key, legacyKey: legacy, url, isG2B, label, depth: maxDepth, areaCd: dh.areaCd, depth1: dh.depth1, depth2: dh.depth2, depth3: dh.depth3, signatureCount: sig.length, lastSeenAt: nowIso() };
  }
  function listCurrentSources(raw) {
    var arr = [];
    Object.keys(raw.frames || {}).forEach(function(path) {
      var f = raw.frames[path];
      if (Object.keys(f.pointInfo || {}).length) arr.push({ key: path + "::pointInfo", framePath: path, type: "pointInfo", sourceId: "pointInfo", count: 1, label: path + " · 기본정보 (" + Object.keys(f.pointInfo).length + "필드)" });
      Object.keys(f.tables || {}).forEach(function(g) {
        arr.push({ key: path + "::grid::" + g, framePath: path, type: "grid", sourceId: g, count: Array.isArray(f.tables[g]) ? f.tables[g].length : 0, label: path + " · " + g + " (" + (Array.isArray(f.tables[g]) ? f.tables[g].length : 0) + "행)" });
      });
    });
    return arr;
  }
  function rowsFromSource(raw, src) {
    var f = (raw.frames || {})[src.framePath];
    if (!f) return [];
    if (src.type === "pointInfo") return [Object.assign({}, f.pointInfo || {})];
    return Array.isArray((f.tables || {})[src.sourceId]) ? (f.tables[src.sourceId] || []).map(function(r) {
      return Object.assign({}, r);
    }) : [];
  }
  function findAcross(selector) {
    var wins = getWindows();
    for (var i = 0; i < wins.length; i++) {
      try {
        var el = wins[i].d.querySelector(selector);
        if (el && isVisible(el)) return { el, w: wins[i].w, d: wins[i].d };
      } catch (e) {
      }
    }
    return null;
  }
  function findByText(texts) {
    var wins = getWindows();
    for (var wi = 0; wi < wins.length; wi++) {
      var arr = [];
      try {
        arr = Array.from(wins[wi].d.querySelectorAll('button,input[type="button"],a,span,div'));
      } catch (e) {
      }
      for (var i = 0; i < arr.length; i++) {
        var el = arr[i];
        if (!isVisible(el)) continue;
        var t = s(el.value || el.innerText || el.textContent).trim().replace(/\s+/g, " ");
        for (var j = 0; j < texts.length; j++) if (t === texts[j] || t.indexOf(texts[j]) >= 0) {
          if ((el.tagName === "SPAN" || el.tagName === "DIV") && el.closest) el = el.closest("a,button") || el;
          return { el, w: wins[wi].w, d: wins[wi].d };
        }
      }
    }
    return null;
  }
  function hideCalendars() {
    getWindows().forEach(function(x) {
      try {
        x.d.querySelectorAll("[id*='_calendar'],[class*='w2input_cal'],.w2datepicker").forEach(function(c) {
          c.style.display = "none";
          c.style.visibility = "hidden";
        });
      } catch (e) {
      }
    });
  }
  function yearChange(offset) {
    var starts = [], ends = [];
    getWindows().forEach(function(x) {
      try {
        x.d.querySelectorAll("input[id$='_ibxStrDay']").forEach(function(e) {
          if (isVisible(e)) starts.push({ el: e, w: x.w });
        });
        x.d.querySelectorAll("input[id$='_ibxEndDay']").forEach(function(e) {
          if (isVisible(e)) ends.push({ el: e, w: x.w });
        });
      } catch (e) {
      }
    });
    if (!starts.length || !ends.length) {
      alert("활성 날짜 필드를 찾지 못했습니다.");
      return;
    }
    var a = starts[0], b = ends[0], sv = s(a.el.value).replace(/[^0-9]/g, ""), ev = s(b.el.value).replace(/[^0-9]/g, "");
    try {
      var ac = wsComp(a.w, a.el.id), bc = wsComp(b.w, b.el.id);
      if (ac && ac.getValue) sv = s(ac.getValue()).replace(/[^0-9]/g, "");
      if (bc && bc.getValue) ev = s(bc.getValue()).replace(/[^0-9]/g, "");
    } catch (e) {
    }
    if (sv.length !== 8 || ev.length !== 8) {
      alert("날짜 형식 오류: " + sv + " / " + ev);
      return;
    }
    var sy = parseInt(sv.slice(0, 4), 10), ey = parseInt(ev.slice(0, 4), 10);
    if (sv.slice(4) !== "0101" || ev.slice(4) !== "1231") {
      wsSet(a.w, a.el, sy + "0101");
      wsSet(b.w, b.el, sy + "1231");
    } else {
      wsSet(a.w, a.el, sy + offset + "0101");
      wsSet(b.w, b.el, ey + offset + "1231");
    }
    setTimeout(hideCalendars, 60);
  }
  function doSearch() {
    var wins = getWindows(), ordered = [];
    try {
      if (ROOT.frames && ROOT.frames["sub_main"] && ROOT.frames["sub_main"].document) ordered.push({ w: ROOT.frames["sub_main"], d: ROOT.frames["sub_main"].document, path: "top>sub_main" });
    } catch (e) {
    }
    wins.forEach(function(x) {
      if (!ordered.some(function(y) {
        return y.w === x.w;
      })) ordered.push(x);
    });
    function fire(w, d) {
      var el = null;
      try {
        el = d.querySelector("#mf_wfm_container_btnS0001") || d.querySelector('input.w2trigger.btn_cm.srch[value="검색"]') || d.querySelector('input[value="조회"],input[value="검색"]');
      } catch (e) {
      }
      if (!el) {
        try {
          var els = Array.from(d.querySelectorAll('a,button,input[type="button"],span,div'));
          el = els.find(function(z) {
            var t = s(z.innerText || z.value).trim();
            return (t === "조회" || t === "검색") && isVisible(z);
          });
          if (el && (el.tagName === "SPAN" || el.tagName === "DIV")) el = el.closest("a") || el.closest("button") || el;
        } catch (e) {
        }
      }
      if (!el) {
        try {
          el = d.querySelector("a.w2pageList_label_selected") || d.querySelector('a.w2pageList_control_label[index="1"]');
        } catch (e) {
        }
      }
      return !!(el && wsClick(w, el));
    }
    for (var i = 0; i < ordered.length; i++) if (fire(ordered[i].w, ordered[i].d)) return;
    for (var j = 0; j < ordered.length; j++) {
      try {
        var inp = ordered[j].d.querySelector("input[id$='_ibxStrDay']") || ordered[j].d.querySelector("input");
        if (inp) {
          inp.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", keyCode: 13 }));
          return;
        }
      } catch (e) {
      }
    }
    alert("조회/검색 버튼을 찾지 못했습니다.");
  }
  function doExcel() {
    var r = findAcross('#mf_wfm_container_btnExcelDwnld,.excel_down,input[value="엑셀다운로드"],input[value="엑셀다운"]') || findByText(["엑셀다운로드", "엑셀다운", "엑셀저장", "Excel"]);
    if (r && wsClick(r.w, r.el)) return;
    alert("엑셀 다운로드 버튼을 찾지 못했습니다.");
  }
  function applyRowCount(val) {
    val = s(val).replace(/[^0-9]/g, "");
    if (!val) {
      alert("조회건수를 입력하세요.");
      return;
    }
    var wins = getWindows(), target = null;
    for (var i = 0; i < wins.length && !target; i++) {
      var sels = [];
      try {
        sels = Array.from(wins[i].d.querySelectorAll("select"));
      } catch (e) {
      }
      for (var j = 0; j < sels.length; j++) {
        var id = (sels[j].id || "").toLowerCase();
        if (id.indexOf("recordcountperpage") >= 0 || id.indexOf("recordcount") >= 0 || id.indexOf("pagesize") >= 0 || Array.from(sels[j].options || []).some(function(o) {
          return ["10", "20", "30"].indexOf(s(o.text).trim()) >= 0;
        })) {
          target = { el: sels[j], w: wins[i].w };
          break;
        }
      }
    }
    if (!target) {
      alert("조회건수 필드를 찾지 못했습니다.");
      return;
    }
    var sel = target.el;
    if (!Array.from(sel.options || []).some(function(o) {
      return s(o.value) === val;
    })) {
      try {
        var op = sel.ownerDocument.createElement("option");
        op.value = val;
        op.text = val + "건";
        sel.appendChild(op);
        var c = wsComp(target.w, sel.id);
        if (c && c.addItem) c.addItem(val, val);
      } catch (e) {
      }
    }
    wsSet(target.w, sel, val);
    setTimeout(function() {
      var b = findAcross('[id*="btnAplcn"],[id*="btnApply"],[id*="btnConfirm"]') || findByText(["적용"]);
      if (b) wsClick(b.w, b.el);
      else doSearch();
    }, 120);
  }
  var dictCache = { keys: {}, codes: {}, excluded: {}, headers: {}, columns: {} };
  async function refreshDictCache() {
    var a = await Promise.all([dbAll(STORES.dictKeys), dbAll(STORES.dictCodes), dbAll(STORES.dictExcluded), dbAll(STORES.dictHeaders), dbAll(STORES.tableColumns)]);
    dictCache = { keys: {}, codes: {}, excluded: {}, headers: {}, columns: {} };
    a[0].forEach(function(x) {
      dictCache.keys[x.key] = x;
    });
    a[1].forEach(function(x) {
      if (!dictCache.codes[x.key]) dictCache.codes[x.key] = {};
      dictCache.codes[x.key][s(x.value)] = x;
    });
    a[2].forEach(function(x) {
      if (x.excluded) dictCache.excluded[x.key] = true;
    });
    a[3].forEach(function(x) {
      dictCache.headers[x.tableId + "::" + x.key] = x;
    });
    a[4].forEach(function(x) {
      dictCache.columns[x.tableId + "::" + x.key] = x;
    });
  }
  function toast(msg) {
    var old = DOC.getElementById("__g2b_v42_toast");
    if (old) old.remove();
    var t = DOC.createElement("div");
    t.id = "__g2b_v42_toast";
    t.setAttribute("data-g2bv4-ui", "1");
    t.textContent = msg;
    t.style.cssText = "position:fixed;right:18px;bottom:72px;z-index:2147483647;background:#20242b;color:#f4f6f8;border:1px solid #3b424d;border-radius:10px;padding:8px 11px;font:11px Malgun Gothic,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35)";
    DOC.body.appendChild(t);
    setTimeout(function() {
      try {
        t.remove();
      } catch (e) {
      }
    }, 2200);
  }
  function labelFor(key, tableId) {
    var h = dictCache.headers[(tableId || "*") + "::" + key] || dictCache.headers["*::" + key];
    if (h && h.label) return h.label;
    var base = key.indexOf(".") >= 0 ? key.slice(key.lastIndexOf(".") + 1) : key, k = dictCache.keys[base], lab = k && k.label ? k.label : base;
    if (key.indexOf("receipt.") === 0) return "접수·" + lab;
    if (key.indexOf("bid.") === 0) return "입찰·" + lab;
    if (key.indexOf("contract.") === 0) return "계약·" + lab;
    return lab;
  }
  function valueFor(key, v) {
    if (v == null) return "";
    var base = key.indexOf(".") >= 0 ? key.slice(key.lastIndexOf(".") + 1) : key, c = dictCache.codes[base] && dictCache.codes[base][s(v)];
    return c && c.label ? c.label : v;
  }
  function displayValue(key, v) {
    var x = valueFor(key, v);
    if (x && typeof x === "object") {
      try {
        return JSON.stringify(x);
      } catch (e) {
        return s(x);
      }
    }
    return s(x);
  }
  function visibleFor(key, tableId) {
    var bk = key.indexOf(".") >= 0 ? key.slice(key.lastIndexOf(".") + 1) : key;
    if (dictCache.excluded[bk]) return false;
    var c = dictCache.columns[(tableId || "") + "::" + key];
    return !(c && c.visible === false);
  }
  function colOrder(key, tableId) {
    var c = dictCache.columns[(tableId || "") + "::" + key];
    return c && Number.isFinite(+c.order) ? +c.order : 9999;
  }
  function colWidth(key, tableId) {
    var c = dictCache.columns[(tableId || "") + "::" + key];
    return c && c.width ? +c.width : 130;
  }
  async function discoverRow(row) {
    var ks = Object.keys(row || {});
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (!await dbGet(STORES.dictKeys, k)) await dbPut(STORES.dictKeys, { id: k, key: k, label: k, type: typeof row[k], updatedAt: nowIso() });
      if (/Cd$/.test(k) && !isEmptyValue(row[k])) {
        var id = k + "::" + s(row[k]);
        if (!await dbGet(STORES.dictCodes, id)) await dbPut(STORES.dictCodes, { id, key: k, value: s(row[k]), label: s(row[k]), updatedAt: nowIso(), discovered: true });
      }
    }
  }
  function pkForTable(tableId, row) {
    var t = FIXED_MAP[tableId];
    if (!t) return [];
    if (tableId === "classification" && row.detailProductNumber) return ["classificationNumber", "detailProductNumber"].map(function(k) {
      return row[k];
    });
    return t.pk.map(function(k) {
      return row[k];
    });
  }
  async function rowKeyForAsync(tableId, row) {
    if (tableId.indexOf("dataset.") === 0) {
      var reg = await dbGet(STORES.tableRegistry, tableId), keys = reg && reg.businessKeys || [];
      if (keys.length) {
        var vals = keys.map(function(k) {
          return row[k];
        });
        if (vals.some(isEmptyValue)) throw new Error("업무키가 비어 있습니다: " + keys.join(", "));
        return vals.map(s).join("|");
      }
      if (!row.__rowId) row.__rowId = uid("row");
      return s(row.__rowId);
    }
    var vals = pkForTable(tableId, row);
    if (vals.some(function(v) {
      return isEmptyValue(v);
    })) {
      return null;
    }
    return vals.map(function(v) {
      return s(v);
    }).join("|");
  }
  function sanitizeProjection(tableId, row) {
    var out = Object.assign({}, row || {});
    if (tableId === "procurement.receipt") delete out.ctrtDmndNo;
    return out;
  }
  async function upsertTableRow(tableId, row, meta) {
    row = sanitizeProjection(tableId, row);
    await discoverRow(row);
    var rk = await rowKeyForAsync(tableId, row);
    if (!rk) throw new Error("필수 식별키가 없습니다: " + (FIXED_MAP[tableId] ? FIXED_MAP[tableId].pk.join(", ") : "__rowId"));
    var id = tableId + "::" + rk, old = await dbGet(STORES.tableRows, id), out = Object.assign({}, old && old.data || {}), changed = !old, filled = [], conflicts = [];
    Object.keys(row || {}).forEach(function(k) {
      var nv = row[k], ov = out[k];
      if (isEmptyValue(nv)) {
        if (!(k in out)) out[k] = nv;
        return;
      }
      if (isEmptyValue(ov)) {
        out[k] = nv;
        changed = true;
        filled.push(k);
        return;
      }
      var same;
      try {
        same = JSON.stringify(ov) === JSON.stringify(nv);
      } catch (e) {
        same = s(ov) === s(nv);
      }
      if (!same) conflicts.push({ key: k, oldValue: ov, newValue: nv });
    });
    var useNew = false;
    if (conflicts.length) {
      useNew = confirm("중복 업무키 [" + rk + "]에서 기존값과 다른 값 " + conflicts.length + "건이 발견되었습니다.\n\n확인: 새 값 사용\n취소: 기존 값 유지");
      if (useNew) {
        conflicts.forEach(function(c) {
          out[c.key] = c.newValue;
        });
        changed = true;
      }
      try {
        await addCollectorEvent("conflict", { tableId, rowKey: rk, conflicts: conflicts.map(function(c) {
          return { key: c.key, oldValue: c.oldValue, newValue: c.newValue };
        }), resolution: useNew ? "new" : "old" });
      } catch (e) {
      }
    }
    if (old && !changed) {
      Object.defineProperty(old, "__mergeState", { value: { changed: false, duplicate: true, filled, conflicts, resolution: useNew ? "new" : "old" }, enumerable: false, configurable: true });
      return old;
    }
    var ver = old && old.__storeVersion ? old.__storeVersion + 1 : 1, rec = { id, tableId, rowKey: rk, data: out, __storeVersion: ver, createdAt: old && old.createdAt ? old.createdAt : nowIso(), updatedAt: nowIso(), sourceMeta: meta || old && old.sourceMeta || null };
    await dbPut(STORES.tableRows, rec);
    Object.defineProperty(rec, "__mergeState", { value: { changed: true, duplicate: false, filled, conflicts, resolution: useNew ? "new" : "old" }, enumerable: false, configurable: true });
    return rec;
  }
  async function tableRows(tableId) {
    return dbIndexAll(STORES.tableRows, "tableId", tableId);
  }
  async function tableList() {
    var a = await dbAll(STORES.tableRegistry);
    return a.sort(function(x, y) {
      if (x.kind !== y.kind) return x.kind === "fixed" ? -1 : 1;
      return s(x.name).localeCompare(s(y.name), "ko");
    });
  }
  async function createDataset(name, desc, businessKeys, rule) {
    var id = "dataset." + uid("ds").replace(/^ds_/, "");
    var keys = (businessKeys || []).filter(Boolean);
    var rec = { id, name: name || "사용자 테이블", physical: null, pk: keys.length ? keys : ["__rowId"], businessKeys: keys, kind: "custom", description: desc || "", collectionRule: rule || null, createdAt: nowIso(), updatedAt: nowIso() };
    await dbPut(STORES.tableRegistry, rec);
    return rec;
  }
  async function deleteDataset(tableId) {
    if (tableId.indexOf("dataset.") !== 0) throw new Error("고정 테이블은 삭제할 수 없습니다.");
    var rows = await tableRows(tableId);
    for (var i = 0; i < rows.length; i++) await dbDel(STORES.tableRows, rows[i].id);
    var maps = await dbIndexAll(STORES.collectionSources, "targetTable", tableId);
    for (var j = 0; j < maps.length; j++) await dbDel(STORES.collectionSources, maps[j].id);
    var cols = await dbIndexAll(STORES.tableColumns, "tableId", tableId);
    for (var k = 0; k < cols.length; k++) await dbDel(STORES.tableColumns, cols[k].id);
    await dbDel(STORES.tableRegistry, tableId);
  }
  async function registerScreen(si) {
    var old = await dbGet(STORES.screenRegistry, si.key);
    await dbPut(STORES.screenRegistry, Object.assign({}, old || {}, si, { firstSeenAt: old && old.firstSeenAt ? old.firstSeenAt : nowIso(), lastSeenAt: nowIso() }));
  }
  function defaultScreenRule(si) {
    var g = !!si.isG2B;
    return { url: si.url || normalizedUrl(), urlMode: "path", useAreaCd: g && !!si.areaCd, areaCd: si.areaCd || "", useDepth1: g && !!si.depth1, depth1: si.depth1 || "", useDepth2: g && !!si.depth2, depth2: si.depth2 || "", useDepth3: false, depth3: si.depth3 || "" };
  }
  function screenRuleMatches(rule, si) {
    if (!rule) return false;
    var url = si.url || normalizedUrl();
    if (rule.url) {
      if ((rule.urlMode || "path") === "exact") {
        try {
          if (ROOT.location.href !== rule.url) return false;
        } catch (e) {
        }
      } else if (url !== rule.url) return false;
    }
    if (si.isG2B || rule.useAreaCd || rule.useDepth1 || rule.useDepth2 || rule.useDepth3) {
      if (rule.useAreaCd && s(rule.areaCd) !== s(si.areaCd)) return false;
      if (rule.useDepth1 && s(rule.depth1) !== s(si.depth1)) return false;
      if (rule.useDepth2 && s(rule.depth2) !== s(si.depth2)) return false;
      if (rule.useDepth3 && s(rule.depth3) !== s(si.depth3)) return false;
    }
    return true;
  }
  function mappingMatches(m, si) {
    if (!m.enabled) return false;
    if (m.rule) return screenRuleMatches(m.rule, si);
    if (m.matchMode === "depths") {
      if (m.areaCd && m.areaCd !== si.areaCd) return false;
      if (m.depth1 && m.depth1 !== si.depth1) return false;
      if (m.depth2 && m.depth2 !== si.depth2) return false;
      if (m.depth3 && m.depth3 !== si.depth3) return false;
      return !!(m.areaCd || m.depth1 || m.depth2 || m.depth3);
    }
    return m.screenKey === si.key || m.screenKey === si.legacyKey;
  }
  function mappingSource(m) {
    return { framePath: m.framePath, type: m.sourceType, sourceId: m.sourceId, key: m.framePath + "::" + (m.sourceType === "pointInfo" ? "pointInfo" : "grid::" + m.sourceId) };
  }
  async function saveMapping(targetTable, si, src, opt) {
    opt = opt || {};
    var rec = { id: opt.id || uid("map"), targetTable, screenKey: opt.screenKey || si.key, screenLabel: opt.screenLabel || si.label, matchMode: opt.matchMode || "rule", rule: opt.rule || defaultScreenRule(si), areaCd: opt.areaCd !== void 0 ? opt.areaCd : si.areaCd, depth1: opt.depth1 !== void 0 ? opt.depth1 : si.depth1, depth2: opt.depth2 !== void 0 ? opt.depth2 : si.depth2, depth3: opt.depth3 !== void 0 ? opt.depth3 : si.depth3, framePath: src.framePath, sourceType: src.type, sourceId: src.sourceId, enabled: opt.enabled !== false, createdAt: opt.createdAt || nowIso(), updatedAt: nowIso() };
    await dbPut(STORES.collectionSources, rec);
    return rec;
  }
  async function stageCurrent(targetTable, src, raw, si, rowsOverride) {
    var rows = rowsOverride || rowsFromSource(raw, src);
    for (var i = 0; i < rows.length; i++) await discoverRow(rows[i]);
    await refreshDictCache();
    var rec = { id: uid("stage"), targetTable, screenKey: si.key, screenLabel: si.label, framePath: src.framePath, sourceType: src.type, sourceId: src.sourceId, rows, createdAt: nowIso(), status: "preview" };
    await dbPut(STORES.staging, rec);
    return rec;
  }
  async function commitStage(stage) {
    var ok = 0, dup = 0, fail = [], conflict = 0;
    for (var i = 0; i < stage.rows.length; i++) {
      try {
        var rec = await upsertTableRow(stage.targetTable, stage.rows[i], { screenKey: stage.screenKey, screenLabel: stage.screenLabel, sourceType: stage.sourceType, sourceId: stage.sourceId, capturedAt: stage.createdAt });
        var ms = rec && rec.__mergeState || {};
        if (ms.conflicts && ms.conflicts.length) conflict++;
        if (ms.changed === false) dup++;
        else ok++;
      } catch (e) {
        fail.push({ row: i + 1, error: e.message });
      }
    }
    stage.status = fail.length ? "partial" : "committed";
    stage.committedAt = nowIso();
    stage.result = { saved: ok, duplicates: dup, conflicts: conflict, failed: fail };
    await dbPut(STORES.staging, stage);
    return stage.result;
  }
  async function projectMappedSources(raw, si) {
    var maps = await dbAll(STORES.collectionSources), stats = { saved: 0, duplicates: 0, conflicts: 0, failed: 0 }, regCache = {};
    for (var i = 0; i < maps.length; i++) {
      var m = maps[i];
      if (!mappingMatches(m, si)) continue;
      if (!(m.targetTable in regCache)) regCache[m.targetTable] = await dbGet(STORES.tableRegistry, m.targetTable);
      var reg = regCache[m.targetTable];
      if (reg && reg.collectionRule && !screenRuleMatches(reg.collectionRule, si)) continue;
      var rows = rowsFromSource(raw, mappingSource(m));
      for (var r = 0; r < rows.length; r++) {
        try {
          var rec = await upsertTableRow(m.targetTable, rows[r], { mappingId: m.id, screenKey: si.key, screenLabel: si.label, sourceType: m.sourceType, sourceId: m.sourceId, capturedAt: nowIso() });
          var ms = rec && rec.__mergeState || {};
          if (ms.conflicts && ms.conflicts.length) stats.conflicts++;
          if (ms.changed === false) stats.duplicates++;
          else stats.saved++;
        } catch (e) {
          stats.failed++;
        }
      }
    }
    return stats;
  }
  function mergePrefixed(out, prefix, data) {
    Object.keys(data || {}).forEach(function(k) {
      out[prefix + k] = data[k];
    });
  }
  async function buildMaster() {
    var rr = await tableRows("procurement.receipt"), bb = await tableRows("procurement.bid"), cc = await tableRows("procurement.contract");
    var receipts = rr.map(function(x) {
      return x.data;
    }), bids = bb.map(function(x) {
      return x.data;
    }), contracts = cc.map(function(x) {
      return x.data;
    });
    var bidByRcpt = {}, ctrByBid = {};
    bids.forEach(function(b) {
      var k = s(b.ctrtDmndRcptNo);
      if (!bidByRcpt[k]) bidByRcpt[k] = [];
      bidByRcpt[k].push(b);
    });
    contracts.forEach(function(c) {
      var k = s(c.bidPbancNo);
      if (!ctrByBid[k]) ctrByBid[k] = [];
      ctrByBid[k].push(c);
    });
    var out = [], usedB = /* @__PURE__ */ new Set(), usedC = /* @__PURE__ */ new Set();
    receipts.forEach(function(r) {
      var bs = bidByRcpt[s(r.ctrtDmndRcptNo)] || [];
      if (!bs.length) {
        var row = {};
        mergePrefixed(row, "receipt.", r);
        out.push(row);
        return;
      }
      bs.forEach(function(b) {
        usedB.add(b);
        var cs = ctrByBid[s(b.bidPbancNo)] || [];
        if (!cs.length) {
          var row2 = {};
          mergePrefixed(row2, "receipt.", r);
          mergePrefixed(row2, "bid.", b);
          out.push(row2);
          return;
        }
        cs.forEach(function(c) {
          usedC.add(c);
          var row3 = {};
          mergePrefixed(row3, "receipt.", r);
          mergePrefixed(row3, "bid.", b);
          mergePrefixed(row3, "contract.", c);
          out.push(row3);
        });
      });
    });
    bids.forEach(function(b) {
      if (usedB.has(b)) return;
      var cs = ctrByBid[s(b.bidPbancNo)] || [];
      if (!cs.length) {
        var row = {};
        mergePrefixed(row, "bid.", b);
        out.push(row);
      } else cs.forEach(function(c) {
        usedC.add(c);
        var row2 = {};
        mergePrefixed(row2, "bid.", b);
        mergePrefixed(row2, "contract.", c);
        out.push(row2);
      });
    });
    contracts.forEach(function(c) {
      if (usedC.has(c)) return;
      var row = {};
      mergePrefixed(row, "contract.", c);
      out.push(row);
    });
    return out;
  }
  async function buildRelationshipTree() {
    var rr = await tableRows("procurement.receipt"), bb = await tableRows("procurement.bid"), cc = await tableRows("procurement.contract"), bids = bb.map(function(x) {
      return x.data;
    }), contracts = cc.map(function(x) {
      return x.data;
    });
    return rr.map(function(x) {
      var r = x.data, bs = bids.filter(function(b) {
        return s(b.ctrtDmndRcptNo) === s(r.ctrtDmndRcptNo);
      });
      return { receipt: r, bids: bs.map(function(b) {
        return { bid: b, contracts: contracts.filter(function(c) {
          return s(c.bidPbancNo) === s(b.bidPbancNo);
        }) };
      }) };
    });
  }
  var collector = { active: false, sessionId: null, startedAt: null, lastHash: null, lastScreenHash: null, seq: 0, timer: null, docs: /* @__PURE__ */ new WeakSet(), hookedWindows: /* @__PURE__ */ new WeakSet(), hookedObjects: /* @__PURE__ */ new WeakSet(), observers: [], undo: [], lastActionAt: 0 };
  function collectorId(kind) {
    return kind + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 7);
  }
  async function addCollectorEvent(kind, data) {
    var raw = collectRaw(false), si = screenInfo(raw), rec = Object.assign({ id: collectorId(kind), kind, capturedAt: nowIso(), screenKey: si.key, url: si.url, areaCd: si.areaCd, depth1: si.depth1, depth2: si.depth2, depth3: si.depth3 }, data || {});
    await dbPut(STORES.collectorEvents, rec);
    return rec;
  }
  function normalizeDynamicId(v) {
    return s(v).replace(/wq_uuid_\d+_/g, "wq_uuid_*_").replace(/_[0-9]{6,}(?=_|$)/g, "_*");
  }
  function collectorControlType(e, c) {
    var p = "";
    try {
      p = s(c && c.getPluginName && c.getPluginName()).toLowerCase();
    } catch (q) {
    }
    if (p) return p;
    var t = s(e && e.type).toLowerCase(), r = s(e && e.getAttribute && e.getAttribute("role")).toLowerCase(), cl = s(e && e.className).toLowerCase(), tag = e && e.tagName || "";
    if (t === "radio" || r === "radio" || cl.indexOf("radio") >= 0) return "radio";
    if (t === "checkbox" || r === "checkbox" || cl.indexOf("checkbox") >= 0) return "checkbox";
    if (tag === "SELECT" || cl.indexOf("select") >= 0) return "select";
    if (r === "tab" || cl.indexOf("tabcontrol") >= 0) return "tab";
    if (tag === "TEXTAREA") return "textarea";
    if (tag === "INPUT") return "input";
    if (tag === "BUTTON" || t === "button" || t === "submit" || cl.indexOf("trigger") >= 0) return "trigger";
    if (tag === "A") return "link";
    return "control";
  }
  function collectorLabel(e, c) {
    var a = "";
    try {
      a = e.getAttribute("aria-label") || e.getAttribute("title") || "";
    } catch (q) {
    }
    var ct = "";
    try {
      ct = c && c.getText ? s(c.getText()) : "";
    } catch (q) {
    }
    return s(a || ct || e.value || e.innerText || e.textContent || e.id || "(무명)").trim().replace(/\s+/g, " ").slice(0, 300);
  }
  function collectorAttrs(e) {
    var o = {};
    try {
      Array.from(e.attributes || []).forEach(function(a) {
        o[a.name] = a.value;
      });
    } catch (q) {
    }
    return o;
  }
  function collectorDomPath(e) {
    var a = [];
    try {
      for (var x = e, i = 0; x && x.nodeType === 1 && i < 6; i++, x = x.parentElement) {
        var z = x.tagName.toLowerCase();
        if (x.id) z += "#" + normalizeDynamicId(x.id);
        else if (x.classList && x.classList.length) z += "." + Array.from(x.classList).slice(0, 2).join(".");
        a.unshift(z);
      }
    } catch (q) {
    }
    return a.join(" > ");
  }
  function collectorMethods(c) {
    var out = /* @__PURE__ */ new Set();
    try {
      for (var o = c, d = 0; o && d < 4; d++, o = Object.getPrototypeOf(o)) Object.getOwnPropertyNames(o).forEach(function(k) {
        try {
          if (typeof c[k] === "function") out.add(k);
        } catch (q) {
        }
      });
    } catch (q) {
    }
    return Array.from(out).sort().slice(0, 250);
  }
  function collectorPrimitives(c) {
    var o = {};
    try {
      Object.keys(c || {}).slice(0, 180).forEach(function(k) {
        try {
          var v = c[k];
          if (v == null || ["string", "number", "boolean"].indexOf(typeof v) >= 0) o[k] = v;
        } catch (q) {
        }
      });
    } catch (q) {
    }
    return o;
  }
  function collectorMenuContext() {
    try {
      return JSON.parse(JSON.stringify(ROOT.history && ROOT.history.state && ROOT.history.state.data || {}));
    } catch (q) {
      return {};
    }
  }
  function directRefFor(e, c, cid, typ) {
    var m = collectorMenuContext(), v = "";
    try {
      v = c && c.getValue ? c.getValue() : e && e.value;
    } catch (q) {
      v = e && e.value;
    }
    return { menuKey: m.menuCangVal || "", componentId: cid || "", elementId: e && e.id || "", componentType: typ || "", value: v, text: collectorLabel(e, c), title: e && e.getAttribute && e.getAttribute("title") || "", domChecked: !!(e && e.checked) };
  }
  function copyText(v) {
    v = s(v);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v);
        return;
      }
    } catch (q) {
    }
    try {
      var ta = DOC.createElement("textarea");
      ta.value = v;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      DOC.body.appendChild(ta);
      ta.select();
      DOC.execCommand("copy");
      ta.remove();
    } catch (q) {
    }
  }
  function findMenuController(w) {
    try {
      if (w.com && typeof w.com.gfnOpenMenu === "function") return w.com;
      var names = Object.getOwnPropertyNames(w);
      for (var i = 0; i < names.length; i++) {
        var x;
        try {
          x = w[names[i]];
        } catch (q) {
          continue;
        }
        if (x && typeof x.gfnOpenMenu === "function") return x;
      }
      for (var j = 0; j < w.frames.length; j++) {
        var z = findMenuController(w.frames[j]);
        if (z) return z;
      }
    } catch (q) {
    }
    return null;
  }
  function makeDirectLink(ref) {
    return "javascript:(()=>{const R=" + JSON.stringify(ref) + ';function M(w){try{if(w.com&&typeof w.com.gfnOpenMenu==="function")return w.com;for(const n of Object.getOwnPropertyNames(w)){let x;try{x=w[n]}catch(e){continue}if(x&&typeof x.gfnOpenMenu==="function")return x}for(let i=0;i<w.frames.length;i++){const z=M(w.frames[i]);if(z)return z}}catch(e){}}function C(w){try{let c=null;if(R.componentId&&w.$p&&typeof w.$p.getComponentById==="function")c=w.$p.getComponentById(R.componentId);if(!c&&R.componentId&&w.WebSquare&&w.WebSquare.util&&typeof w.WebSquare.util.getComponentById==="function")c=w.WebSquare.util.getComponentById(R.componentId);if(c)return{c,w};for(let i=0;i<w.frames.length;i++){const z=C(w.frames[i]);if(z)return z}}catch(e){}}function E(w){try{if(R.elementId){const e=w.document.getElementById(R.elementId);if(e)return{e,w}}for(let i=0;i<w.frames.length;i++){const z=E(w.frames[i]);if(z)return z}}catch(e){}}function X(){const z=C(top),d=E(top),c=z&&z.c,e=d&&d.e,t=String(R.componentType||"").toLowerCase();try{if(["radio","checkbox","trigger","button","tab","link"].some(x=>t.includes(x))){if(e){e.click();return true}if(c&&typeof c.click==="function"){c.click();return true}}if(["select","selectbox","combobox","input","textarea","calendar","spinner"].some(x=>t.includes(x))){if(c&&typeof c.setValue==="function")c.setValue(R.value);if(e){if(R.value!==undefined)e.value=R.value;try{e.dispatchEvent(new Event("input",{bubbles:true}))}catch(q){}try{e.dispatchEvent(new Event("change",{bubbles:true}))}catch(q){}}return!!(c||e)}if(e){e.click();return true}if(c&&typeof c.setValue==="function"&&R.value!==undefined){c.setValue(R.value);return true}}catch(q){}return false}const m=M(top),cur=top.history&&top.history.state&&top.history.state.data&&top.history.state.data.menuCangVal;if(R.menuKey&&m&&cur!==R.menuKey)try{m.gfnOpenMenu(R.menuKey,{isHistory:true})}catch(e){}let n=0,q=setInterval(()=>{if(X()||++n>40)clearInterval(q)},200)})()';
  }
  function executeDirectRef(ref) {
    function attempt() {
      var ws = getWindows();
      for (var i = 0; i < ws.length; i++) {
        var c = ref.componentId ? wsComp(ws[i].w, ref.componentId) : null, e = null;
        try {
          e = ref.elementId ? ws[i].d.getElementById(ref.elementId) : null;
        } catch (q) {
        }
        if (!(c || e)) continue;
        var t2 = s(ref.componentType).toLowerCase();
        try {
          if (["radio", "checkbox", "trigger", "button", "tab", "link"].some(function(x) {
            return t2.indexOf(x) >= 0;
          })) {
            if (e) {
              e.click();
              return true;
            }
            if (c && typeof c.click === "function") {
              c.click();
              return true;
            }
          }
          if (c && typeof c.setValue === "function") c.setValue(ref.value);
          if (e && ref.value !== void 0) {
            e.value = ref.value;
            e.dispatchEvent(new Event("input", { bubbles: true }));
            e.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          if (e) {
            e.click();
            return true;
          }
        } catch (q) {
        }
        return true;
      }
      return false;
    }
    var m = findMenuController(ROOT), cur = "";
    try {
      cur = ROOT.history && ROOT.history.state && ROOT.history.state.data && ROOT.history.state.data.menuCangVal || "";
    } catch (q) {
    }
    if (ref.menuKey && m && cur !== ref.menuKey) {
      try {
        m.gfnOpenMenu(ref.menuKey, { isHistory: true });
        var n = 0, t = setInterval(function() {
          if (attempt() || ++n > 40) clearInterval(t);
        }, 200);
        return true;
      } catch (q) {
      }
    }
    return attempt();
  }
  async function scanControls() {
    var count = 0, raw = collectRaw(), si = screenInfo(raw), baseTime = nowIso();
    await registerScreen(si);
    for (var wi = 0, ws = getWindows(); wi < ws.length; wi++) {
      var x = ws[wi], els = [];
      try {
        els = Array.from(x.d.querySelectorAll('button,input,select,textarea,a,[role="button"],[role="tab"],[role="checkbox"],[role="radio"],[onclick],.w2trigger,.w2radio,.w2checkbox,.w2selectbox,.w2tabcontrol_tabhost,.w2input,.w2calendar'));
      } catch (e2) {
      }
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        if (e.closest && e.closest("[data-g2bv4-ui]")) continue;
        var cid = e.id || e.getAttribute("name") || "", c = cid ? wsComp(x.w, cid) : null, typ = collectorControlType(e, c), ref = directRefFor(e, c, cid, typ), idx = e.getAttribute && e.getAttribute("index") || "", controlKey = "control:" + hashString([ref.menuKey, normalizeDynamicId(cid), idx, typ, ref.title].join("|")), rec = { id: collectorId("control"), kind: "control", capturedAt: baseTime, screenKey: si.key, url: si.url, areaCd: si.areaCd, depth1: si.depth1, depth2: si.depth2, depth3: si.depth3, controlKey, framePath: x.path, componentId: cid, normalizedComponentId: normalizeDynamicId(cid), elementId: e.id || "", normalizedElementId: normalizeDynamicId(e.id || ""), type: typ, label: collectorLabel(e, c), visible: isVisible(e), value: ref.value, attributes: collectorAttrs(e), domPath: collectorDomPath(e), outerHTML: s(e.outerHTML).slice(0, 1e4), componentFound: !!c, componentMethods: collectorMethods(c), componentPrimitiveProps: collectorPrimitives(c), directRef: ref, directLink: makeDirectLink(ref) };
        await dbPut(STORES.collectorEvents, rec);
        count++;
        if (count >= 700) break;
      }
      if (count >= 700) break;
    }
    return count;
  }
  function installDocumentCollector(w, path) {
    try {
      let act = function(ev) {
        if (!collector.active) return;
        var e = ev.target;
        try {
          if (e && e.closest && e.closest("[data-g2bv4-ui]")) return;
        } catch (q) {
        }
        var cid = e && e.id || "", c = cid ? wsComp(w, cid) : null, typ = collectorControlType(e, c), ref = directRefFor(e, c, cid, typ);
        addCollectorEvent("action", { eventType: ev.type, framePath: path, componentId: cid, normalizedComponentId: normalizeDynamicId(cid), elementId: e && e.id || "", type: typ, label: collectorLabel(e, c), trusted: !!ev.isTrusted, value: ref.value, directRef: ref, directLink: makeDirectLink(ref) });
        collector.lastActionAt = Date.now();
        clearTimeout(collector.timer);
        collector.timer = setTimeout(function() {
          if (collector.active) captureSnapshot("action-" + ev.type, false);
        }, 700);
      };
      if (collector.docs.has(w.document)) return;
      collector.docs.add(w.document);
      var click = function(e) {
        act(e);
      }, change = function(e) {
        act(e);
      }, key = function(e) {
        if (e.key === "Enter") act(e);
      };
      w.document.addEventListener("click", click, true);
      w.document.addEventListener("change", change, true);
      w.document.addEventListener("keydown", key, true);
      collector.undo.push(function() {
        try {
          w.document.removeEventListener("click", click, true);
          w.document.removeEventListener("change", change, true);
          w.document.removeEventListener("keydown", key, true);
        } catch (q) {
        }
      });
      try {
        var mo = new MutationObserver(function() {
          if (!collector.active) return;
          clearTimeout(collector.timer);
          collector.timer = setTimeout(function() {
            captureSnapshot("screen-change", false);
          }, 650);
        });
        mo.observe(w.document.documentElement, { childList: true, subtree: true });
        collector.observers.push(mo);
      } catch (q) {
      }
      for (var i = 0; i < w.frames.length; i++) installDocumentCollector(w.frames[i], path + ">frame" + i);
    } catch (e) {
    }
  }
  function installNetworkCollector(w) {
    try {
      if (collector.hookedWindows.has(w)) return;
      collector.hookedWindows.add(w);
      var installed = true;
      var X = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
      if (X && !X.__g2bv42) {
        var op = X.open, os = X.send, oh = X.setRequestHeader;
        var no = X.open = function(m, u) {
          if (!installed) return op.apply(this, arguments);
          this.__g2bv42m = m;
          this.__g2bv42u = u;
          this.__g2bv42h = {};
          return op.apply(this, arguments);
        };
        var nh = X.setRequestHeader = function(k, v) {
          if (!installed) return oh.apply(this, arguments);
          try {
            this.__g2bv42h[k] = v;
          } catch (q) {
          }
          return oh.apply(this, arguments);
        };
        var ns = X.send = function(body) {
          if (!installed || !collector.active) return os.apply(this, arguments);
          var self = this, id = collectorId("request"), started = nowIso();
          addCollectorEvent("request", { id, transport: "xhr", method: s(self.__g2bv42m || "GET").toUpperCase(), requestUrl: s(self.__g2bv42u || ""), headers: self.__g2bv42h || {}, body: body == null ? "" : s(body).slice(0, 1e5), startedAt: started });
          try {
            self.addEventListener("loadend", function() {
              if (!installed || !collector.active) return;
              var txt = "";
              try {
                txt = typeof self.responseText === "string" ? self.responseText : "";
              } catch (q) {
              }
              addCollectorEvent("response", { requestId: id, transport: "xhr", status: self.status, responseUrl: self.responseURL || "", contentType: self.getResponseHeader && self.getResponseHeader("content-type") || "", responseLength: txt.length, responseText: txt.slice(0, 5e5) });
              clearTimeout(collector.timer);
              collector.timer = setTimeout(function() {
                if (installed && collector.active) captureSnapshot("xhr-response", false);
              }, 500);
            }, { once: true });
          } catch (q) {
          }
          return os.apply(this, arguments);
        };
        X.__g2bv42 = ns;
        collector.undo.push(function() {
          installed = false;
          try {
            if (X.open === no) X.open = op;
            if (X.send === ns) X.send = os;
            if (X.setRequestHeader === nh) X.setRequestHeader = oh;
            if (X.__g2bv42 === ns) delete X.__g2bv42;
          } catch (q) {
          }
        });
      }
      if (typeof w.fetch === "function" && !w.fetch.__g2bv42) {
        var of = w.fetch;
        var nf = function() {
          if (!installed || !collector.active) return of.apply(this, arguments);
          var args = arguments, req = args[0], opt = args[1] || {}, url = typeof req === "string" ? req : req && req.url || "", method = s(opt.method || req && req.method || "GET").toUpperCase(), id = collectorId("request");
          addCollectorEvent("request", { id, transport: "fetch", method, requestUrl: url, headers: opt.headers || {}, body: opt.body == null ? "" : s(opt.body).slice(0, 1e5), startedAt: nowIso() });
          return of.apply(this, args).then(function(res) {
            if (!installed || !collector.active) return res;
            try {
              res.clone().text().then(function(txt) {
                if (installed && collector.active) {
                  addCollectorEvent("response", { requestId: id, transport: "fetch", status: res.status, responseUrl: res.url || "", contentType: res.headers && res.headers.get("content-type") || "", responseLength: txt.length, responseText: txt.slice(0, 5e5) });
                  clearTimeout(collector.timer);
                  collector.timer = setTimeout(function() {
                    if (installed && collector.active) captureSnapshot("fetch-response", false);
                  }, 500);
                }
              }).catch(function() {
              });
            } catch (q) {
            }
            return res;
          });
        };
        nf.__g2bv42 = 1;
        w.fetch = nf;
        collector.undo.push(function() {
          installed = false;
          try {
            if (w.fetch === nf) w.fetch = of;
          } catch (q) {
          }
        });
      }
      for (var i = 0; i < w.frames.length; i++) installNetworkCollector(w.frames[i]);
    } catch (e) {
    }
  }
  function installAppCollector(w) {
    try {
      var candidates = [];
      if (w.com) candidates.push(w.com);
      var names = [];
      try {
        names = Object.getOwnPropertyNames(w).slice(0, 1200);
      } catch (q) {
      }
      for (var i = 0; i < names.length; i++) {
        var o;
        try {
          o = w[names[i]];
        } catch (q) {
          continue;
        }
        if (o && (typeof o === "object" || typeof o === "function") && (typeof o.gfnOpenMenu === "function" || typeof o.gfnOpenMenuMove === "function" || typeof o.gfnExecute === "function")) candidates.push(o);
      }
      for (var ci = 0; ci < candidates.length; ci++) {
        let obj = candidates[ci];
        if (!obj || collector.hookedObjects.has(obj)) continue;
        collector.hookedObjects.add(obj);
        ["gfnOpenMenu", "gfnOpenMenuMove"].forEach(function(n) {
          if (typeof obj[n] !== "function") return;
          var orig = obj[n], installed = true;
          var wrapped = obj[n] = function() {
            if (installed && collector.active) {
              var args = Array.prototype.slice.call(arguments);
              addCollectorEvent("menu", { method: n, menuKey: s(args[0] || ""), args: args.slice(0, 4) });
              clearTimeout(collector.timer);
              collector.timer = setTimeout(function() {
                if (installed && collector.active) captureSnapshot("menu-change", false);
              }, 800);
            }
            return orig.apply(this, arguments);
          };
          collector.undo.push(function() {
            installed = false;
            try {
              if (obj[n] === wrapped) obj[n] = orig;
            } catch (q) {
            }
          });
        });
        if (typeof obj.gfnExecute === "function") {
          (function() {
            var orig = obj.gfnExecute, installed = true;
            var wrapped = obj.gfnExecute = function() {
              if (installed && collector.active) {
                var z = arguments[0] || {};
                addCollectorEvent("submission", { submissionId: z.id || "", action: z.action || "", method: z.method || "", options: z });
                clearTimeout(collector.timer);
                collector.timer = setTimeout(function() {
                  if (installed && collector.active) captureSnapshot("submission", false);
                }, 900);
              }
              return orig.apply(this, arguments);
            };
            collector.undo.push(function() {
              installed = false;
              try {
                if (obj.gfnExecute === wrapped) obj.gfnExecute = orig;
              } catch (q) {
              }
            });
          })();
        }
      }
      for (var f = 0; f < w.frames.length; f++) installAppCollector(w.frames[f]);
    } catch (e) {
    }
  }
  function installCollectorHooks() {
    getWindows().forEach(function(x) {
      installDocumentCollector(x.w, x.path);
      installNetworkCollector(x.w);
    });
    installAppCollector(ROOT);
  }
  function uninstallCollectorHooks() {
    clearTimeout(collector.timer);
    collector.observers.forEach(function(o) {
      try {
        o.disconnect();
      } catch (e) {
      }
    });
    collector.observers = [];
    for (var i = collector.undo.length - 1; i >= 0; i--) try {
      collector.undo[i]();
    } catch (e) {
    }
    collector.undo = [];
    collector.docs = /* @__PURE__ */ new WeakSet();
    collector.hookedWindows = /* @__PURE__ */ new WeakSet();
    collector.hookedObjects = /* @__PURE__ */ new WeakSet();
  }
  async function captureSnapshot(trigger, force, manual) {
    var raw = collectRaw(), h = hashString(JSON.stringify(raw)), si = screenInfo(raw), screenHash = si.key + "|" + h;
    if (!force && collector.active && screenHash === collector.lastScreenHash) return null;
    await registerScreen(si);
    var sid = collector.active ? collector.sessionId : "manual:" + stamp(), seq = collector.active ? ++collector.seq : 1, dups = [];
    try {
      dups = await dbIndexAll(STORES.rawCaptures, "screenHash", screenHash);
    } catch (e) {
    }
    var duplicateRaw = dups.some(function(x) {
      return x && x.eventType === "SNAPSHOT";
    }), rec = { sessionId: sid, eventType: "SNAPSHOT", seq, capturedAt: nowIso(), trigger: trigger || "manual", screenKey: si.key, screenHash, url: si.url, areaCd: si.areaCd, depth1: si.depth1, depth2: si.depth2, depth3: si.depth3, hash: h, raw, manual: !!manual };
    if (!duplicateRaw) await dbAdd(STORES.rawCaptures, rec);
    var projection = await projectMappedSources(raw, si);
    await addCollectorEvent("snapshot", { sessionId: sid, trigger: trigger || "manual", hash: h, screenHash, duplicateRaw, sourceCount: listCurrentSources(raw).length, projection });
    if (collector.active) {
      collector.lastHash = h;
      collector.lastScreenHash = screenHash;
    }
    return { raw, screen: si, record: duplicateRaw ? null : rec, duplicateRaw, projection };
  }
  async function autoStart() {
    if (collector.active) return;
    var t = nowIso(), old = await dbAll(STORES.rawSessions);
    for (var i = 0; i < old.length; i++) if (old[i].status === "RUNNING") {
      old[i].status = "INTERRUPTED";
      old[i].endedAt = t;
      await dbPut(STORES.rawSessions, old[i]);
    }
    collector.active = true;
    collector.sessionId = stamp() + "_" + Math.random().toString(36).slice(2, 6);
    collector.startedAt = t;
    collector.seq = 0;
    collector.lastHash = null;
    collector.lastScreenHash = null;
    await dbPut(STORES.rawSessions, { sessionId: collector.sessionId, startedAt: t, status: "RUNNING", endedAt: null });
    await dbAdd(STORES.rawCaptures, { sessionId: collector.sessionId, eventType: "START", capturedAt: t, trigger: "auto-start" });
    installCollectorHooks();
    await scanControls();
    await captureSnapshot("auto-initial", true, false);
    if (typeof refreshCollectionStatus === "function") refreshCollectionStatus();
    toast("자동수집 시작");
  }
  async function autoStop() {
    if (!collector.active) return;
    await captureSnapshot("auto-final", false, false);
    var t = nowIso();
    await dbAdd(STORES.rawCaptures, { sessionId: collector.sessionId, eventType: "STOP", capturedAt: t, trigger: "auto-stop" });
    await dbPut(STORES.rawSessions, { sessionId: collector.sessionId, startedAt: collector.startedAt, endedAt: t, status: "STOPPED" });
    collector.active = false;
    uninstallCollectorHooks();
    if (typeof refreshCollectionStatus === "function") refreshCollectionStatus();
    toast("자동수집 종료");
  }
  async function manualCollect() {
    var r = await captureSnapshot("manual", true, true);
    await scanControls();
    if (typeof refreshCollectionStatus === "function") refreshCollectionStatus();
    toast("수동수집 완료 · " + listCurrentSources(r.raw).length + "개 소스");
    return r;
  }
  async function collectionExport() {
    download({ type: "G2B_COLLECTION_V4", version: 4, exportedAt: nowIso(), sessions: await dbAll(STORES.rawSessions), captures: await dbAll(STORES.rawCaptures), events: await dbAll(STORES.collectorEvents) }, "g2b_collection_" + stamp() + ".json");
  }
  var NOTE_COLORS = { yellow: "#fff2a8", green: "#d9f7be", pink: "#ffd6e7", blue: "#d8ecff", lavender: "#e9ddff", gray: "#e8e8e8" };
  function parseNoteTokens(text) {
    text = s(text);
    function all(re) {
      var out = [], m;
      while (m = re.exec(text)) if (out.indexOf(m[1]) < 0) out.push(m[1]);
      return out;
    }
    return { mentions: all(/(?:^|\s)@([^\s@#!]+)/g), tags: all(/(?:^|\s)#([^\s@#!]+)/g), bangs: all(/(?:^|\s)!([^\s@#!]+)/g) };
  }
  function noteTitle(n) {
    var t = s(n.title).trim();
    if (t) return t;
    var first = s(n.content).split(/\r?\n/).map(function(x) {
      return x.trim();
    }).filter(Boolean)[0] || "(제목 없음)";
    return first.slice(0, 60);
  }
  function notePrefix(n) {
    return n.kind === "screen" ? "[화면]" : n.kind === "schedule" ? "[일정]" : "[일반]";
  }
  function noteMatchesScreen(n, si) {
    return n.kind !== "screen" || screenRuleMatches(n.screenRule || {}, si);
  }
  async function saveNote(n) {
    var tok = parseNoteTokens(n.content);
    n.mentions = tok.mentions;
    n.tags = tok.tags;
    n.bangs = tok.bangs;
    n.updatedAt = nowIso();
    if (!n.createdAt) n.createdAt = n.updatedAt;
    if (!n.color) n.color = "yellow";
    if (n.important !== 1) n.important = 0;
    if (n.pinned !== 1) n.pinned = 0;
    await dbPut(STORES.notes, n);
    return n;
  }
  async function createNote(kind, opt) {
    opt = opt || {};
    var si = screenInfo(), n = { id: uid("note"), kind: kind || "general", title: opt.title || "", content: opt.content || "", createdAt: nowIso(), updatedAt: nowIso(), color: opt.color || "yellow", important: opt.important ? 1 : 0, pinned: opt.pinned ? 1 : 0, group: opt.group || "", dueAt: opt.dueAt || "", deletedAt: null, screenRule: kind === "screen" ? opt.screenRule || defaultScreenRule(si) : null, extra: opt.extra || {} };
    await saveNote(n);
    return n;
  }
  async function activeNotes() {
    return (await dbAll(STORES.notes)).filter(function(n) {
      return !n.deletedAt;
    });
  }
  async function trashNote(n) {
    n.deletedAt = nowIso();
    n.updatedAt = n.deletedAt;
    await dbPut(STORES.notes, n);
  }
  async function getSetting(id, def) {
    var r = await dbGet(STORES.settings, id);
    return r && r.value !== void 0 ? r.value : def;
  }
  async function putSetting(id, value) {
    await dbPut(STORES.settings, { id, value, updatedAt: nowIso() });
    return value;
  }
  async function migrateV4() {
    var done = await dbGet(STORES.settings, "migratedV4");
    if (done) return;
    var old = await dbAll(STORES.toolMemos), screens = await dbAll(STORES.screenRegistry);
    for (var i = 0; i < old.length; i++) {
      var m = old[i], exists = await dbGet(STORES.notes, "v3_" + m.id);
      if (exists) continue;
      var rule = null;
      if (m.scope === "screen") {
        var sr = screens.find(function(x) {
          return x.key === m.screenKey || x.legacyKey === m.screenKey;
        });
        rule = sr ? defaultScreenRule(sr) : { url: normalizedUrl(), urlMode: "path", useAreaCd: false, useDepth1: false, useDepth2: false, useDepth3: false };
      }
      await saveNote({ id: "v3_" + m.id, kind: m.scope === "screen" ? "screen" : "general", title: "", content: m.text || "", createdAt: m.createdAt || nowIso(), updatedAt: m.updatedAt || nowIso(), color: "yellow", important: 0, pinned: 0, group: "", dueAt: "", deletedAt: null, screenRule: rule, extra: {} });
    }
    await dbPut(STORES.settings, { id: "migratedV4", value: true, updatedAt: nowIso() });
  }
  var STYLE_ID = "__g2b_tb_v42_style", WINDOW_CLASS = "g2bv4-window";
  var oldStyle = DOC.getElementById(STYLE_ID);
  if (oldStyle) oldStyle.remove();
  var css = DOC.createElement("style");
  css.id = STYLE_ID;
  css.textContent = ` [data-g2bv4-ui],[data-g2bv4-ui] *{box-sizing:border-box}#g2bV4{--bg:#111318;--panel:#191c22;--panel2:#22262e;--line:#353b46;--txt:#eef1f5;--muted:#929aa7;--accent:#6f8cff;--good:#32b67a;--danger:#df6671;font:12px "Malgun Gothic",Inter,Arial,sans-serif;color:var(--txt)} #G2BV4_MAIN button,#G2BV4_MAIN input,#G2BV4_MAIN select,#G2BV4_MAIN textarea,.g2bv4-window button,.g2bv4-window input,.g2bv4-window select,.g2bv4-window textarea{font:inherit} #G2BV4_MAIN button,.g2bv4-window button{border:1px solid #3b424e;border-radius:8px;background:#252a33;color:#eef1f5;padding:7px 9px;cursor:pointer;white-space:nowrap}#G2BV4_MAIN button:hover,.g2bv4-window button:hover{filter:brightness(1.12)} .g2bv4-primary{background:#4969d8!important;border-color:#647fe3!important;color:#fff!important}.g2bv4-good{background:#17704e!important;color:#fff!important}.g2bv4-danger{background:#713039!important;color:#fff!important}.g2bv4-ghost{background:transparent!important} #G2BV4_MAIN input,#G2BV4_MAIN select,#G2BV4_MAIN textarea,.g2bv4-window input,.g2bv4-window select,.g2bv4-window textarea{border:1px solid #3b424e;border-radius:8px;background:#101319;color:#eef1f5;padding:7px;outline:none}.g2bv4-window{position:fixed;z-index:2147483645;background:#171a20;color:#eef1f5;border:1px solid #454c58;border-radius:12px;box-shadow:0 18px 60px #0008;overflow:hidden;resize:none;min-width:420px;min-height:260px;font:12px "Malgun Gothic",Arial,sans-serif}.g2bv4-wh{height:38px;background:#232831;border-bottom:1px solid #39404b;display:flex;align-items:center;gap:7px;padding:0 8px;cursor:move;user-select:none;color:#f4f6f9}.g2bv4-wh b{flex:1}.g2bv4-wb{height:calc(100% - 38px);overflow:auto;padding:9px;background:#171a20;color:#eef1f5}.g2bv4-x{width:28px;height:26px;padding:0!important;color:#d9dee7!important}.g2bv4-mini{font-size:10px;color:#9aa4b2}.g2bv4-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:nowrap;margin-bottom:7px;overflow-x:auto}.g2bv4-toolbar input{min-width:120px;flex:1}.g2bv4-tabbar{display:flex;gap:3px;align-items:center;overflow-x:auto;padding:2px;white-space:nowrap}.g2bv4-tabbar button.active{background:#384b83;border-color:#718ce8;color:#fff}.g2bv4-spacer{flex:1}.g2bv4-card{border:1px solid #3a414c;background:#20242c;color:#eef1f5;border-radius:10px;padding:8px;margin:3px 0}.g2bv4-scroll{overflow:auto;background:#181c22}.g2bv4-grid{border-collapse:collapse;width:max-content;min-width:100%;font:11px Consolas,"Malgun Gothic",sans-serif;table-layout:auto;color:#e9edf3}.g2bv4-grid th{position:sticky;top:0;background:#2b3039;color:#f5f7fa;z-index:3;border:1px solid #464d58;padding:5px 7px;white-space:nowrap}.g2bv4-grid td{background:#1c2027;color:#e9edf3;border:1px solid #3b424c;padding:4px 7px;white-space:nowrap;min-width:80px;height:27px;outline:none}.g2bv4-grid td.gsel{box-shadow:inset 0 0 0 2px #6f8cff;background:#26365f}.g2bv4-grid tr.rsel td{background:#253250}.g2bv4-emptygrid{min-height:330px;background:repeating-linear-gradient(#1c2027 0,#1c2027 27px,#333944 28px);border:1px solid #3b424c}.g2bv4-note{color:#262626;border:1px solid rgba(0,0,0,.12);border-radius:5px;padding:9px;box-shadow:0 2px 5px #0003;position:relative;resize:vertical;overflow:auto;min-height:104px}.g2bv4-note textarea{background:transparent!important;border:0!important;color:#222!important;padding:4px 0!important;resize:none!important;min-height:52px}.g2bv4-note input{background:transparent!important;border:0!important;color:#222!important;padding:2px 0!important;font-weight:700}.g2bv4-note-actions{display:flex;gap:2px;justify-content:flex-end;flex-wrap:nowrap}.g2bv4-note-actions button{background:transparent!important;border:0!important;color:#535353!important;padding:2px 4px!important;font-size:11px}.g2bv4-stick{position:fixed;z-index:2147483644;color:#262626;border:1px solid #b8ad70;border-radius:5px;box-shadow:0 8px 28px #0004;padding:8px;resize:both;overflow:auto;min-width:180px;min-height:90px}.g2bv4-stick.min{width:170px!important;height:36px!important;min-height:36px!important;resize:none;overflow:hidden}.g2bv4-stickbar{display:flex;gap:3px;align-items:center;cursor:move}.g2bv4-stickbar b{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.g2bv4-color{width:17px!important;height:17px!important;padding:0!important;border-radius:50%!important;border:1px solid #777!important}.g2bv4-sectionTitle{font-size:10px;color:#949eac;margin:9px 0 5px}.g2bv4-badge{display:inline-flex;border:1px solid #3d4653;border-radius:999px;padding:2px 7px;font-size:9px;color:#9ea8b7}.g2bv4-cal{display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid #404753;border-left:1px solid #404753;color:#e8ecf2}.g2bv4-day{min-height:88px;border-right:1px solid #404753;border-bottom:1px solid #404753;padding:4px;background:#1e2229;color:#e8ecf2}.g2bv4-day.other{background:#181b20;color:#717b88}.g2bv4-day.sel{box-shadow:inset 0 0 0 2px #6687ed}.g2bv4-event{font-size:9px;padding:2px 3px;margin:2px 0;border-radius:4px;background:#d7c66d;color:#202020;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}.g2bv4-listgroup{border:1px solid #3a414c;border-radius:8px;margin:6px 0;background:#20242c;color:#eef1f5}.g2bv4-listgroup>button{width:100%;text-align:left;border:0!important;border-radius:8px!important;background:#2a3039!important;color:#eef1f5!important}.g2bv4-row{display:flex;gap:6px;align-items:center;min-width:0}.g2bv4-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.g2bv4-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}`;
  css.textContent = css.textContent.replace(/#G2BV4_MAIN/g, "#G2BV42_MAIN");
  (DOC.head || DOC.documentElement).appendChild(css);
  function E(tag, cls, text) {
    var x = DOC.createElement(tag);
    if (cls) x.className = cls;
    if (text !== void 0) x.textContent = text;
    return x;
  }
  function B(text, cls, fn) {
    var b = E("button", cls || "", text);
    if (fn) b.onclick = fn;
    return b;
  }
  function I(type, ph) {
    var x = E("input");
    x.type = type || "text";
    if (ph) x.placeholder = ph;
    return x;
  }
  function Sel(opts) {
    var s1 = E("select");
    (opts || []).forEach(function(o) {
      var x = E("option");
      x.value = typeof o === "string" ? o : o.value;
      x.textContent = typeof o === "string" ? o : o.label;
      s1.appendChild(x);
    });
    return s1;
  }
  var windowSeq = 0, appWindows = [], instanceWindows = /* @__PURE__ */ new Map();
  function makeMovable(node, handle, onEnd) {
    var down = false, dx = 0, dy = 0;
    function md(e) {
      if (e.target.closest("button,input,select,textarea")) return;
      var r = node.getBoundingClientRect();
      down = true;
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      e.preventDefault();
    }
    function mm(e) {
      if (!down) return;
      node.style.left = Math.max(0, e.clientX - dx) + "px";
      node.style.top = Math.max(0, e.clientY - dy) + "px";
      node.style.right = "auto";
      node.style.bottom = "auto";
    }
    function mu() {
      if (down) {
        down = false;
        if (onEnd) onEnd();
      }
    }
    handle.addEventListener("mousedown", md);
    DOC.addEventListener("mousemove", mm);
    DOC.addEventListener("mouseup", mu);
    return function() {
      handle.removeEventListener("mousedown", md);
      DOC.removeEventListener("mousemove", mm);
      DOC.removeEventListener("mouseup", mu);
    };
  }
  function spawnNearPanel(width, height, offset) {
    var r = null;
    try {
      r = panel && panel.isConnected ? panel.getBoundingClientRect() : null;
    } catch (e) {
    }
    var w = Math.min(parseInt(width, 10) || 900, Math.max(420, ROOT.innerWidth - 24)), h = Math.min(parseInt(height, 10) || 620, Math.max(260, ROOT.innerHeight - 24)), left = r ? Math.max(8, Math.min(ROOT.innerWidth - w - 8, r.left - w - 10 + (offset || 0))) : Math.max(8, ROOT.innerWidth - w - 18), top = r ? Math.max(8, Math.min(ROOT.innerHeight - h - 8, r.top + (offset || 0))) : 24;
    return { left, top, width: w, height: h };
  }
  function openWindow(title, opt) {
    opt = opt || {};
    var instanceKey = opt.instanceKey || opt.persistKey || title, old = instanceWindows.get(instanceKey);
    if (old && old.win && old.win.isConnected) old.close();
    var pos = spawnNearPanel(opt.width || "900px", opt.height || "620px", windowSeq % 6 * 10), w = E("div", "g2bv4-window");
    w.setAttribute("data-g2bv4-ui", "1");
    w.id = "g2bv42_win_" + ++windowSeq;
    w.style.width = pos.width + "px";
    w.style.height = pos.height + "px";
    w.style.left = (opt.left ? parseInt(opt.left, 10) : pos.left) + "px";
    w.style.top = (opt.top ? parseInt(opt.top, 10) : pos.top) + "px";
    w.style.maxWidth = "calc(100vw - 16px)";
    w.style.maxHeight = "calc(100vh - 16px)";
    w.style.resize = opt.resizable ? "both" : "none";
    var h = E("div", "g2bv4-wh"), t = E("b", "", title), x = B("×", "g2bv4-x");
    h.appendChild(t);
    h.appendChild(x);
    var body = E("div", "g2bv4-wb");
    w.appendChild(h);
    w.appendChild(body);
    DOC.body.appendChild(w);
    appWindows.push(w);
    var persist = opt.persistKey;
    function saveLayout() {
      if (!persist) return;
      var p = { left: w.style.left, top: w.style.top };
      if (opt.resizable) {
        p.width = w.style.width;
        p.height = w.style.height;
      }
      putSetting("window:" + persist, p);
    }
    var undo = makeMovable(w, h, saveLayout), ro;
    if (opt.resizable) {
      try {
        ro = new ResizeObserver(saveLayout);
        ro.observe(w);
      } catch (q) {
      }
    }
    var api = { win: w, head: h, title: t, body, close: function() {
      x.click();
    } };
    instanceWindows.set(instanceKey, api);
    x.onclick = function() {
      undo();
      try {
        ro && ro.disconnect();
      } catch (q) {
      }
      w.remove();
      appWindows = appWindows.filter(function(z) {
        return z !== w;
      });
      if (instanceWindows.get(instanceKey) === api) instanceWindows.delete(instanceKey);
      if (opt.onClose) opt.onClose();
    };
    return api;
  }
  function SmartGrid(host, rows, opt) {
    opt = opt || {};
    host.innerHTML = "";
    var data = rows || [], tableId = opt.tableId || "", selectedRows = /* @__PURE__ */ new Set(), selectedCell = null, filtered = data.slice(), cols = opt.columns ? opt.columns.slice() : [];
    if (!opt.columns) data.forEach(function(r) {
      Object.keys(r || {}).forEach(function(k) {
        if (cols.indexOf(k) < 0 && visibleFor(k, tableId)) cols.push(k);
      });
    });
    cols.sort(function(a, b) {
      var oa = colOrder(a, tableId), ob = colOrder(b, tableId);
      return oa === ob ? a.localeCompare(b) : oa - ob;
    });
    var toolbar = E("div", "g2bv4-toolbar"), q = I("search", "검색"), fc = Sel([{ value: "", label: "전체 칼럼" }].concat(cols.map(function(k) {
      return { value: k, label: labelFor(k, tableId) };
    }))), fv = I("text", "필터값"), cnt = E("span", "g2bv4-mini");
    q.style.maxWidth = "220px";
    fc.style.maxWidth = "170px";
    fv.style.maxWidth = "150px";
    toolbar.appendChild(q);
    toolbar.appendChild(fc);
    toolbar.appendChild(fv);
    toolbar.appendChild(cnt);
    host.appendChild(toolbar);
    var wrap = E("div", "g2bv4-scroll");
    wrap.style.height = opt.height || "430px";
    wrap.style.border = "1px solid #d9dde3";
    host.appendChild(wrap);
    var tbl = E("table", "g2bv4-grid"), thead = E("thead"), hr = E("tr"), selh = E("th"), allck = I("checkbox");
    allck.style.width = "auto";
    selh.appendChild(allck);
    hr.appendChild(selh);
    cols.forEach(function(k) {
      var th = E("th", "", labelFor(k, tableId));
      th.title = k;
      th.style.minWidth = Math.max(70, colWidth(k, tableId)) + "px";
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    tbl.appendChild(thead);
    var tb = E("tbody");
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    function valueText(k, v) {
      return displayValue(k, v);
    }
    var editQueues = new WeakMap();
    function saveCell(row, k, v) {
      if (!opt.onCellEdited) {
        row[k] = v;
        return Promise.resolve();
      }
      var previous = editQueues.get(row) || Promise.resolve(), pending = previous.catch(function() {}).then(async function() {
        var hadKey = Object.prototype.hasOwnProperty.call(row, k), old = row[k];
        row[k] = v;
        try {
          return await opt.onCellEdited(row, k, v);
        } catch (e) {
          if (hadKey) row[k] = old;
          else delete row[k];
          throw e;
        }
      });
      editQueues.set(row, pending);
      return pending;
    }
    function beginEdit(td, row, k, initial) {
      if (td.querySelector("input")) return;
      var old = row[k] == null ? "" : s(row[k]), inp = I("text");
      inp.value = initial !== void 0 ? initial : old;
      inp.style.cssText = "min-width:70px;width:100%;padding:2px;border:1px solid #6f8cff;background:#fff;color:#111";
      td.innerHTML = "";
      td.appendChild(inp);
      inp.focus();
      if (initial === void 0) inp.select();
      var saving = false, finished = false;
      async function done(cancel) {
        if (saving || finished) return;
        var v = cancel ? old : inp.value;
        if (!cancel) {
          saving = true;
          inp.disabled = true;
          try {
            await saveCell(row, k, v);
          } catch (e) {
            inp.disabled = false;
            saving = false;
            inp.title = "저장 실패: " + s(e && e.message || e);
            inp.style.borderColor = "#df6671";
            toast(inp.title);
            return;
          }
        }
        finished = true;
        td.textContent = valueText(k, v);
        td.tabIndex = 0;
      }
      inp.onkeydown = function(e) {
        if (e.key === "Enter") {
          done(false);
          e.preventDefault();
        } else if (e.key === "Escape") {
          done(true);
          e.preventDefault();
        }
      };
      inp.onblur = function() {
        if (inp.isConnected) done(false);
      };
    }
    function render() {
      var qq = q.value.toLowerCase(), col = fc.value, val = fv.value.toLowerCase();
      filtered = data.filter(function(r) {
        if (col && val && s(r[col]).toLowerCase().indexOf(val) < 0) return false;
        if (!qq) return true;
        return cols.some(function(k) {
          return s(r[k]).toLowerCase().indexOf(qq) >= 0 || labelFor(k, tableId).toLowerCase().indexOf(qq) >= 0;
        });
      });
      tb.innerHTML = "";
      var lim = opt.limit || 1e3;
      filtered.slice(0, lim).forEach(function(r, ri) {
        var tr2 = E("tr"), ct = E("td"), ck = I("checkbox");
        ck.style.width = "auto";
        ck.checked = selectedRows.has(r);
        ck.onchange = function() {
          ck.checked ? selectedRows.add(r) : selectedRows.delete(r);
          tr2.classList.toggle("rsel", ck.checked);
        };
        ct.appendChild(ck);
        tr2.appendChild(ct);
        if (ck.checked) tr2.classList.add("rsel");
        cols.forEach(function(k, ci) {
          var td2 = E("td", "", valueText(k, r[k]));
          td2.title = s(r[k]);
          td2.tabIndex = 0;
          td2.dataset.ri = ri;
          td2.dataset.ci = ci;
          td2.onclick = function() {
            wrap.querySelectorAll(".gsel").forEach(function(z) {
              z.classList.remove("gsel");
            });
            td2.classList.add("gsel");
            selectedCell = { td: td2, row: r, k, ri, ci };
            td2.focus();
            if (opt.onCellSelected) opt.onCellSelected(r, k, td2);
          };
          td2.ondblclick = function() {
            if (opt.editable !== false) beginEdit(td2, r, k);
          };
          td2.onkeydown = function(e) {
            if (!selectedCell) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
              copySelection();
              e.preventDefault();
              return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
              pasteSelection();
              e.preventDefault();
              return;
            }
            var dr = 0, dc = 0;
            if (e.key === "ArrowUp") dr = -1;
            else if (e.key === "ArrowDown") dr = 1;
            else if (e.key === "ArrowLeft") dc = -1;
            else if (e.key === "ArrowRight") dc = 1;
            else if (e.key === "Enter" || e.key === "F2") {
              if (opt.editable !== false) beginEdit(td2, r, k);
              e.preventDefault();
              return;
            } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
              if (opt.editable !== false) beginEdit(td2, r, k, e.key);
              e.preventDefault();
              return;
            } else return;
            var nr = Math.max(0, Math.min(filtered.length - 1, ri + dr)), nc = Math.max(0, Math.min(cols.length - 1, ci + dc)), target = tb.querySelector("tr:nth-child(" + (nr + 1) + ") td:nth-child(" + (nc + 2) + ")");
            if (target) {
              target.click();
              target.focus();
            }
            e.preventDefault();
          };
          tr2.appendChild(td2);
        });
        tb.appendChild(tr2);
      });
      cnt.textContent = filtered.length + "행";
      if (!filtered.length) {
        var tr = E("tr");
        var td = E("td");
        td.colSpan = cols.length + 1;
        td.style.height = "330px";
        td.style.background = "repeating-linear-gradient(#fff 0,#fff 27px,#edf0f3 28px)";
        td.textContent = cols.length ? "" : "데이터 없음";
        tr.appendChild(td);
        tb.appendChild(tr);
      }
    }
    function copySelection() {
      var arr = selectedRows.size ? Array.from(selectedRows) : selectedCell ? [selectedCell.row] : [];
      if (!arr.length) return;
      var t = arr.map(function(r) {
        return cols.map(function(k) {
          return s(r[k]);
        }).join("	");
      }).join("\n");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(function() {
      });
    }
    async function pasteSelection() {
      if (!selectedCell || opt.editable === false) return;
      var startRi = selectedCell.ri, startCi = selectedCell.ci, targetRows = filtered.slice(), targetCols = cols.slice();
      var txt = "";
      try {
        txt = await navigator.clipboard.readText();
      } catch (e) {
        return;
      }
      var lines = txt.replace(/\r/g, "").split("\n");
      for (var r = 0; r < lines.length; r++) {
        var targetRow = targetRows[startRi + r];
        if (!targetRow) break;
        var cells = lines[r].split("	");
        for (var c = 0; c < cells.length; c++) {
          var k = targetCols[startCi + c];
          if (!k) break;
          try {
            await saveCell(targetRow, k, cells[c]);
          } catch (e) {
            render();
            var ri = filtered.indexOf(targetRow), ci = cols.indexOf(k);
            var td = ri < 0 || ci < 0 ? null : tb.querySelector("tr:nth-child(" + (ri + 1) + ") td:nth-child(" + (ci + 2) + ")");
            if (td) beginEdit(td, targetRow, k, cells[c]);
            toast("붙여넣기 저장 실패: " + s(e && e.message || e));
            return;
          }
        }
      }
      render();
    }
    q.oninput = render;
    fc.onchange = render;
    fv.oninput = render;
    allck.onchange = function() {
      filtered.forEach(function(r) {
        allck.checked ? selectedRows.add(r) : selectedRows.delete(r);
      });
      render();
    };
    render();
    return { refresh: render, getRows: function() {
      return data;
    }, getFiltered: function() {
      return filtered;
    }, getSelectedRows: function() {
      return Array.from(selectedRows);
    }, columns: cols, setData: function(x) {
      data = x || [];
      render();
    } };
  }
  var invokeNow = Date.now(), prev = parseInt(lsGet(UI_INVOKE_KEY, "0"), 10) || 0, isDouble = invokeNow - prev <= DOUBLE_MS;
  lsSet(UI_INVOKE_KEY, String(invokeNow));
  if (ROOT[NS] && ROOT[NS].alive && ROOT[NS].version !== BUILD && typeof ROOT[NS].terminate === "function") {
    try {
      await ROOT[NS].terminate();
    } catch (e) {
    }
  }
  if (ROOT[NS] && ROOT[NS].alive) {
    ROOT[NS].lastInvoke = invokeNow;
    if (isDouble) {
      ROOT[NS].resetPosition();
      ROOT[NS].expand();
      ROOT[NS].toast("기본 위치로 이동");
    } else ROOT[NS].expand();
    return;
  }
  var oldPanel = DOC.getElementById(PANEL_ID);
  if (oldPanel) oldPanel.remove();
  var oldBubble = DOC.getElementById(BUBBLE_ID);
  if (oldBubble) oldBubble.remove();
  var panel = E("div");
  panel.id = PANEL_ID;
  panel.setAttribute("data-g2bv4-ui", "1");
  panel.style.cssText = "position:fixed;width:340px;max-height:84vh;background:#191c22;color:#eef1f5;border:1px solid #373d47;border-radius:13px;box-shadow:0 18px 54px #0008;z-index:2147483646;display:flex;flex-direction:column;overflow:hidden";
  var inner = E("div");
  inner.id = "G2BV42_MAIN";
  inner.setAttribute("data-g2bv4-ui", "1");
  inner.style.cssText = 'display:flex;flex-direction:column;max-height:84vh;font:12px "Malgun Gothic",sans-serif;color:#eef1f5';
  panel.appendChild(inner);
  var phead = E("div");
  phead.style.cssText = "height:42px;display:flex;align-items:center;gap:7px;padding:0 8px;background:linear-gradient(180deg,#252a33,#1d2128);border-bottom:1px solid #333a45;cursor:move;user-select:none";
  var logo = E("div", "", "G2B");
  logo.style.cssText = "width:32px;height:24px;border-radius:7px;background:linear-gradient(135deg,#5c7cff,#7c5ce0);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px";
  var ptitle = E("b", "", "TOOLBOX V4.2");
  ptitle.style.cssText = "flex:1;font-size:11px;letter-spacing:.05em";
  var collapseBtn = B("—", "g2bv4-ghost"), exitBtn = B("종료", "g2bv4-danger");
  collapseBtn.style.cssText = "width:29px;height:26px;padding:0";
  exitBtn.style.cssText = "height:26px;padding:0 7px;font-size:10px";
  phead.appendChild(logo);
  phead.appendChild(ptitle);
  phead.appendChild(collapseBtn);
  phead.appendChild(exitBtn);
  inner.appendChild(phead);
  var pTabs = E("div");
  pTabs.style.cssText = "display:flex;border-bottom:1px solid #303640;background:#181b20;overflow-x:auto";
  inner.appendChild(pTabs);
  var pbody = E("div");
  pbody.style.cssText = "padding:8px;overflow:auto;flex:1;min-height:0";
  inner.appendChild(pbody);
  var sections = {}, tabBtns = {};
  [["work", "업무"], ["notes", "메모/일정"], ["launcher", "런처"], ["db", "DB"], ["collect", "수집"]].forEach(function(x) {
    var sec = E("div");
    sec.style.display = "none";
    sections[x[0]] = sec;
    pbody.appendChild(sec);
    var b = B(x[1]);
    b.style.cssText = "flex:1;min-width:58px;border:0;border-radius:0;background:transparent;color:#8993a2;padding:9px 3px;border-bottom:2px solid transparent";
    b.onclick = function() {
      showMainTab(x[0]);
    };
    tabBtns[x[0]] = b;
    if (x[0] !== "collect") pTabs.appendChild(b);
  });
  var activeMainTab = "";
  function showMainTab(id, force) {
    if (!sections[id]) id = "work";
    if (!force && activeMainTab === id && pbody.style.display !== "none") {
      pbody.style.display = "none";
      return;
    }
    pbody.style.display = "block";
    activeMainTab = id;
    Object.keys(sections).forEach(function(k) {
      sections[k].style.display = k === id ? "block" : "none";
      if (tabBtns[k]) {
        tabBtns[k].style.color = k === id ? "#fff" : "#8993a2";
        tabBtns[k].style.borderBottomColor = k === id ? "#708cff" : "transparent";
      }
    });
    lsSet(UI_TAB_KEY, id);
    if (dbPromise) putSetting("mainTab", id).catch(function() {
    });
    if (id === "notes") renderNotes();
    if (id === "launcher") renderLauncher();
    if (id === "db") {
      refreshDbMini();
      renderCollectionMini();
    }
    if (id === "collect") renderCollectionMini();
  }
  function initialPosition() {
    return { left: Math.max(8, ROOT.innerWidth - 356), top: 16 };
  }
  function loadPosition() {
    try {
      var p = JSON.parse(lsGet(UI_POS_KEY, ""));
      if (p && Number.isFinite(+p.left)) return p;
    } catch (e) {
    }
    return initialPosition();
  }
  function applyPosition(p) {
    var ml = Math.max(0, ROOT.innerWidth - panel.offsetWidth), mt = Math.max(0, ROOT.innerHeight - 55);
    panel.style.left = Math.min(ml, Math.max(0, +p.left || 0)) + "px";
    panel.style.top = Math.min(mt, Math.max(0, +p.top || 0)) + "px";
    panel.style.right = "auto";
  }
  function savePosition() {
    var r = panel.getBoundingClientRect(), p = { left: Math.round(r.left), top: Math.round(r.top) };
    lsSet(UI_POS_KEY, JSON.stringify(p));
    if (dbPromise) putSetting("mainPosition", p).catch(function() {
    });
  }
  function resetPosition() {
    var p = initialPosition();
    lsSet(UI_POS_KEY, JSON.stringify(p));
    if (dbPromise) putSetting("mainPosition", p).catch(function() {
    });
    applyPosition(p);
  }
  var pd = false, pdx = 0, pdy = 0;
  phead.onmousedown = function(e) {
    if (e.target.closest("button")) return;
    var r = panel.getBoundingClientRect();
    pd = true;
    pdx = e.clientX - r.left;
    pdy = e.clientY - r.top;
    e.preventDefault();
  };
  function pmm(e) {
    if (pd) applyPosition({ left: e.clientX - pdx, top: e.clientY - pdy });
  }
  function pmu() {
    if (pd) {
      pd = false;
      savePosition();
    }
  }
  DOC.addEventListener("mousemove", pmm);
  DOC.addEventListener("mouseup", pmu);
  DOC.body.appendChild(panel);
  applyPosition(loadPosition());
  var bubble = B("G2B");
  bubble.id = BUBBLE_ID;
  bubble.setAttribute("data-g2bv4-ui", "1");
  bubble.style.cssText = 'display:none;position:fixed;right:16px;bottom:16px;width:46px;height:46px;border-radius:50%;z-index:2147483646;border:1px solid #5c6e92;background:linear-gradient(135deg,#4f6fd6,#7655d5);color:#fff;font:800 10px "Malgun Gothic";box-shadow:0 10px 28px #0006';
  DOC.body.appendChild(bubble);
  function collapse() {
    savePosition();
    panel.style.display = "none";
    bubble.style.display = "block";
  }
  function expand() {
    bubble.style.display = "none";
    panel.style.display = "flex";
    applyPosition(loadPosition());
  }
  collapseBtn.onclick = collapse;
  bubble.onclick = expand;
  var work = sections.work;
  var quick = E("div", "g2bv4-grid2");
  quick.appendChild(B("−1년", "", function() {
    yearChange(-1);
  }));
  quick.appendChild(B("+1년", "", function() {
    yearChange(1);
  }));
  quick.appendChild(B("엑셀", "g2bv4-good", doExcel));
  quick.appendChild(B("조회", "g2bv4-primary", doSearch));
  work.appendChild(quick);
  var rcTitle = E("div", "g2bv4-sectionTitle", "조회 건수");
  work.appendChild(rcTitle);
  var rc = E("div", "g2bv4-row"), rcSel = Sel(["10", "30", "50", "100", "250", "500", "1000"].map(function(v) {
    return { value: v, label: v + "건" };
  })), rcManual = I("text", "직접"), rcApply = B("적용");
  rcSel.value = "100";
  rcSel.style.flex = "1";
  rcManual.style.width = "66px";
  rcApply.onclick = function() {
    applyRowCount(rcManual.value || rcSel.value);
  };
  rc.appendChild(rcSel);
  rc.appendChild(rcManual);
  rc.appendChild(rcApply);
  work.appendChild(rc);
  var cTitle = E("div", "g2bv4-sectionTitle", "수집");
  work.appendChild(cTitle);
  var cbox = E("div", "g2bv4-card");
  var crow = E("div", "g2bv4-grid3"), autoState = E("span", "g2bv4-badge"), autoBtn = B("시작", "g2bv4-good"), manualBtn = B("수집", "g2bv4-primary"), ext = B("추출");
  autoBtn.onclick = function() {
    collector.active ? autoStop() : autoStart();
  };
  manualBtn.onclick = manualCollect;
  crow.appendChild(autoBtn);
  crow.appendChild(manualBtn);
  crow.appendChild(ext);
  cbox.appendChild(crow);
  autoState.style.marginTop = "7px";
  cbox.appendChild(autoState);
  ext.onclick = openExtractWindow;
  work.appendChild(cbox);
  var wstatus = E("div", "g2bv4-mini");
  wstatus.style.marginTop = "7px";
  work.appendChild(wstatus);
  async function refreshCollectionStatus() {
    var caps = await dbAll(STORES.rawCaptures), evs = await dbAll(STORES.collectorEvents), rows = await dbAll(STORES.tableRows);
    autoState.textContent = collector.active ? "● 자동수집 중" : "■ 자동수집 중지";
    autoState.style.color = collector.active ? "#64d69d" : "#adb5c0";
    autoBtn.textContent = collector.active ? "종료" : "시작";
    autoBtn.className = collector.active ? "g2bv4-danger" : "g2bv4-good";
    wstatus.textContent = "RAW " + caps.filter(function(x) {
      return x.eventType === "SNAPSHOT";
    }).length + " · 이벤트 " + evs.length + " · DB " + rows.length + "행";
  }
  var notesSec = sections.notes, noteTop = E("div", "g2bv4-tabbar"), noteArea = E("div"), noteSearch = I("search", "검색"), noteSort = Sel([{ value: "createdDesc", label: "생성일 최신" }, { value: "createdAsc", label: "생성일 오래된순" }, { value: "dueAsc", label: "기준일순" }, { value: "titleAsc", label: "제목순" }]);
  var noteMode = "all";
  [["all", "전체"], ["general", "일반메모"], ["screen", "화면메모"], ["schedule", "일정"]].forEach(function(x) {
    var b = B(x[1]);
    b.dataset.mode = x[0];
    b.onclick = function() {
      noteMode = x[0];
      renderNotes();
    };
    noteTop.appendChild(b);
  });
  var noteDetailBtn = B("상세");
  noteTop.appendChild(noteDetailBtn);
  notesSec.appendChild(noteTop);
  var nsr = E("div", "g2bv4-toolbar");
  nsr.style.marginTop = "7px";
  noteSearch.style.flex = "1";
  noteSort.style.width = "112px";
  var noteSearchBtn = B("검색");
  nsr.appendChild(noteSearch);
  nsr.appendChild(noteSearchBtn);
  nsr.appendChild(noteSort);
  notesSec.appendChild(nsr);
  var noteAdd = E("div", "g2bv4-grid2");
  noteAdd.appendChild(B("+ 메모", "g2bv4-primary", function() {
    createNote(noteMode === "screen" ? "screen" : "general").then(renderNotes);
  }));
  noteAdd.appendChild(B("+ 일정", "g2bv4-good", function() {
    editNoteDialog(null, "schedule", renderNotes);
  }));
  notesSec.appendChild(noteAdd);
  notesSec.appendChild(noteArea);
  noteSearchBtn.onclick = renderNotes;
  noteSearch.onkeydown = function(e) {
    if (e.key === "Enter") renderNotes();
  };
  noteSort.onchange = renderNotes;
  noteDetailBtn.onclick = function() {
    if (noteMode === "schedule") openCalendarWindow();
    else openNoteManager(noteMode);
  };
  function sortNotes(arr) {
    var v = noteSort.value;
    return arr.sort(function(a, b) {
      if ((b.pinned || 0) !== (a.pinned || 0)) return (b.pinned || 0) - (a.pinned || 0);
      if (v === "createdAsc") return s(a.createdAt).localeCompare(s(b.createdAt));
      if (v === "dueAsc") return s(a.dueAt || "9999").localeCompare(s(b.dueAt || "9999"));
      if (v === "titleAsc") return noteTitle(a).localeCompare(noteTitle(b), "ko");
      return s(b.createdAt).localeCompare(s(a.createdAt));
    });
  }
  function noteFilter(n, si, q) {
    if (n.deletedAt) return false;
    if (noteMode === "general" && n.kind !== "general") return false;
    if (noteMode === "screen" && n.kind !== "screen") return false;
    if (noteMode === "schedule" && n.kind !== "schedule") return false;
    if (n.kind === "screen" && !noteMatchesScreen(n, si)) return false;
    if (!q) return true;
    return JSON.stringify([n.title, n.content, n.tags, n.mentions, n.bangs, n.group]).toLowerCase().indexOf(q) >= 0;
  }
  function colorHex(n) {
    return NOTE_COLORS[n.color] || NOTE_COLORS.yellow;
  }
  function renderNoteCard(n, prefix) {
    var card = E("div", "g2bv4-note");
    card.style.background = colorHex(n);
    var top = E("div", "g2bv4-row"), left = E("div", "g2bv4-row"), act = E("div", "g2bv4-note-actions");
    left.style.flex = "1";
    if (prefix && noteMode === "all") {
      var px = E("span", "g2bv4-mini", notePrefix(n));
      px.style.color = "#625a3d";
      left.appendChild(px);
    }
    var title = I("text"), addTitle = B("+ 제목");
    title.value = n.title || "";
    title.style.flex = "1";
    title.style.display = n.title ? "block" : "none";
    addTitle.style.cssText = "padding:2px 5px!important;font-size:10px;background:transparent!important;color:#625a3d!important;border:0!important";
    addTitle.style.display = n.title ? "none" : "block";
    addTitle.onclick = function() {
      addTitle.style.display = "none";
      title.style.display = "block";
      title.focus();
    };
    title.onblur = function() {
      n.title = title.value.trim();
      saveNote(n);
      if (!n.title) {
        title.style.display = "none";
        addTitle.style.display = "block";
      }
    };
    left.appendChild(title);
    left.appendChild(addTitle);
    var important = B(n.important ? "★" : "☆"), pin = B(n.pinned ? "📌" : "⌖"), stick = B("▣"), color = B("●"), trash = B("🗑");
    important.title = "중요";
    pin.title = "상단 고정";
    stick.title = "스티커";
    color.title = "색상";
    trash.title = "휴지통";
    important.onclick = function() {
      n.important = n.important ? 0 : 1;
      saveNote(n).then(renderNotes);
    };
    pin.onclick = function() {
      n.pinned = n.pinned ? 0 : 1;
      saveNote(n).then(renderNotes);
    };
    stick.onclick = function() {
      openSticky(n);
    };
    color.onclick = function() {
      openColorPicker(n, color, function() {
        card.style.background = colorHex(n);
      });
    };
    trash.onclick = function() {
      if (confirm("휴지통으로 이동할까요?")) trashNote(n).then(renderNotes);
    };
    act.appendChild(important);
    act.appendChild(pin);
    act.appendChild(stick);
    if (n.kind === "screen") {
      var ruleBtn = B("⚙");
      ruleBtn.title = "화면조건";
      ruleBtn.onclick = function() {
        editScreenRule(n, renderNotes);
      };
      act.appendChild(ruleBtn);
    }
    act.appendChild(color);
    act.appendChild(trash);
    top.appendChild(left);
    top.appendChild(act);
    card.appendChild(top);
    var body = E("textarea");
    body.value = n.content || "";
    var tm = null;
    body.oninput = function() {
      clearTimeout(tm);
      tm = setTimeout(function() {
        n.content = body.value;
        saveNote(n);
      }, 250);
    };
    card.appendChild(body);
    var meta = E("div", "g2bv4-mini");
    meta.style.cssText = "color:#665f45;text-align:right;margin-top:3px";
    meta.textContent = (n.kind === "schedule" && n.dueAt ? "기준 " + formatDateTime(n.dueAt) + " · " : "") + "생성 " + formatDateTime(n.createdAt);
    card.appendChild(meta);
    if (n.kind === "schedule") card.ondblclick = function(e) {
      if (e.target.closest("button,input,textarea")) return;
      editNoteDialog(n, "schedule", renderNotes);
    };
    return card;
  }
  async function renderNotes() {
    Array.from(noteTop.children).forEach(function(b) {
      b.classList.toggle("active", b.dataset.mode === noteMode);
    });
    var si = screenInfo(), q = noteSearch.value.trim().toLowerCase(), arr = sortNotes((await activeNotes()).filter(function(n) {
      return noteFilter(n, si, q);
    }));
    noteArea.innerHTML = "";
    if (noteMode === "schedule") {
      return renderScheduleGroups(arr.filter(function(n) {
        return n.kind === "schedule";
      }));
    }
    if (!arr.length) {
      var empty = E("div", "g2bv4-mini", "표시할 메모가 없습니다.");
      empty.style.padding = "18px 4px";
      noteArea.appendChild(empty);
      return;
    }
    arr.forEach(function(n) {
      noteArea.appendChild(renderNoteCard(n, true));
    });
  }
  function formatDateTime(v) {
    if (!v) return "";
    var d = new Date(v);
    if (isNaN(d.getTime())) return s(v);
    return d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function localDateKey(d) {
    d = d || /* @__PURE__ */ new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  function weekBounds(d) {
    var x = new Date(d), day = (x.getDay() + 6) % 7;
    x.setHours(0, 0, 0, 0);
    var a = new Date(x);
    a.setDate(x.getDate() - day);
    var b = new Date(a);
    b.setDate(a.getDate() + 7);
    return [a, b];
  }
  function scheduleGroup(n) {
    if (!n.dueAt) return "미지정";
    var d = new Date(n.dueAt), now = /* @__PURE__ */ new Date(), dk = localDateKey(d), nk = localDateKey(now);
    if (dk === nk) return "오늘";
    var w = weekBounds(now);
    if (d >= w[0] && d < w[1]) return "이번주";
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "이번달";
    return "그 외";
  }
  async function renderScheduleGroups(arr) {
    noteArea.innerHTML = "";
    var hidden = await getSetting("scheduleGroupHidden", {}), groups = { "미지정": [], "오늘": [], "이번주": [], "이번달": [], "그 외": [] };
    arr.forEach(function(n) {
      groups[scheduleGroup(n)].push(n);
    });
    Object.keys(groups).forEach(function(g) {
      var box = E("div", "g2bv4-listgroup"), head = B((hidden[g] ? "▶ " : "▼ ") + g + " · " + groups[g].length);
      head.onclick = function() {
        hidden[g] = !hidden[g];
        putSetting("scheduleGroupHidden", hidden);
        renderNotes();
      };
      box.appendChild(head);
      if (!hidden[g]) groups[g].forEach(function(n) {
        box.appendChild(renderNoteCard(n, false));
      });
      noteArea.appendChild(box);
    });
  }
  function openColorPicker(n, anchor, done) {
    var p = E("div");
    p.setAttribute("data-g2bv4-ui", "1");
    var r = anchor.getBoundingClientRect();
    p.style.cssText = "position:fixed;z-index:2147483647;left:" + Math.max(5, r.left - 120) + "px;top:" + (r.bottom + 3) + "px;background:#fff;border:1px solid #bbb;border-radius:8px;padding:6px;display:flex;gap:5px;box-shadow:0 7px 20px #0004";
    Object.keys(NOTE_COLORS).forEach(function(k) {
      var b = B("", "g2bv4-color");
      b.style.background = NOTE_COLORS[k];
      b.onclick = function() {
        n.color = k;
        saveNote(n);
        p.remove();
        if (done) done();
      };
      p.appendChild(b);
    });
    DOC.body.appendChild(p);
    setTimeout(function() {
      DOC.addEventListener("mousedown", function h(e) {
        if (!p.contains(e.target)) {
          p.remove();
          DOC.removeEventListener("mousedown", h);
        }
      }, true);
    }, 0);
  }
  var stickyMap = /* @__PURE__ */ new Map();
  function openSticky(n) {
    var existing = stickyMap.get(n.id);
    if (existing && existing.isConnected) {
      existing.style.display = "block";
      return;
    }
    var st = E("div", "g2bv4-stick");
    st.setAttribute("data-g2bv4-ui", "1");
    st.style.background = colorHex(n);
    var pos = spawnNearPanel("300px", "190px", 18);
    st.style.left = pos.left + "px";
    st.style.top = pos.top + "px";
    st.style.width = "300px";
    st.style.height = "190px";
    var bar = E("div", "g2bv4-stickbar"), tit = E("b", "", noteTitle(n)), tog = B("▣"), x = B("×");
    bar.appendChild(tit);
    bar.appendChild(tog);
    bar.appendChild(x);
    var cont = E("div", "", n.content || "");
    cont.style.cssText = "white-space:pre-wrap;margin-top:7px;font-size:12px";
    st.appendChild(bar);
    st.appendChild(cont);
    DOC.body.appendChild(st);
    stickyMap.set(n.id, st);
    getSetting("sticky:" + n.id, null).then(function(p) {
      if (!p || !st.isConnected) return;
      if (p.left) st.style.left = p.left;
      if (p.top) st.style.top = p.top;
      if (p.width) st.style.width = p.width;
      if (p.height) st.style.height = p.height;
      if (p.min) st.classList.add("min");
    });
    function save() {
      putSetting("sticky:" + n.id, { left: st.style.left, top: st.style.top, width: st.style.width, height: st.style.height, min: st.classList.contains("min") });
    }
    var undo = makeMovable(st, bar, save), ro;
    try {
      ro = new ResizeObserver(save);
      ro.observe(st);
    } catch (q) {
    }
    tog.onclick = function() {
      st.classList.toggle("min");
      save();
    };
    x.onclick = function() {
      undo();
      try {
        ro && ro.disconnect();
      } catch (q) {
      }
      st.remove();
      stickyMap.delete(n.id);
    };
  }
  function ruleEditorBody(rule, body) {
    rule = Object.assign({ url: normalizedUrl(), urlMode: "path", useAreaCd: false, areaCd: "", useDepth1: false, depth1: "", useDepth2: false, depth2: "", useDepth3: false, depth3: "" }, rule || {});
    var ctx = screenInfo(), url = I("text"), mode = Sel([{ value: "path", label: "URL 경로 기준" }, { value: "exact", label: "전체 URL 정확히" }]);
    url.value = rule.url || ctx.url;
    mode.value = rule.urlMode || "path";
    body.appendChild(E("div", "g2bv4-mini", "URL"));
    body.appendChild(url);
    body.appendChild(mode);
    var rows = {};
    [["areaCd", "areaCd"], ["depth1", "depth1"], ["depth2", "depth2"], ["depth3", "depth3"]].forEach(function(x) {
      var r = E("div", "g2bv4-row"), ck = I("checkbox"), inp = I("text", x[1]);
      ck.style.width = "auto";
      ck.checked = !!rule["use" + x[0][0].toUpperCase() + x[0].slice(1)];
      inp.value = rule[x[0]] || ctx[x[0]] || "";
      r.appendChild(ck);
      r.appendChild(E("span", "g2bv4-mini", x[1]));
      r.appendChild(inp);
      body.appendChild(r);
      rows[x[0]] = { ck, inp };
    });
    return function() {
      return { url: url.value.trim(), urlMode: mode.value, useAreaCd: rows.areaCd.ck.checked, areaCd: rows.areaCd.inp.value.trim(), useDepth1: rows.depth1.ck.checked, depth1: rows.depth1.inp.value.trim(), useDepth2: rows.depth2.ck.checked, depth2: rows.depth2.inp.value.trim(), useDepth3: rows.depth3.ck.checked, depth3: rows.depth3.inp.value.trim() };
    };
  }
  function editScreenRule(n, done) {
    var w = openWindow("화면 출력 조건", { width: "470px", height: "470px" }), get = ruleEditorBody(n.screenRule, w.body), foot = E("div", "g2bv4-toolbar"), save = B("저장", "g2bv4-primary");
    save.onclick = function() {
      n.screenRule = get();
      saveNote(n).then(function() {
        w.close();
        if (done) done();
      });
    };
    foot.appendChild(save);
    w.body.appendChild(foot);
  }
  async function editNoteDialog(n, kind, done) {
    var isNew = !n;
    if (!n) n = { id: uid("note"), kind: kind || "general", title: "", content: "", createdAt: nowIso(), updatedAt: nowIso(), color: "yellow", important: 0, pinned: 0, group: "", dueAt: "", deletedAt: null, screenRule: kind === "screen" ? defaultScreenRule(screenInfo()) : null, extra: {} };
    var w = openWindow((isNew ? "추가" : "수정") + " · " + (n.kind === "schedule" ? "일정" : "메모"), { width: "480px", height: n.kind === "screen" ? "610px" : "480px" }), title = I("text", "제목 (선택)"), content = E("textarea"), group = I("text", "그룹"), due = I("datetime-local");
    title.value = n.title || "";
    content.value = n.content || "";
    content.style.cssText = "width:100%;height:150px;resize:vertical";
    group.value = n.group || "";
    w.body.appendChild(title);
    w.body.appendChild(content);
    w.body.appendChild(E("div", "g2bv4-mini", "그룹"));
    w.body.appendChild(group);
    if (n.kind === "schedule") {
      w.body.appendChild(E("div", "g2bv4-mini", "기준일시"));
      if (n.dueAt) {
        var d = new Date(n.dueAt);
        if (!isNaN(d.getTime())) due.value = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
      }
      w.body.appendChild(due);
    }
    var getRule = null;
    if (n.kind === "screen") {
      w.body.appendChild(E("div", "g2bv4-mini", "현재 화면 출력 조건"));
      getRule = ruleEditorBody(n.screenRule, w.body);
    }
    var colors = E("div", "g2bv4-toolbar");
    Object.keys(NOTE_COLORS).forEach(function(k) {
      var b = B("", "g2bv4-color");
      b.style.background = NOTE_COLORS[k];
      b.title = k;
      b.onclick = function() {
        n.color = k;
      };
      colors.appendChild(b);
    });
    w.body.appendChild(colors);
    var save = B("저장", "g2bv4-primary");
    save.onclick = async function() {
      n.title = title.value;
      n.content = content.value;
      n.group = group.value;
      if (n.kind === "schedule") n.dueAt = due.value ? new Date(due.value).toISOString() : "";
      if (getRule) n.screenRule = getRule();
      await saveNote(n);
      w.close();
      if (done) done();
    };
    w.body.appendChild(save);
  }
  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function addDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function addMonths(d, n) {
    var x = new Date(d);
    x.setMonth(x.getMonth() + n);
    return x;
  }
  function addYears(d, n) {
    var x = new Date(d);
    x.setFullYear(x.getFullYear() + n);
    return x;
  }
  function sameDay(a, b) {
    return localDateKey(a) === localDateKey(b);
  }
  function calendarLabel(view, d) {
    if (view === "month") return d.getFullYear() + "년 " + (d.getMonth() + 1) + "월";
    if (view === "week") {
      var w = weekBounds(d);
      return formatDateTime(w[0]).slice(0, 10) + " ~ " + formatDateTime(addDays(w[1], -1)).slice(0, 10);
    }
    return formatDateTime(d).slice(0, 10);
  }
  async function schedulesAll() {
    return (await activeNotes()).filter(function(n) {
      return n.kind === "schedule";
    });
  }
  function openDateJump(ctrl, rerender) {
    var w = openWindow("날짜 이동", { width: "360px", height: "250px" }), day = Sel([]), mon = Sel([]), yr = Sel([]), d = ctrl.anchor;
    for (var i = 1; i <= 31; i++) {
      var o = E("option");
      o.value = i;
      o.textContent = i + "일";
      day.appendChild(o);
    }
    for (var m = 1; m <= 12; m++) {
      var p = E("option");
      p.value = m;
      p.textContent = m + "월";
      mon.appendChild(p);
    }
    for (var y = d.getFullYear() - 10; y <= d.getFullYear() + 10; y++) {
      var q = E("option");
      q.value = y;
      q.textContent = y + "년";
      yr.appendChild(q);
    }
    day.value = d.getDate();
    mon.value = d.getMonth() + 1;
    yr.value = d.getFullYear();
    w.body.appendChild(day);
    w.body.appendChild(mon);
    w.body.appendChild(yr);
    w.body.appendChild(B("이동", "g2bv4-primary", function() {
      ctrl.anchor = new Date(+yr.value, +mon.value - 1, +day.value);
      w.close();
      rerender();
    }));
  }
  async function renderCalendarObject(host, ctrl) {
    host.innerHTML = "";
    var top = E("div", "g2bv4-toolbar"), month = B("달력"), week = B("주간"), day = B("일간"), farPrev = B("≪"), prev2 = B("‹"), today = B("오늘"), dateB = B(calendarLabel(ctrl.view, ctrl.anchor)), next = B("›"), farNext = B("≫"), multi = B(ctrl.multi ? "다중선택 ON" : "다중선택");
    [["month", month], ["week", week], ["day", day]].forEach(function(x) {
      x[1].classList.toggle("active", ctrl.view === x[0]);
      x[1].onclick = function() {
        ctrl.view = x[0];
        renderCalendarObject(host, ctrl);
      };
    });
    farPrev.onclick = function() {
      ctrl.anchor = ctrl.view === "month" ? addYears(ctrl.anchor, -1) : ctrl.view === "week" ? addMonths(ctrl.anchor, -1) : addDays(ctrl.anchor, -7);
      renderCalendarObject(host, ctrl);
    };
    prev2.onclick = function() {
      ctrl.anchor = ctrl.view === "month" ? addMonths(ctrl.anchor, -1) : ctrl.view === "week" ? addDays(ctrl.anchor, -7) : addDays(ctrl.anchor, -1);
      renderCalendarObject(host, ctrl);
    };
    next.onclick = function() {
      ctrl.anchor = ctrl.view === "month" ? addMonths(ctrl.anchor, 1) : ctrl.view === "week" ? addDays(ctrl.anchor, 7) : addDays(ctrl.anchor, 1);
      renderCalendarObject(host, ctrl);
    };
    farNext.onclick = function() {
      ctrl.anchor = ctrl.view === "month" ? addYears(ctrl.anchor, 1) : ctrl.view === "week" ? addMonths(ctrl.anchor, 1) : addDays(ctrl.anchor, 7);
      renderCalendarObject(host, ctrl);
    };
    today.onclick = function() {
      ctrl.anchor = /* @__PURE__ */ new Date();
      renderCalendarObject(host, ctrl);
    };
    dateB.onclick = function() {
      openDateJump(ctrl, function() {
        renderCalendarObject(host, ctrl);
      });
    };
    multi.onclick = function() {
      ctrl.multi = !ctrl.multi;
      if (!ctrl.multi) ctrl.selected.clear();
      renderCalendarObject(host, ctrl);
    };
    top.appendChild(month);
    top.appendChild(week);
    top.appendChild(day);
    top.appendChild(farPrev);
    top.appendChild(prev2);
    top.appendChild(today);
    top.appendChild(dateB);
    top.appendChild(next);
    top.appendChild(farNext);
    top.appendChild(multi);
    host.appendChild(top);
    var schedules = await schedulesAll(), main = E("div");
    host.appendChild(main);
    function eventsFor(d2) {
      return schedules.filter(function(n) {
        return n.dueAt && sameDay(new Date(n.dueAt), d2);
      });
    }
    function clickDate(d2) {
      if (ctrl.multi) {
        var k = localDateKey(d2);
        ctrl.selected.has(k) ? ctrl.selected.delete(k) : ctrl.selected.add(k);
        renderCalendarObject(host, ctrl);
      } else {
        ctrl.anchor = new Date(d2);
        ctrl.view = "day";
        renderCalendarObject(host, ctrl);
      }
    }
    if (ctrl.view === "month") {
      var hd = E("div");
      hd.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-weight:700;color:#68717d";
      ["월", "화", "수", "목", "금", "토", "일"].forEach(function(x) {
        hd.appendChild(E("div", "", x));
      });
      main.appendChild(hd);
      var grid = E("div", "g2bv4-cal"), first = startOfMonth(ctrl.anchor), offset = (first.getDay() + 6) % 7, start = addDays(first, -offset);
      for (var i = 0; i < 42; i++) {
        var d = addDays(start, i), cell = E("div", "g2bv4-day" + (d.getMonth() !== ctrl.anchor.getMonth() ? " other" : "")), dn = E("div", "", String(d.getDate()));
        if (ctrl.selected.has(localDateKey(d))) cell.classList.add("sel");
        dn.style.cursor = "pointer";
        dn.onclick = /* @__PURE__ */ (function(dd) {
          return function() {
            clickDate(dd);
          };
        })(d);
        cell.appendChild(dn);
        eventsFor(d).slice(0, 4).forEach(function(n) {
          var ev = E("div", "g2bv4-event", noteTitle(n));
          ev.style.background = colorHex(n);
          ev.onclick = function(e) {
            e.stopPropagation();
            editNoteDialog(n, "schedule", function() {
              renderCalendarObject(host, ctrl);
            });
          };
          cell.appendChild(ev);
        });
        grid.appendChild(cell);
      }
      main.appendChild(grid);
    } else if (ctrl.view === "week") {
      var wb = weekBounds(ctrl.anchor), grid = E("div");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));gap:4px;overflow:auto";
      for (var j = 0; j < 7; j++) {
        var d = addDays(wb[0], j), c = E("div", "g2bv4-card"), h = E("b", "", pad2(d.getMonth() + 1) + "/" + pad2(d.getDate()));
        h.style.cursor = "pointer";
        h.onclick = /* @__PURE__ */ (function(dd) {
          return function() {
            clickDate(dd);
          };
        })(d);
        c.appendChild(h);
        eventsFor(d).forEach(function(n) {
          var ev = E("div", "g2bv4-event", formatDateTime(n.dueAt).slice(11) + " " + noteTitle(n));
          ev.style.background = colorHex(n);
          ev.onclick = function() {
            editNoteDialog(n, "schedule", function() {
              renderCalendarObject(host, ctrl);
            });
          };
          c.appendChild(ev);
        });
        grid.appendChild(c);
      }
      main.appendChild(grid);
    } else {
      var list = eventsFor(ctrl.anchor).sort(function(a, b) {
        return s(a.dueAt).localeCompare(s(b.dueAt));
      });
      var h = E("div", "g2bv4-card");
      h.appendChild(E("b", "", calendarLabel("day", ctrl.anchor)));
      if (!list.length) h.appendChild(E("div", "g2bv4-mini", "일정이 없습니다."));
      list.forEach(function(n) {
        var e = E("div", "g2bv4-event", formatDateTime(n.dueAt).slice(11) + " · " + noteTitle(n));
        e.style.background = colorHex(n);
        e.onclick = function() {
          editNoteDialog(n, "schedule", function() {
            renderCalendarObject(host, ctrl);
          });
        };
        h.appendChild(e);
      });
      main.appendChild(h);
    }
    if (ctrl.multi && ctrl.selected.size) {
      var add = B("선택 " + ctrl.selected.size + "일에 일정 입력", "g2bv4-primary");
      add.onclick = function() {
        var title = prompt("제목");
        if (title === null) return;
        var content = prompt("내용", "") || "";
        Promise.all(Array.from(ctrl.selected).map(function(k) {
          return createNote("schedule", { title, content, dueAt: (/* @__PURE__ */ new Date(k + "T09:00:00")).toISOString() });
        })).then(function() {
          ctrl.selected.clear();
          renderCalendarObject(host, ctrl);
        });
      };
      host.appendChild(add);
    }
    var searchBox = E("div", "g2bv4-toolbar"), q = I("search", "일정 검색"), sb = B("검색"), res = E("div");
    searchBox.appendChild(q);
    searchBox.appendChild(sb);
    host.appendChild(searchBox);
    host.appendChild(res);
    sb.onclick = function() {
      var z = q.value.trim().toLowerCase();
      res.innerHTML = "";
      schedules.filter(function(n) {
        return !z || JSON.stringify([n.title, n.content, n.tags, n.group]).toLowerCase().indexOf(z) >= 0;
      }).slice(0, 100).forEach(function(n) {
        var b = B((n.dueAt ? formatDateTime(n.dueAt) + " · " : "") + noteTitle(n));
        b.style.cssText = "width:100%;text-align:left;margin:2px 0";
        b.onclick = function() {
          if (n.dueAt) ctrl.anchor = new Date(n.dueAt);
          ctrl.view = "day";
          renderCalendarObject(host, ctrl);
        };
        res.appendChild(b);
      });
    };
  }
  function openCalendarWindow() {
    var w = openWindow("일정보기", { width: "1040px", height: "690px", persistKey: "calendar", instanceKey: "calendar" }), ctrl = { view: "month", anchor: /* @__PURE__ */ new Date(), multi: false, selected: /* @__PURE__ */ new Set() };
    renderCalendarObject(w.body, ctrl);
  }
  async function openNoteManager(initialMode) {
    var w = openWindow("메모/일정 상세", { width: "1050px", height: "650px", persistKey: "noteManager", instanceKey: "noteManager" }), mode = initialMode === "general" || initialMode === "screen" || initialMode === "schedule" ? initialMode : "all", area = E("div"), tabs = E("div", "g2bv4-tabbar"), search = I("search", "검색"), filter = Sel([{ value: "", label: "전체 그룹" }]), cols = await getSetting("noteManagerColumns", ["kind", "title", "createdAt", "updatedAt", "group", "important", "tags", "dueAt"]);
    [["all", "전체"], ["general", "일반메모"], ["screen", "화면메모"], ["schedule", "일정"], ["calendar", "달력보기"]].forEach(function(x) {
      var b = B(x[1]);
      b.dataset.mode = x[0];
      b.onclick = function() {
        mode = x[0];
        draw();
      };
      tabs.appendChild(b);
    });
    w.body.appendChild(tabs);
    var tools = E("div", "g2bv4-toolbar");
    tools.appendChild(search);
    tools.appendChild(filter);
    tools.appendChild(B("열 설정", "", function() {
      noteColumnDialog(cols, function(nc) {
        cols = nc;
        draw();
      });
    }));
    w.body.appendChild(tools);
    var split = E("div");
    split.style.cssText = "display:grid;grid-template-rows:minmax(260px,1fr) minmax(145px,220px);gap:8px;height:calc(100% - 78px)";
    var gridArea = E("div"), detail = E("div", "g2bv4-card");
    detail.innerHTML = '<div class="g2bv4-mini">행을 선택하면 상세내용을 표시합니다.</div>';
    split.appendChild(gridArea);
    split.appendChild(detail);
    w.body.appendChild(split);
    var ns = await activeNotes(), groups = Array.from(new Set(ns.map(function(n) {
      return n.group;
    }).filter(Boolean)));
    groups.forEach(function(g) {
      var o = E("option");
      o.value = g;
      o.textContent = g;
      filter.appendChild(o);
    });
    search.oninput = draw;
    filter.onchange = draw;
    function showDetail(n) {
      detail.innerHTML = "";
      if (!n) {
        detail.appendChild(E("div", "g2bv4-mini", "선택된 항목이 없습니다."));
        return;
      }
      var hd = E("div", "g2bv4-row"), title = E("b", "", notePrefix(n) + " " + noteTitle(n)), edit = B("편집");
      title.style.flex = "1";
      edit.onclick = function() {
        editNoteDialog(n, n.kind, function() {
          draw();
          renderNotes();
        });
      };
      hd.appendChild(title);
      hd.appendChild(edit);
      detail.appendChild(hd);
      var meta = E("div", "g2bv4-mini", (n.dueAt ? "기준 " + formatDateTime(n.dueAt) + " · " : "") + "생성 " + formatDateTime(n.createdAt) + " · 수정 " + formatDateTime(n.updatedAt));
      meta.style.margin = "5px 0";
      detail.appendChild(meta);
      var txt = E("div", "", n.content || "");
      txt.style.cssText = "white-space:pre-wrap;overflow:auto;max-height:145px";
      detail.appendChild(txt);
    }
    async function draw() {
      Array.from(tabs.children).forEach(function(b) {
        b.classList.toggle("active", b.dataset.mode === mode);
      });
      gridArea.innerHTML = "";
      if (mode === "calendar") {
        split.style.gridTemplateRows = "1fr 0";
        detail.style.display = "none";
        return renderCalendarObject(gridArea, { view: "month", anchor: /* @__PURE__ */ new Date(), multi: false, selected: /* @__PURE__ */ new Set() });
      }
      detail.style.display = "block";
      split.style.gridTemplateRows = "minmax(260px,1fr) minmax(145px,220px)";
      var q = search.value.toLowerCase(), arr = (await activeNotes()).filter(function(n) {
        if (mode === "general" && n.kind !== "general") return false;
        if (mode === "screen" && n.kind !== "screen") return false;
        if (mode === "schedule" && n.kind !== "schedule") return false;
        if (filter.value && n.group !== filter.value) return false;
        return !q || JSON.stringify(n).toLowerCase().indexOf(q) >= 0;
      }), byId = {};
      var rows = arr.map(function(n) {
        byId[n.id] = n;
        var r = { __id: n.id, kind: n.kind === "general" ? "일반" : n.kind === "screen" ? "화면" : "일정", title: noteTitle(n), createdAt: formatDateTime(n.createdAt), updatedAt: formatDateTime(n.updatedAt), group: n.group || "", important: n.important ? "★" : "", tags: (n.tags || []).join(", "), dueAt: formatDateTime(n.dueAt) };
        Object.keys(n.extra || {}).forEach(function(k) {
          r[k] = n.extra[k];
        });
        return r;
      });
      SmartGrid(gridArea, rows, { columns: cols.filter(function(k) {
        return k !== "__id";
      }), height: "310px", editable: false, onCellSelected: function(r) {
        showDetail(byId[r.__id]);
      } });
      if (arr.length) showDetail(arr[0]);
      else showDetail(null);
    }
    draw();
  }
  function noteColumnDialog(cols, done) {
    var w = openWindow("관리자 열 설정", { width: "420px", height: "460px" }), list = cols.slice();
    function draw() {
      w.body.innerHTML = "";
      list.forEach(function(k, i) {
        var r = E("div", "g2bv4-row"), inp = I("text");
        inp.value = k;
        inp.onchange = function() {
          list[i] = inp.value.trim();
        };
        r.appendChild(inp);
        r.appendChild(B("삭제", "", function() {
          list.splice(i, 1);
          draw();
        }));
        w.body.appendChild(r);
      });
      w.body.appendChild(B("+ 열 추가", "", function() {
        list.push("custom" + (list.length + 1));
        draw();
      }));
      w.body.appendChild(B("저장", "g2bv4-primary", function() {
        putSetting("noteManagerColumns", list).then(function() {
          w.close();
          done(list);
        });
      }));
    }
    draw();
  }
  var launchSec = sections.launcher, launchGrid = E("div");
  launchGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px";
  launchSec.appendChild(launchGrid);
  var addLaunch = B("+ 런처 추가", "g2bv4-primary", function() {
    editLauncher(null);
  });
  addLaunch.style.width = "100%";
  addLaunch.style.marginTop = "7px";
  launchSec.appendChild(addLaunch);
  function launcherMatches(x, si) {
    if (!x.screenRule) return true;
    return screenRuleMatches(x.screenRule, si);
  }
  async function renderLauncher() {
    var arr = await dbAll(STORES.launcherScripts), si = screenInfo();
    arr.sort(function(a, b) {
      return (+a.sortOrder || 0) - (+b.sortOrder || 0);
    });
    launchGrid.innerHTML = "";
    arr.filter(function(x) {
      return launcherMatches(x, si);
    }).forEach(function(x) {
      var wrap = E("div");
      wrap.style.position = "relative";
      var b = B(x.name || "스크립트");
      b.style.cssText = "width:100%;min-height:52px;text-align:left;padding-right:28px";
      var sm = E("div", "g2bv4-mini", x.description || "");
      b.appendChild(sm);
      b.onclick = function() {
        try {
          var fn = new Function("WS", "ROOT", "DOC", "WIN", x.code || "");
          var c = (function() {
            try {
              return ROOT["WebSquare"];
            } catch (e) {
              return window["WebSquare"];
            }
          })();
          fn(c, ROOT, getWindows()[0] && getWindows()[0].d || DOC, getWindows()[0] && getWindows()[0].w || ROOT);
        } catch (e) {
          alert("런처 실행 오류: " + e.message);
        }
      };
      var edit = B("⋮");
      edit.style.cssText = "position:absolute;right:3px;top:3px;width:23px;height:23px;padding:0";
      edit.onclick = function(e) {
        e.stopPropagation();
        editLauncher(x);
      };
      wrap.appendChild(b);
      wrap.appendChild(edit);
      launchGrid.appendChild(wrap);
    });
  }
  function editLauncher(rec) {
    rec = rec || { id: uid("script"), name: "", description: "", code: "", sortOrder: 100, screenRule: null, createdAt: nowIso() };
    var w = openWindow(rec.name ? "런처 수정" : "런처 추가", { width: "560px", height: "590px" }), name = I("text", "이름"), desc = I("text", "설명"), order = I("number", "정렬"), code = E("textarea"), scope = Sel([{ value: "all", label: "모든 화면" }, { value: "screen", label: "화면 조건" }]);
    name.value = rec.name || "";
    desc.value = rec.description || "";
    order.value = rec.sortOrder || 100;
    code.value = rec.code || "";
    code.style.cssText = "height:250px;width:100%;font-family:Consolas,monospace";
    scope.value = rec.screenRule ? "screen" : "all";
    w.body.appendChild(name);
    w.body.appendChild(desc);
    w.body.appendChild(order);
    w.body.appendChild(scope);
    w.body.appendChild(code);
    var ruleWrap = E("div"), getRule = null;
    function rr() {
      ruleWrap.innerHTML = "";
      getRule = null;
      if (scope.value === "screen") getRule = ruleEditorBody(rec.screenRule || defaultScreenRule(screenInfo()), ruleWrap);
    }
    scope.onchange = rr;
    rr();
    w.body.appendChild(ruleWrap);
    var row = E("div", "g2bv4-toolbar");
    row.appendChild(B("저장", "g2bv4-primary", async function() {
      rec.name = name.value.trim() || "스크립트";
      rec.description = desc.value;
      rec.sortOrder = +order.value || 100;
      rec.code = code.value;
      rec.screenRule = getRule ? getRule() : null;
      rec.updatedAt = nowIso();
      await dbPut(STORES.launcherScripts, rec);
      w.close();
      renderLauncher();
    }));
    row.appendChild(B("삭제", "g2bv4-danger", async function() {
      if (confirm("런처 데이터를 삭제할까요?")) {
        await dbDel(STORES.launcherScripts, rec.id);
        w.close();
        renderLauncher();
      }
    }));
    w.body.appendChild(row);
  }
  var dbSec = sections.db, dbMini = E("div"), dbOpen = B("DB 브라우저 열기", "g2bv4-primary", openDbBrowser), dictOpen = B("사전 관리", "", openDictionaryManager), collectOpen = B("수집 관리", "", openCollectionManager), backupOpen = B("백업 / 복원", "", openBackupWindow);
  dbOpen.style.width = "100%";
  dbSec.appendChild(dbOpen);
  var dbBtns = E("div", "g2bv4-grid3");
  dbBtns.style.marginTop = "7px";
  dbBtns.appendChild(dictOpen);
  dbBtns.appendChild(collectOpen);
  dbBtns.appendChild(backupOpen);
  dbSec.appendChild(dbBtns);
  dbSec.appendChild(dbMini);
  async function refreshDbMini() {
    var regs = await tableList(), rows = await dbAll(STORES.tableRows), notes = await dbAll(STORES.notes), evs = await dbAll(STORES.collectorEvents);
    dbMini.innerHTML = "";
    var info = E("div", "g2bv4-card");
    info.style.marginTop = "8px";
    info.innerHTML = "<div>업무/사용자 테이블 <b>" + regs.length + "</b></div><div>데이터 행 <b>" + rows.length + "</b></div><div>메모/일정 <b>" + notes.length + "</b></div><div>수집 이벤트 <b>" + evs.length + "</b></div>";
    dbMini.appendChild(info);
  }
  var SYSTEM_TABLES = [{ id: "sys.notes", name: "시스템 · 메모/일정", store: STORES.notes }, { id: "sys.launcher", name: "시스템 · 런처", store: STORES.launcherScripts }, { id: "sys.rawCaptures", name: "시스템 · RAW", store: STORES.rawCaptures }, { id: "sys.rawSessions", name: "시스템 · 수집세션", store: STORES.rawSessions }, { id: "sys.collectorEvents", name: "시스템 · 수집이벤트", store: STORES.collectorEvents }, { id: "sys.collectionSources", name: "시스템 · 수집매핑", store: STORES.collectionSources }, { id: "sys.staging", name: "시스템 · Staging", store: STORES.staging }, { id: "sys.dictKeys", name: "시스템 · 키사전", store: STORES.dictKeys }, { id: "sys.dictCodes", name: "시스템 · 값사전", store: STORES.dictCodes }, { id: "sys.dictExcluded", name: "시스템 · 숨김키", store: STORES.dictExcluded }, { id: "sys.dictHeaders", name: "시스템 · 헤더", store: STORES.dictHeaders }, { id: "sys.tableColumns", name: "시스템 · 칼럼설정", store: STORES.tableColumns }, { id: "sys.screenRegistry", name: "시스템 · 화면정보", store: STORES.screenRegistry }, { id: "sys.relationships", name: "시스템 · 관계", store: STORES.relationships }, { id: "sys.settings", name: "시스템 · 설정", store: STORES.settings }];
  async function allDbTableDefs() {
    var regs = await tableList(), out = [];
    out.push({ id: "virtual.master", name: "통합 뷰", virtual: "master" });
    regs.forEach(function(x) {
      out.push(x);
    });
    SYSTEM_TABLES.forEach(function(x) {
      out.push(x);
    });
    return out;
  }
  function systemDef(id) {
    return SYSTEM_TABLES.find(function(x) {
      return x.id === id;
    });
  }
  async function dbRowsFor(def) {
    if (def.virtual === "master") return await buildMaster();
    if (def.store) return await dbAll(def.store);
    var arr = await tableRows(def.id);
    return arr.map(function(rec) {
      var r = Object.assign({}, rec.data);
      Object.defineProperty(r, "__recId", { value: rec.id, writable: true, enumerable: false });
      return r;
    });
  }
  var businessEditQueues = new WeakMap();
  function persistBusinessEdit(tableId, row, key, value) {
    var previous = businessEditQueues.get(row) || Promise.resolve(), pending = previous.catch(function() {}).then(async function() {
      var rid = row.__recId, rec = rid ? await dbGet(STORES.tableRows, rid) : null;
      if (!rec) {
        rec = await upsertTableRow(tableId, row, { editedAt: nowIso(), source: "db-browser" });
        if (Object.prototype.hasOwnProperty.call(row, "__recId")) row.__recId = rec.id;
        else Object.defineProperty(row, "__recId", { value: rec.id, writable: true, enumerable: false });
        return;
      }
      var oldId = rec.id;
      rec.data[key] = value;
      var newKey = await rowKeyForAsync(tableId, rec.data);
      if (!newKey) throw new Error("필수 식별키가 없습니다.");
      var newId = tableId + "::" + newKey;
      rec.rowKey = newKey;
      rec.id = newId;
      rec.updatedAt = nowIso();
      rec.__storeVersion = (rec.__storeVersion || 0) + 1;
      var db = await openDB();
      await new Promise(function(resolve, reject) {
        var tx = db.transaction(STORES.tableRows, "readwrite"), st = tx.objectStore(STORES.tableRows), error;
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = function() {
          reject(error || tx.error || new Error("DB 트랜잭션이 중단되었습니다."));
        };
        try {
          if (newId === oldId) st.put(rec);
          else {
            var check = st.get(newId);
            check.onsuccess = function() {
              if (check.result) {
                error = new Error("변경한 업무키가 기존 행과 충돌합니다: " + newKey);
                tx.abort();
                return;
              }
              try {
                st.delete(oldId);
                st.put(rec);
              } catch (e) {
                error = e;
                tx.abort();
              }
            };
          }
        } catch (e) {
          error = e;
          try { tx.abort(); } catch (abortError) { reject(e); }
        }
      });
      row.__recId = newId;
    });
    businessEditQueues.set(row, pending);
    return pending;
  }
  async function persistSystemEdit(def, row, key, value) {
    var kp = def.store === STORES.screenRegistry ? "key" : def.store === STORES.rawSessions ? "sessionId" : "id";
    if (!row[kp]) return;
    row[key] = value;
    await dbPut(def.store, row);
  }
  async function openDbBrowser() {
    var w = openWindow("DB 브라우저", { width: "1180px", height: "700px", persistKey: "dbBrowser", instanceKey: "dbBrowser" }), layout = E("div");
    layout.style.cssText = "display:grid;grid-template-columns:210px 1fr;gap:8px;height:100%";
    var side = E("div"), main = E("div");
    main.style.minWidth = "0";
    var list = E("select");
    list.size = 22;
    list.style.cssText = "width:100%;height:calc(100% - 42px)";
    var topBtns = E("div", "g2bv4-toolbar"), addTable = B("테이블 추가"), addCol = B("칼럼 추가"), exp = B("EXPORT"), settings = B("테이블 설정");
    topBtns.appendChild(addTable);
    topBtns.appendChild(addCol);
    topBtns.appendChild(exp);
    topBtns.appendChild(settings);
    side.appendChild(list);
    side.appendChild(topBtns);
    var quick2 = E("div", "g2bv4-tabbar"), gridHost = E("div");
    main.appendChild(quick2);
    main.appendChild(gridHost);
    layout.appendChild(side);
    layout.appendChild(main);
    w.body.style.overflow = "hidden";
    w.body.appendChild(layout);
    var defs = await allDbTableDefs(), active = "", quickIds = await getSetting("dbQuickTabs", ["virtual.master"]);
    function fillList() {
      list.innerHTML = "";
      defs.forEach(function(d) {
        var o = E("option");
        o.value = d.id;
        o.textContent = d.name || d.id;
        list.appendChild(o);
      });
    }
    fillList();
    function ensureQuick(id) {
      if (quickIds.indexOf(id) < 0) quickIds.push(id);
      putSetting("dbQuickTabs", quickIds);
      renderQuick();
    }
    function renderQuick() {
      quick2.innerHTML = "";
      quickIds = quickIds.filter(function(id) {
        return defs.some(function(d) {
          return d.id === id;
        });
      });
      quickIds.forEach(function(id) {
        var d = defs.find(function(z) {
          return z.id === id;
        }), b = B(d ? d.name : id);
        b.classList.toggle("active", id === active);
        b.onclick = function() {
          selectTable(id);
        };
        quick2.appendChild(b);
      });
      var plus = B("+");
      plus.onclick = function() {
        openQuickChooser(defs, quickIds, function(id) {
          ensureQuick(id);
          selectTable(id);
        });
      };
      quick2.appendChild(plus);
    }
    async function selectTable(id) {
      active = id;
      list.value = id;
      ensureQuick(id);
      renderQuick();
      var def = defs.find(function(x) {
        return x.id === id;
      });
      gridHost.innerHTML = "";
      if (!def) return;
      var rows = await dbRowsFor(def), cols = [];
      rows.forEach(function(r) {
        Object.keys(r).forEach(function(k) {
          if (cols.indexOf(k) < 0 && (def.store || def.virtual || visibleFor(k, def.id))) cols.push(k);
        });
      });
      if (!cols.length && !def.store && !def.virtual) {
        var cfgs = (await dbIndexAll(STORES.tableColumns, "tableId", def.id)).filter(function(c) {
          return c.visible !== false;
        });
        cols = cfgs.map(function(c) {
          return c.key;
        });
      }
      var header = E("div", "g2bv4-toolbar"), addRow = B("+ 행");
      header.appendChild(E("b", "", def.name || def.id));
      header.appendChild(E("span", "g2bv4-mini", rows.length + "행"));
      if (!def.store && !def.virtual) header.appendChild(addRow);
      if (def.virtual) header.appendChild(E("span", "g2bv4-mini", "업무키와 관계를 기준으로 접수·입찰·계약을 통합한 읽기 전용 뷰"));
      gridHost.appendChild(header);
      var gh = E("div");
      gridHost.appendChild(gh);
      SmartGrid(gh, rows, { tableId: def.store || def.virtual ? "" : def.id, columns: cols, height: "555px", editable: !def.virtual, onCellEdited: function(row, k, v) {
        if (def.virtual) return;
        if (def.store) return persistSystemEdit(def, row, k, v);
        return persistBusinessEdit(def.id, row, k, v);
      } });
      addRow.onclick = async function() {
        var r = {};
        cols.forEach(function(k) {
          r[k] = "";
        });
        if (def.id.indexOf("dataset.") === 0) {
          try {
            await upsertTableRow(def.id, r, { source: "manual-row" });
            selectTable(def.id);
          } catch (e) {
            alert(e.message);
          }
        } else alert("고정 업무테이블은 식별키가 필요합니다. 붙여넣기 또는 추출 저장을 사용하세요.");
      };
    }
    list.onchange = function() {
      selectTable(list.value);
    };
    addTable.onclick = function() {
      openTableAddPopup(async function() {
        defs = await allDbTableDefs();
        fillList();
      });
    };
    addCol.onclick = function() {
      var def = defs.find(function(x) {
        return x.id === active;
      });
      if (def && !def.store && !def.virtual) openColumnAddPopup(active, function() {
        selectTable(active);
      });
      else alert("업무/사용자 테이블에서만 칼럼을 추가할 수 있습니다.");
    };
    exp.onclick = function() {
      var def = defs.find(function(x) {
        return x.id === active;
      });
      if (def) openDbExportPopup(def);
    };
    settings.onclick = function() {
      var def = defs.find(function(x) {
        return x.id === active;
      });
      if (def && !def.store && !def.virtual) openTableSettings(def, function() {
        selectTable(def.id);
      });
    };
    renderQuick();
    if (quickIds.length) selectTable(quickIds[0]);
    else if (defs.length) selectTable(defs[0].id);
  }
  function openQuickChooser(defs, current, done) {
    var w = openWindow("빠른 탭 추가", { width: "420px", height: "430px" }), q = I("search", "검색"), list = E("div");
    w.body.appendChild(q);
    w.body.appendChild(list);
    function draw() {
      list.innerHTML = "";
      defs.filter(function(d) {
        return !q.value || s(d.name || d.id).toLowerCase().indexOf(q.value.toLowerCase()) >= 0;
      }).forEach(function(d) {
        var b = B((current.indexOf(d.id) >= 0 ? "✓ " : "") + (d.name || d.id));
        b.style.cssText = "width:100%;text-align:left;margin:2px 0";
        b.onclick = function() {
          done(d.id);
          w.close();
        };
        list.appendChild(b);
      });
    }
    q.oninput = draw;
    draw();
  }
  function openTableAddPopup(done) {
    var w = openWindow("사용자 테이블 추가", { width: "500px", height: "570px" }), name = I("text", "테이블명"), desc = E("textarea"), keys = I("text", "업무키 (쉼표 구분)"), useRule = I("checkbox");
    desc.placeholder = "설명";
    var l = E("label", "g2bv4-row");
    useRule.style.width = "auto";
    l.appendChild(useRule);
    l.appendChild(E("span", "", "현재 화면 조건을 기본 수집조건으로 사용"));
    w.body.appendChild(name);
    w.body.appendChild(desc);
    w.body.appendChild(keys);
    w.body.appendChild(l);
    var ruleBox = E("div"), getRule = ruleEditorBody(defaultScreenRule(screenInfo()), ruleBox);
    ruleBox.style.display = "none";
    useRule.onchange = function() {
      ruleBox.style.display = useRule.checked ? "block" : "none";
    };
    w.body.appendChild(ruleBox);
    w.body.appendChild(B("생성", "g2bv4-primary", async function() {
      if (!name.value.trim()) return;
      await createDataset(name.value.trim(), desc.value, keys.value.split(",").map(function(x) {
        return x.trim();
      }).filter(Boolean), useRule.checked ? getRule() : null);
      w.close();
      if (done) done();
    }));
  }
  function openColumnAddPopup(tableId, done) {
    var w = openWindow("칼럼 추가", { width: "470px", height: "460px" }), tbl = Sel([]), key = I("text", "원본 Key"), label = I("text", "표시명"), type = Sel(["string", "numeric", "integer", "date", "datetime", "boolean"]), width = I("number", "너비"), vis = I("checkbox");
    vis.style.width = "auto";
    vis.checked = true;
    tableList().then(function(ds) {
      ds.forEach(function(d) {
        var o = E("option");
        o.value = d.id;
        o.textContent = d.name;
        tbl.appendChild(o);
      });
      tbl.value = tableId || ds[0] && ds[0].id || "";
    });
    w.body.appendChild(tbl);
    w.body.appendChild(key);
    w.body.appendChild(label);
    w.body.appendChild(type);
    w.body.appendChild(width);
    var l = E("label", "g2bv4-row");
    l.appendChild(vis);
    l.appendChild(E("span", "", "표시"));
    w.body.appendChild(l);
    w.body.appendChild(B("추가", "g2bv4-primary", async function() {
      var k = key.value.trim();
      if (!k) return;
      await dbPut(STORES.dictKeys, { id: k, key: k, label: label.value.trim() || k, type: type.value, updatedAt: nowIso() });
      await dbPut(STORES.tableColumns, { id: tbl.value + "::" + k, tableId: tbl.value, key: k, visible: vis.checked, width: +width.value || 130, order: 9999, updatedAt: nowIso() });
      await refreshDictCache();
      w.close();
      if (done) done();
    }));
  }
  function csvCell(v) {
    v = s(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  async function openDbExportPopup(def) {
    var w = openWindow("EXPORT · " + (def.name || def.id), { width: "420px", height: "260px" }), format = Sel([{ value: "json", label: "JSON" }, { value: "csv", label: "CSV" }]);
    w.body.appendChild(format);
    w.body.appendChild(B("Export", "g2bv4-primary", async function() {
      var rows = await dbRowsFor(def);
      if (format.value === "json") download({ table: def.id, exportedAt: nowIso(), rows }, def.id.replace(/[^a-zA-Z0-9._-]/g, "_") + "_" + stamp() + ".json");
      else {
        var ks = [];
        rows.forEach(function(r) {
          Object.keys(r).forEach(function(k) {
            if (ks.indexOf(k) < 0) ks.push(k);
          });
        });
        var text = "\uFEFF" + ks.map(csvCell).join(",") + "\n" + rows.map(function(r) {
          return ks.map(function(k) {
            return csvCell(r[k]);
          }).join(",");
        }).join("\n");
        var blob = new Blob([text], { type: "text/csv;charset=utf-8" }), u = URL.createObjectURL(blob), a = DOC.createElement("a");
        a.href = u;
        a.download = def.id.replace(/[^a-zA-Z0-9._-]/g, "_") + "_" + stamp() + ".csv";
        a.click();
        setTimeout(function() {
          URL.revokeObjectURL(u);
        }, 1e3);
      }
      w.close();
    }));
  }
  function openTableSettings(def, done) {
    var w = openWindow("테이블 설정 · " + def.name, { width: "550px", height: "650px" }), name = I("text"), desc = E("textarea"), keys = I("text", "업무키"), useRule = I("checkbox");
    name.value = def.name || "";
    desc.value = def.description || "";
    keys.value = (def.businessKeys || []).join(", ");
    useRule.style.width = "auto";
    useRule.checked = !!def.collectionRule;
    w.body.appendChild(name);
    w.body.appendChild(desc);
    w.body.appendChild(keys);
    var l = E("label", "g2bv4-row");
    l.appendChild(useRule);
    l.appendChild(E("span", "", "화면조건 사용"));
    w.body.appendChild(l);
    var rb = E("div"), get = ruleEditorBody(def.collectionRule || defaultScreenRule(screenInfo()), rb);
    rb.style.display = useRule.checked ? "block" : "none";
    useRule.onchange = function() {
      rb.style.display = useRule.checked ? "block" : "none";
    };
    w.body.appendChild(rb);
    w.body.appendChild(B("저장", "g2bv4-primary", async function() {
      def.name = name.value.trim() || def.name;
      def.description = desc.value;
      def.businessKeys = keys.value.split(",").map(function(x) {
        return x.trim();
      }).filter(Boolean);
      def.pk = def.businessKeys.length ? def.businessKeys : ["__rowId"];
      def.collectionRule = useRule.checked ? get() : null;
      def.updatedAt = nowIso();
      await dbPut(STORES.tableRegistry, def);
      w.close();
      if (done) done();
    }));
  }
  function openMasterWindow() {
    var w = openWindow("접수 ↔ 입찰 ↔ 계약 통합", { width: "1120px", height: "690px", persistKey: "master" }), tabs = E("div", "g2bv4-tabbar"), area = E("div"), flat = B("플랫"), tree = B("관계");
    tabs.appendChild(flat);
    tabs.appendChild(tree);
    w.body.appendChild(tabs);
    w.body.appendChild(area);
    flat.onclick = async function() {
      area.innerHTML = "";
      var rows = await buildMaster();
      SmartGrid(area, rows, { height: "585px", editable: false });
    };
    tree.onclick = async function() {
      area.innerHTML = "";
      var roots = await buildRelationshipTree();
      roots.forEach(function(n) {
        var c = E("div", "g2bv4-card");
        c.style.margin = "5px 0";
        c.appendChild(E("b", "", "접수 " + s(n.receipt.ctrtDmndRcptNo) + " · " + s(n.receipt.ctrtDmndBizNm)));
        n.bids.forEach(function(b) {
          var z = E("div", "", "↳ 입찰 " + s(b.bid.bidPbancNo) + " · " + s(b.bid.bidPbancNm));
          z.style.margin = "5px 0 0 14px";
          c.appendChild(z);
          b.contracts.forEach(function(ct) {
            var q = E("div", "g2bv4-mini", "↳ 계약 " + s(ct.ctrtNo) + " · " + s(ct.ctrtNm));
            q.style.marginLeft = "30px";
            c.appendChild(q);
          });
        });
        area.appendChild(c);
      });
    };
    flat.click();
  }
  async function openDictionaryManager() {
    var w = openWindow("사전 관리", { width: "1080px", height: "680px", persistKey: "dictionary" }), bar = E("div", "g2bv4-tabbar"), area = E("div"), active = "keys", add = B("+ KEY", "g2bv4-primary");
    var defs = [["keys", "키 라벨"], ["codes", "코드 값"], ["excluded", "숨김 키"], ["headers", "헤더"], ["relations", "관계"], ["screens", "화면정보"], ["screenManage", "화면관리"]];
    defs.forEach(function(x) {
      var b = B(x[1]);
      b.dataset.k = x[0];
      b.onclick = function() {
        active = x[0];
        draw();
      };
      bar.appendChild(b);
    });
    bar.appendChild(E("span", "g2bv4-spacer"));
    bar.appendChild(add);
    w.body.appendChild(bar);
    w.body.appendChild(area);
    add.onclick = function() {
      openDictionaryAdd(active, draw);
    };
    async function draw() {
      Array.from(bar.querySelectorAll("button[data-k]")).forEach(function(b) {
        b.classList.toggle("active", b.dataset.k === active);
      });
      add.textContent = active === "keys" ? "+ KEY" : active === "codes" ? "+ CODE" : active === "headers" ? "+ HEADER" : active === "relations" ? "+ 관계" : active === "screenManage" ? "+ 조건" : "+ 항목";
      area.innerHTML = "";
      await refreshDictCache();
      if (active === "keys") return drawKeyGrid();
      if (active === "codes") return drawCodeGrid();
      if (active === "excluded") return drawExcludedGrid();
      if (active === "headers") return drawHeaderGrid();
      if (active === "relations") return drawRelationsGrid();
      if (active === "screens") return drawScreensGrid();
      return drawScreenManager();
    }
    async function drawKeyGrid() {
      var arr = await dbAll(STORES.dictKeys), rows = arr.map(function(x) {
        return Object.assign({}, x);
      });
      SmartGrid(area, rows, { columns: ["key", "label", "type"], height: "560px", onCellEdited: async function(r, k, v) {
        var x = await dbGet(STORES.dictKeys, r.id);
        x[k] = v;
        x.updatedAt = nowIso();
        await dbPut(STORES.dictKeys, x);
        await refreshDictCache();
      } });
    }
    async function drawCodeGrid() {
      var rows = await dbAll(STORES.dictCodes);
      SmartGrid(area, rows, { columns: ["key", "value", "label"], height: "560px", onCellEdited: async function(r, k, v) {
        var x = await dbGet(STORES.dictCodes, r.id);
        x[k] = v;
        x.updatedAt = nowIso();
        await dbPut(STORES.dictCodes, x);
        await refreshDictCache();
      } });
    }
    async function drawExcludedGrid() {
      var keys = await dbAll(STORES.dictKeys), rows = keys.map(function(k) {
        return { id: k.key, key: k.key, label: k.label, hidden: !!dictCache.excluded[k.key] };
      });
      SmartGrid(area, rows, { columns: ["hidden", "key", "label"], height: "560px", onCellEdited: async function(r, k, v) {
        if (k !== "hidden") return;
        var on = /^(true|1|y|yes|✓)$/i.test(s(v));
        if (on) await dbPut(STORES.dictExcluded, { id: r.key, key: r.key, excluded: true, updatedAt: nowIso() });
        else await dbDel(STORES.dictExcluded, r.key);
        await refreshDictCache();
      } });
    }
    async function drawHeaderGrid() {
      var rows = await dbAll(STORES.dictHeaders);
      SmartGrid(area, rows, { columns: ["tableId", "key", "label"], height: "560px", onCellEdited: async function(r, k, v) {
        var x = await dbGet(STORES.dictHeaders, r.id);
        x[k] = v;
        x.updatedAt = nowIso();
        await dbPut(STORES.dictHeaders, x);
        await refreshDictCache();
      } });
    }
    async function drawRelationsGrid() {
      var rows = await dbAll(STORES.relationships);
      SmartGrid(area, rows, { columns: ["name", "fromTable", "fromKey", "toTable", "toKey", "enabled"], height: "560px", onCellEdited: async function(r, k, v) {
        var x = await dbGet(STORES.relationships, r.id);
        x[k] = k === "enabled" ? /^(true|1|y|yes)$/i.test(s(v)) : v;
        x.updatedAt = nowIso();
        await dbPut(STORES.relationships, x);
      } });
    }
    async function drawScreensGrid() {
      var rows = await dbAll(STORES.screenRegistry);
      SmartGrid(area, rows, { columns: ["key", "url", "areaCd", "depth1", "depth2", "depth3", "label", "firstSeenAt", "lastSeenAt"], height: "560px", editable: false });
    }
    async function drawScreenManager() {
      var sub = E("div", "g2bv4-tabbar"), content = E("div"), m = B("메모"), t = B("테이블");
      area.appendChild(sub);
      area.appendChild(content);
      sub.appendChild(m);
      sub.appendChild(t);
      async function mem() {
        content.innerHTML = "";
        var arr = (await activeNotes()).filter(function(n) {
          return n.kind === "screen";
        });
        if (!arr.length) {
          content.appendChild(E("div", "g2bv4-mini", "화면메모가 없습니다."));
          return;
        }
        arr.forEach(function(n) {
          var r = n.screenRule || {}, row = E("div", "g2bv4-card");
          row.style.cssText = "display:grid;grid-template-columns:1.2fr 2fr auto;gap:7px;align-items:center;margin:5px 0";
          var cond = [r.url || "", r.useAreaCd ? "area=" + r.areaCd : "", r.useDepth1 ? "d1=" + r.depth1 : "", r.useDepth2 ? "d2=" + r.depth2 : "", r.useDepth3 ? "d3=" + r.depth3 : ""].filter(Boolean).join(" · ");
          row.appendChild(E("b", "", noteTitle(n)));
          row.appendChild(E("div", "g2bv4-mini", cond));
          row.appendChild(B("조건 수정", "", function() {
            editScreenRule(n, mem);
          }));
          content.appendChild(row);
        });
      }
      async function tab() {
        content.innerHTML = "";
        var arr = await dbAll(STORES.collectionSources);
        if (!arr.length) {
          content.appendChild(E("div", "g2bv4-mini", "테이블 수집규칙이 없습니다."));
          return;
        }
        arr.forEach(function(x) {
          var r = x.rule || {}, row = E("div", "g2bv4-card");
          row.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1.6fr auto;gap:7px;align-items:center;margin:5px 0";
          var cond = [r.url || "", r.useAreaCd ? "area=" + r.areaCd : "", r.useDepth1 ? "d1=" + r.depth1 : "", r.useDepth2 ? "d2=" + r.depth2 : "", r.useDepth3 ? "d3=" + r.depth3 : ""].filter(Boolean).join(" · ");
          row.appendChild(E("b", "", x.targetTable));
          row.appendChild(E("div", "g2bv4-mini", x.sourceType + " · " + x.sourceId));
          row.appendChild(E("div", "g2bv4-mini", cond));
          row.appendChild(B("수정", "", function() {
            openMappingEditor(x, screenInfo(), mappingSource(x), x.targetTable, tab);
          }));
          content.appendChild(row);
        });
      }
      m.onclick = mem;
      t.onclick = tab;
      mem();
    }
    draw();
  }
  function openDictionaryAdd(kind, done) {
    if (kind === "excluded" || kind === "screens") {
      toast("해당 탭은 기존 항목을 편집합니다.");
      return;
    }
    var w = openWindow("항목 추가", { width: "500px", height: "480px" });
    if (kind === "keys") {
      var k = I("text", "Key"), l = I("text", "라벨"), t = I("text", "Type");
      w.body.appendChild(k);
      w.body.appendChild(l);
      w.body.appendChild(t);
      w.body.appendChild(B("저장", "g2bv4-primary", async function() {
        if (!k.value.trim()) return;
        await dbPut(STORES.dictKeys, { id: k.value.trim(), key: k.value.trim(), label: l.value.trim() || k.value.trim(), type: t.value.trim() || "string", updatedAt: nowIso() });
        await refreshDictCache();
        w.close();
        done();
      }));
      return;
    }
    if (kind === "codes") {
      var k2 = I("text", "Key"), v = I("text", "원본 값"), la = I("text", "표시값");
      w.body.appendChild(k2);
      w.body.appendChild(v);
      w.body.appendChild(la);
      w.body.appendChild(B("저장", "g2bv4-primary", async function() {
        var id = k2.value.trim() + "::" + v.value;
        if (!k2.value.trim()) return;
        await dbPut(STORES.dictCodes, { id, key: k2.value.trim(), value: v.value, label: la.value || v.value, updatedAt: nowIso() });
        await refreshDictCache();
        w.close();
        done();
      }));
      return;
    }
    if (kind === "headers") {
      var tbl = Sel([]), kh = I("text", "Key"), lh = I("text", "Header");
      tableList().then(function(ds) {
        var o = E("option");
        o.value = "*";
        o.textContent = "* 전역";
        tbl.appendChild(o);
        ds.forEach(function(d) {
          var p = E("option");
          p.value = d.id;
          p.textContent = d.name;
          tbl.appendChild(p);
        });
      });
      w.body.appendChild(tbl);
      w.body.appendChild(kh);
      w.body.appendChild(lh);
      w.body.appendChild(B("저장", "g2bv4-primary", async function() {
        if (!kh.value.trim()) return;
        await dbPut(STORES.dictHeaders, { id: tbl.value + "::" + kh.value.trim(), tableId: tbl.value, key: kh.value.trim(), label: lh.value.trim() || kh.value.trim(), updatedAt: nowIso() });
        await refreshDictCache();
        w.close();
        done();
      }));
      return;
    }
    if (kind === "relations") {
      var name = I("text", "관계명"), ft = Sel([]), fk = I("text", "From Key"), tt = Sel([]), tk = I("text", "To Key");
      tableList().then(function(ds) {
        ds.forEach(function(d) {
          [ft, tt].forEach(function(z) {
            var o = E("option");
            o.value = d.id;
            o.textContent = d.name;
            z.appendChild(o);
          });
        });
      });
      w.body.appendChild(name);
      w.body.appendChild(ft);
      w.body.appendChild(fk);
      w.body.appendChild(tt);
      w.body.appendChild(tk);
      w.body.appendChild(B("저장", "g2bv4-primary", async function() {
        await dbPut(STORES.relationships, { id: uid("rel"), name: name.value || "관계", fromTable: ft.value, fromKey: fk.value.trim(), toTable: tt.value, toKey: tk.value.trim(), enabled: true, createdAt: nowIso(), updatedAt: nowIso() });
        w.close();
        done();
      }));
      return;
    }
    if (kind === "screenManage") {
      toast("화면 조건은 메모 또는 수집 매핑에서 추가합니다.");
      w.close();
    }
  }
  async function openExtractWindow() {
    var raw = collectRaw(), si = screenInfo(raw);
    await registerScreen(si);
    var sources = listCurrentSources(raw), w = openWindow("현재 화면 추출", { width: "1120px", height: "690px", persistKey: "extract", instanceKey: "extract" }), tabs = E("div", "g2bv4-tabbar"), area = E("div");
    w.body.appendChild(tabs);
    w.body.appendChild(area);
    if (!sources.length) {
      area.appendChild(E("div", "g2bv4-mini", "추출 가능한 pointInfo/Grid가 없습니다."));
      return;
    }
    var active = 0, buffers = new Map(), targets = new Map(), drawRevision = 0;
    function displayColumns(rows, tableId) {
      var used = {};
      rows.forEach(function(r) {
        Object.keys(r || {}).forEach(function(k) {
          if (!isEmptyValue(r[k])) used[k] = 1;
        });
      });
      return Object.keys(used).filter(function(k) {
        return visibleFor(k, tableId);
      });
    }
    async function draw() {
      var revision = ++drawRevision, src = sources[active];
      if (!buffers.has(src.key)) buffers.set(src.key, rowsFromSource(raw, src));
      var rows = buffers.get(src.key);
      tabs.innerHTML = "";
      sources.forEach(function(src2, i) {
        var b = B(src2.type === "pointInfo" ? "기본정보" : src2.sourceId);
        b.classList.toggle("active", i === active);
        b.onclick = function() {
          active = i;
          draw();
        };
        tabs.appendChild(b);
      });
      var toolbar = E("div", "g2bv4-toolbar"), target = Sel([]), save = B("DB 저장", "g2bv4-primary"), map = B("수집규칙 저장"), info = E("span", "g2bv4-mini", src.label);
      var defs = await tableList();
      if (revision !== drawRevision) return;
      defs.forEach(function(d) {
        var o = E("option");
        o.value = d.id;
        o.textContent = d.name;
        target.appendChild(o);
      });
      var maps = await dbAll(STORES.collectionSources), match = maps.find(function(m) {
        return m.framePath === src.framePath && m.sourceType === src.type && m.sourceId === src.sourceId && mappingMatches(m, si);
      });
      if (revision !== drawRevision) return;
      if (targets.has(src.key)) target.value = targets.get(src.key);
      else if (match) target.value = match.targetTable;
      targets.set(src.key, target.value);
      toolbar.appendChild(target);
      toolbar.appendChild(save);
      toolbar.appendChild(map);
      toolbar.appendChild(info);
      area.innerHTML = "";
      area.appendChild(toolbar);
      var gh = E("div");
      area.appendChild(gh);
      SmartGrid(gh, rows, { tableId: target.value, columns: displayColumns(rows, target.value), height: "540px", editable: true });
      target.onchange = function() {
        targets.set(src.key, target.value);
        draw();
      };
      save.onclick = async function() {
        var stage = await stageCurrent(target.value, src, raw, si, rows), res = await commitStage(stage);
        alert("저장 " + res.saved + "행" + (res.duplicates ? " · 중복 " + res.duplicates + "행" : "") + (res.conflicts ? " · 충돌 " + res.conflicts + "행" : "") + (res.failed.length ? " · 실패 " + res.failed.length : "") + "\n저장하지 않은 다른 탭은 DB 테이블에 포함되지 않습니다.");
        refreshDbMini();
      };
      map.onclick = function() {
        openMappingEditor(null, si, src, target.value, function() {
          toast("수집규칙 저장");
        });
      };
    }
    draw();
  }
  function openMappingEditor(rec, si, src, targetId, done) {
    var w = openWindow(rec ? "수집규칙 수정" : "수집규칙 추가", { width: "540px", height: "620px" }), tbl = Sel([]), type = Sel([{ value: "pointInfo", label: "pointInfo" }, { value: "grid", label: "Grid" }]), frame = I("text", "Frame path"), sid = I("text", "Source ID"), enabled = I("checkbox");
    enabled.style.width = "auto";
    enabled.checked = rec ? rec.enabled : true;
    tableList().then(function(ds) {
      ds.forEach(function(d) {
        var o = E("option");
        o.value = d.id;
        o.textContent = d.name;
        tbl.appendChild(o);
      });
      tbl.value = targetId || rec && rec.targetTable || "";
    });
    type.value = rec && rec.sourceType || src && src.type || "pointInfo";
    frame.value = rec && rec.framePath || src && src.framePath || "top";
    sid.value = rec && rec.sourceId || src && src.sourceId || "pointInfo";
    w.body.appendChild(tbl);
    w.body.appendChild(type);
    w.body.appendChild(frame);
    w.body.appendChild(sid);
    var lab = E("label", "g2bv4-row");
    lab.appendChild(enabled);
    lab.appendChild(E("span", "", "사용"));
    w.body.appendChild(lab);
    var getRule = ruleEditorBody(rec && rec.rule || defaultScreenRule(si || screenInfo()), w.body);
    w.body.appendChild(B("저장", "g2bv4-primary", async function() {
      var sc = si || screenInfo(), ss = { framePath: frame.value || "top", type: type.value, sourceId: type.value === "pointInfo" ? "pointInfo" : sid.value.trim() };
      await saveMapping(tbl.value, sc, ss, { id: rec && rec.id, rule: getRule(), enabled: enabled.checked, createdAt: rec && rec.createdAt });
      w.close();
      if (done) done();
    }));
    if (rec) w.body.appendChild(B("규칙 삭제", "g2bv4-danger", async function() {
      if (confirm("수집규칙을 삭제할까요?")) {
        await dbDel(STORES.collectionSources, rec.id);
        w.close();
        if (done) done();
      }
    }));
  }
  var collectSec = sections.collect, collectMini = E("div");
  collectSec.appendChild(collectMini);
  dbSec.appendChild(collectMini);
  async function renderCollectionMini() {
    var ev = await dbAll(STORES.collectorEvents), caps = await dbAll(STORES.rawCaptures), maps = await dbAll(STORES.collectionSources);
    var counts = {};
    ev.forEach(function(x) {
      counts[x.kind] = (counts[x.kind] || 0) + 1;
    });
    collectMini.innerHTML = "";
    var card = E("div", "g2bv4-card");
    card.style.marginTop = "8px";
    card.innerHTML = "<div>자동수집: <b>" + (collector.active ? "ON" : "OFF") + "</b></div><div>RAW: " + caps.filter(function(x) {
      return x.eventType === "SNAPSHOT";
    }).length + "</div><div>액션: " + (counts.action || 0) + " · 컨트롤: " + (counts.control || 0) + "</div><div>메뉴: " + (counts.menu || 0) + " · 제출: " + (counts.submission || 0) + "</div><div>요청: " + (counts.request || 0) + " · 응답: " + (counts.response || 0) + "</div><div>수집규칙: " + maps.length + "</div>";
    collectMini.appendChild(card);
  }
  async function openCollectionManager() {
    var w = openWindow("수집 관리자", { width: "1160px", height: "700px", persistKey: "collection", instanceKey: "collection" }), tabs = E("div", "g2bv4-tabbar"), area = E("div"), mode = "events";
    [["events", "이벤트"], ["raw", "RAW"], ["mappings", "수집규칙"], ["screens", "화면"], ["links", "직링크"]].forEach(function(x) {
      var b = B(x[1]);
      b.dataset.mode = x[0];
      b.onclick = function() {
        mode = x[0];
        draw();
      };
      tabs.appendChild(b);
    });
    tabs.appendChild(E("span", "g2bv4-spacer"));
    var auto = B(collector.active ? "종료" : "시작"), once = B("수집", "g2bv4-primary");
    auto.onclick = function() {
      (collector.active ? autoStop() : autoStart()).then(function() {
        auto.textContent = collector.active ? "종료" : "시작";
        draw();
      });
    };
    once.onclick = function() {
      manualCollect().then(draw);
    };
    tabs.appendChild(auto);
    tabs.appendChild(once);
    tabs.appendChild(B("Export", "", collectionExport));
    w.body.appendChild(tabs);
    w.body.appendChild(area);
    async function draw() {
      Array.from(tabs.querySelectorAll("[data-mode]")).forEach(function(b) {
        b.classList.toggle("active", b.dataset.mode === mode);
      });
      area.innerHTML = "";
      if (mode === "events") {
        var bar = E("div", "g2bv4-tabbar"), host = E("div"), kind = "all";
        ["all", "control", "action", "menu", "submission", "request", "response", "snapshot", "conflict"].forEach(function(k) {
          var b = B(k);
          b.onclick = function() {
            kind = k;
            show();
          };
          bar.appendChild(b);
        });
        area.appendChild(bar);
        area.appendChild(host);
        async function show() {
          var rows2 = await dbAll(STORES.collectorEvents);
          if (kind !== "all") rows2 = rows2.filter(function(x) {
            return x.kind === kind;
          });
          rows2 = rows2.map(function(x) {
            return { id: x.id, kind: x.kind, capturedAt: x.capturedAt, label: x.label || "", type: x.type || x.eventType || "", componentId: x.normalizedComponentId || x.componentId || "", method: x.method || "", url: x.requestUrl || x.responseUrl || x.url || "", status: x.status || "", screenKey: x.screenKey || "", value: typeof x.value === "object" ? JSON.stringify(x.value) : x.value };
          });
          SmartGrid(host, rows2, { columns: ["kind", "capturedAt", "label", "type", "componentId", "method", "url", "status", "screenKey", "value"], height: "545px", editable: false });
        }
        show();
        return;
      }
      if (mode === "raw") {
        var rows = (await dbAll(STORES.rawCaptures)).filter(function(x) {
          return x.eventType === "SNAPSHOT";
        }).map(function(x) {
          return { id: x.id, capturedAt: x.capturedAt, sessionId: x.sessionId, trigger: x.trigger, screenKey: x.screenKey, url: x.url, areaCd: x.areaCd, depth1: x.depth1, depth2: x.depth2, depth3: x.depth3, hash: x.hash, sourceCount: x.raw ? listCurrentSources(x.raw).length : 0 };
        });
        SmartGrid(area, rows, { columns: ["capturedAt", "sessionId", "trigger", "screenKey", "url", "areaCd", "depth1", "depth2", "depth3", "hash", "sourceCount"], height: "575px", editable: false });
        return;
      }
      if (mode === "mappings") {
        var tools = E("div", "g2bv4-toolbar"), add = B("+ 규칙");
        tools.appendChild(add);
        area.appendChild(tools);
        var host = E("div");
        area.appendChild(host);
        async function rm() {
          var rows2 = await dbAll(STORES.collectionSources);
          SmartGrid(host, rows2.map(function(x) {
            var r = x.rule || {};
            return { id: x.id, targetTable: x.targetTable, sourceType: x.sourceType, sourceId: x.sourceId, framePath: x.framePath, url: r.url || "", areaCd: r.useAreaCd ? r.areaCd : "*", depth1: r.useDepth1 ? r.depth1 : "*", depth2: r.useDepth2 ? r.depth2 : "*", depth3: r.useDepth3 ? r.depth3 : "*", enabled: x.enabled };
          }), { columns: ["targetTable", "sourceType", "sourceId", "framePath", "url", "areaCd", "depth1", "depth2", "depth3", "enabled"], height: "530px", editable: false });
        }
        add.onclick = function() {
          var raw = collectRaw(), srcs = listCurrentSources(raw);
          if (!srcs.length) return alert("현재 화면 소스가 없습니다.");
          openSourceChooser(srcs, function(src) {
            openMappingEditor(null, screenInfo(raw), src, null, rm);
          });
        };
        rm();
        return;
      }
      if (mode === "links") {
        var q = I("search", "직링크 검색"), scan = B("현재화면 스캔"), host = E("div");
        var bar = E("div", "g2bv4-toolbar");
        bar.appendChild(q);
        bar.appendChild(scan);
        area.appendChild(bar);
        area.appendChild(host);
        async function links() {
          host.innerHTML = "";
          var rows2 = (await dbAll(STORES.collectorEvents)).filter(function(x) {
            return x.directRef && x.directLink;
          });
          var seen = /* @__PURE__ */ new Set();
          rows2 = rows2.filter(function(x) {
            var k = (x.controlKey || "") + "|" + (x.componentId || "") + "|" + (x.label || "");
            if (seen.has(k)) return false;
            seen.add(k);
            return !q.value || JSON.stringify([x.label, x.componentId, x.type, x.screenKey]).toLowerCase().indexOf(q.value.toLowerCase()) >= 0;
          }).slice(-250).reverse();
          rows2.forEach(function(x) {
            var card = E("div", "g2bv4-card"), r = E("div", "g2bv4-row"), nm = E("div", "", x.label || x.componentId || "(무명)"), go = B("실행", "g2bv4-primary"), cp = B("복사");
            nm.style.flex = "1";
            go.onclick = function() {
              if (!executeDirectRef(x.directRef)) alert("현재 화면에서 대상 컨트롤을 찾지 못했습니다.");
            };
            cp.onclick = function() {
              copyText(x.directLink);
              toast("직링크 복사");
            };
            r.appendChild(nm);
            r.appendChild(go);
            r.appendChild(cp);
            card.appendChild(r);
            card.appendChild(E("div", "g2bv4-mini", (x.type || "") + " · " + (x.normalizedComponentId || x.componentId || "") + " · " + (x.screenKey || "")));
            host.appendChild(card);
          });
          if (!rows2.length) host.appendChild(E("div", "g2bv4-mini", "저장된 직링크가 없습니다. 현재화면 스캔을 실행해 보세요."));
        }
        q.oninput = links;
        scan.onclick = function() {
          scanControls().then(links);
        };
        links();
        return;
      }
      var screens = await dbAll(STORES.screenRegistry);
      SmartGrid(area, screens, { columns: ["key", "url", "areaCd", "depth1", "depth2", "depth3", "label", "firstSeenAt", "lastSeenAt"], height: "575px", editable: false });
    }
    draw();
  }
  function openSourceChooser(srcs, done) {
    var w = openWindow("수집 소스 선택", { width: "520px", height: "450px" });
    srcs.forEach(function(src) {
      var b = B(src.label);
      b.style.cssText = "width:100%;text-align:left;margin:2px 0";
      b.onclick = function() {
        w.close();
        done(src);
      };
      w.body.appendChild(b);
    });
  }
  async function openBackupWindow() {
    var w = openWindow("백업 / 복원", { width: "500px", height: "570px" }), sets = [["notes", "메모/일정"], ["launcherScripts", "런처"], ["tableRegistry", "테이블 정의"], ["tableRows", "테이블 데이터"], ["collectionSources", "수집규칙"], ["dictKeys", "키사전"], ["dictCodes", "값사전"], ["dictExcluded", "숨김키"], ["dictHeaders", "헤더"], ["tableColumns", "칼럼설정"], ["screenRegistry", "화면정보"], ["relationships", "관계"], ["collectorEvents", "수집이벤트"], ["rawCaptures", "RAW"], ["rawSessions", "수집세션"]], checks = {};
    sets.forEach(function(x) {
      var c = I("checkbox");
      c.style.width = "auto";
      c.checked = true;
      checks[x[0]] = c;
      var l = E("label", "g2bv4-row");
      l.appendChild(c);
      l.appendChild(E("span", "", x[1]));
      w.body.appendChild(l);
    });
    var file = I("file");
    file.style.display = "none";
    file.accept = ".json";
    w.body.appendChild(file);
    var row = E("div", "g2bv4-toolbar");
    row.appendChild(B("EXPORT", "g2bv4-primary", async function() {
      var p = { type: "G2B_TOOLBOX_V4_BACKUP", version: "4.2", exportedAt: nowIso() };
      for (var i = 0; i < sets.length; i++) if (checks[sets[i][0]].checked) p[sets[i][0]] = await dbAll(STORES[sets[i][0]]);
      download(p, "g2b_toolbox_v4_1_backup_" + stamp() + ".json");
    }));
    row.appendChild(B("IMPORT", "", function() {
      file.click();
    }));
    w.body.appendChild(row);
    file.onchange = async function() {
      try {
        var p = JSON.parse(await file.files[0].text());
        for (var i = 0; i < sets.length; i++) {
          var k = sets[i][0];
          if (!checks[k].checked || !Array.isArray(p[k])) continue;
          for (var j = 0; j < p[k].length; j++) await dbPut(STORES[k], p[k][j]);
        }
        await refreshDictCache();
        toast("Import 완료");
        w.close();
        renderNotes();
        renderLauncher();
        refreshDbMini();
      } catch (e) {
        alert("Import 실패: " + e.message);
      }
    };
  }
  var uiObsDocs = /* @__PURE__ */ new WeakSet(), uiObservers = [], uiScreenTimer = null, rebindTimer = null, currentScreen = null;
  async function refreshCurrentScreen() {
    var raw = collectRaw(), si = screenInfo(raw), old = currentScreen && currentScreen.key;
    currentScreen = si;
    await registerScreen(si);
    if (old !== si.key) {
      if (lsGet(UI_TAB_KEY, "work") === "notes") renderNotes();
      if (lsGet(UI_TAB_KEY, "work") === "launcher") renderLauncher();
    }
  }
  function scheduleCurrentScreen() {
    clearTimeout(uiScreenTimer);
    uiScreenTimer = setTimeout(refreshCurrentScreen, 500);
  }
  function observeUiDoc(d) {
    if (!d || uiObsDocs.has(d) || !d.documentElement) return;
    uiObsDocs.add(d);
    try {
      var o = new MutationObserver(scheduleCurrentScreen);
      o.observe(d.documentElement, { childList: true, subtree: true });
      uiObservers.push(o);
    } catch (e) {
    }
  }
  function attachUiObservers() {
    getWindows().forEach(function(x) {
      observeUiDoc(x.d);
    });
    if (collector.active) installCollectorHooks();
  }
  async function terminateV4() {
    try {
      if (collector.active) await autoStop();
    } catch (e) {
    }
    clearTimeout(uiScreenTimer);
    clearTimeout(collector.timer);
    clearInterval(rebindTimer);
    uiObservers.forEach(function(o) {
      try {
        o.disconnect();
      } catch (e) {
      }
    });
    collector.observers.forEach(function(o) {
      try {
        o.disconnect();
      } catch (e) {
      }
    });
    for (var i = collector.undo.length - 1; i >= 0; i--) try {
      collector.undo[i]();
    } catch (e) {
    }
    collector.undo = [];
    appWindows.slice().forEach(function(w) {
      try {
        w.remove();
      } catch (e) {
      }
    });
    stickyMap.forEach(function(w) {
      try {
        w.remove();
      } catch (e) {
      }
    });
    stickyMap.clear();
    try {
      panel.remove();
      bubble.remove();
    } catch (e) {
    }
    try {
      DOC.removeEventListener("mousemove", pmm);
      DOC.removeEventListener("mouseup", pmu);
    } catch (e) {
    }
    try {
      if (typeof rootResizeHandler === "function") ROOT.removeEventListener("resize", rootResizeHandler);
    } catch (e) {
    }
    try {
      css.remove();
    } catch (e) {
    }
    delete ROOT[NS];
  }
  exitBtn.onclick = function() {
    terminateV4();
  };
  await seedDB();
  await migrateV4();
  await refreshDictCache();
  var dbPos = await getSetting("mainPosition", null), dbTab = await getSetting("mainTab", null);
  if (dbPos) {
    lsSet(UI_POS_KEY, JSON.stringify(dbPos));
    applyPosition(dbPos);
  }
  if (dbTab) lsSet(UI_TAB_KEY, dbTab);
  await refreshCurrentScreen();
  await refreshCollectionStatus();
  await refreshDbMini();
  await renderLauncher();
  attachUiObservers();
  rebindTimer = setInterval(attachUiObservers, 1400);
  var rootResizeHandler = function() {
    if (panel.isConnected) applyPosition(loadPosition());
  };
  ROOT.addEventListener("resize", rootResizeHandler);
  showMainTab(lsGet(UI_TAB_KEY, "work"), true);
  ROOT[NS] = { alive: true, version: BUILD, lastInvoke: invokeNow, expand, collapse, resetPosition, toast, manualCollect, autoStart, autoStop, collectRaw, screenInfo, openDbBrowser, openCollectionManager, terminate: terminateV4 };
})();
