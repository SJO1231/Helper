export const STYLE = `
:host { all: initial; }
.bar { position: fixed; top: 80px; right: 12px; z-index: 2147483647; width: 260px; box-sizing: border-box;
  padding: 10px 12px 12px; font: 12px/1.4 "Malgun Gothic", system-ui, sans-serif; color: #1f2933;
  background: #fff; border: 1px solid #e3e7ec; border-radius: 10px; box-shadow: 0 6px 20px rgba(15, 23, 42, .12); }
.bar > * { margin: 0 0 8px; }
.bar > :last-child { margin-bottom: 0; }
[hidden] { display: none !important; }
.title { display: flex; align-items: center; justify-content: space-between; cursor: move; touch-action: none;
  user-select: none; padding-bottom: 6px; border-bottom: 1px solid #eef0f3; font-size: 13px; font-weight: 600; }
.row { display: flex; gap: 6px; align-items: center; }
.row > * { flex: 1; min-width: 0; }
button, select, input { box-sizing: border-box; height: 28px; padding: 0 8px; font: inherit; color: inherit;
  background: #fff; border: 1px solid #cfd6de; border-radius: 6px; }
button { cursor: pointer; }
.title .actions { display: flex; gap: 4px; }
.title button { width: 28px; flex: none; padding: 0; cursor: pointer; }
.tabs { display: flex; gap: 2px; border-bottom: 1px solid #eef0f3; }
.tabs button { flex: 1; height: 26px; padding: 0; font-size: 12px; font-weight: 400; color: #7b8794;
  background: none; border: 0; border-bottom: 2px solid transparent; border-radius: 0; }
.tabs button.active { font-weight: 700; color: #1f2933; border-bottom-color: #2f6fed; }
.pane > * { margin: 0 0 8px; }
.pane > :last-child { margin-bottom: 0; }
[data-role="core-status"] { font-size: 12px; color: #52606d; }
.bubble { position: fixed; top: 80px; right: 12px; z-index: 2147483646; width: 46px; height: 46px; padding: 0;
  border-radius: 50%; color: #fff; font-weight: 700; font-size: 11px; background: #2f6fed; border: 0;
  box-shadow: 0 6px 20px rgba(15, 23, 42, .25); cursor: move; touch-action: none; user-select: none; }
.bubble:hover:not(:disabled) { background: #2760d4; }
button:hover:not(:disabled) { background: #f3f5f8; }
button:disabled { color: #9aa5b1; cursor: default; }
button[data-action="search"], button[data-action="collect"] { color: #fff; background: #2f6fed; border-color: #2f6fed; }
button[data-action="search"]:hover:not(:disabled), button[data-action="collect"]:hover:not(:disabled) {
  background: #2760d4; }
button[data-action="collect"]:disabled { color: #fff; background: #a9bff0; border-color: #a9bff0; }
[data-role="diagnostics"] { font-size: 11px; color: #7b8794; word-break: keep-all; }
[data-role="toast"] { color: #0a7a4b; font-weight: 600; }
[data-role="toast"]:empty { display: none; }
[data-role="snapshot"] { position: fixed; inset: 5%; z-index: 2147483647; overflow: auto; padding: 12px;
  font: 12px/1.4 "Malgun Gothic", system-ui, sans-serif; color: #1f2933; background: #fff;
  border: 1px solid #e3e7ec; border-radius: 10px; box-shadow: 0 10px 32px rgba(15, 23, 42, .2); }
table { border-collapse: collapse; margin-bottom: 12px; }
th, td { border: 1px solid #dde2e8; padding: 2px 6px; text-align: left; white-space: nowrap; }
th { background: #f3f5f8; position: sticky; top: 0; }
`;
