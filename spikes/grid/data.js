// 합성 자료. 값은 자리표시(V123, 숫자, 날짜 꼴)뿐이고 같은 (행, 열)이면 늘 같은 값이다.
const TYPES = ['text', 'money', 'date'];

export function makeColumns(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `c${i}`, label: `열${i}`, type: TYPES[i % 3] }));
}

function mix(row, col) {
  let x = (Math.imul(row + 1, 2654435761) ^ Math.imul(col + 1, 40503)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  return (x ^ (x >>> 13)) >>> 0;
}

const pad2 = (n) => String(n).padStart(2, '0');

export function rawValue(row, col, type) {
  const h = mix(row, col);
  if (type === 'money') return String(h % 10 ** (4 + (h >>> 8) % 5));
  if (type === 'date') return `2025${pad2(1 + (h % 12))}${pad2(1 + ((h >>> 4) % 28))}`;
  return `V${h % 1000}`;
}

export function formatCell(value, type) {
  if ((type === 'money' || type === 'number') && /^-?\d+$/.test(value)) {
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  if (type === 'percent' && /^-?\d+(\.\d+)?$/.test(value)) return `${value}%`;
  if (type === 'date' && /^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  return value;
}

// 코어가 정렬해서 쪽으로 주는 일을 흉내 낸다. HTTP 왕복은 들어 있지 않다(S6 bench가 잰다).
export function createSource(totalRows, columns) {
  const byId = new Map(columns.map((c, i) => [c.id, { ...c, index: i }]));
  let cachedKey = null;
  let cachedOrder = null;
  const calls = []; // 라이브러리가 쪽을 몇 번, 어디서부터 불렀는지(바깥 공급 지원의 증거)

  function orderFor(sort) {
    if (!sort) return null;
    const key = `${sort.colId}:${sort.dir}`;
    if (key === cachedKey) return cachedOrder;
    const col = byId.get(sort.colId);
    const values = Array.from({ length: totalRows }, (_, r) => rawValue(r, col.index, col.type));
    const sign = sort.dir === 'desc' ? -1 : 1;
    const cmp = col.type === 'money'
      ? (a, b) => (Number(values[a]) - Number(values[b])) * sign || a - b
      : (a, b) => (values[a] < values[b] ? -1 : values[a] > values[b] ? 1 : 0) * sign || a - b;
    cachedOrder = Array.from({ length: totalRows }, (_, r) => r).sort(cmp);
    cachedKey = key;
    return cachedOrder;
  }

  function rowAt(r) {
    const row = {};
    for (const c of columns) row[c.id] = rawValue(r, byId.get(c.id).index, c.type);
    return row;
  }

  async function getRows(start, end, sort) {
    calls.push(start);
    const order = orderFor(sort);
    const last = Math.min(end, totalRows);
    const rows = [];
    for (let i = start; i < last; i++) rows.push(rowAt(order ? order[i] : i));
    return { rows, total: totalRows };
  }

  return { total: totalRows, getRows, calls };
}
