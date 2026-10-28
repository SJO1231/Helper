// 기준마다 JSON 한 줄. detail에는 수·참거짓만 넣는다(화면 값은 넣지 않는다).
const results = [];

export function report(name, pass, detail = {}) {
  results.push(pass);
  console.log(JSON.stringify({ 기준: name, 참: pass, ...detail }));
}

// 한 기준이 던져도 나머지는 돈다. 던진 기준은 거짓이고 이유 글자만 남긴다.
export async function judge(name, check) {
  try {
    const { pass, ...detail } = await check();
    report(name, pass, detail);
  } catch (error) {
    report(name, false, { 오류: error instanceof Error ? error.message.split('\n')[0] : String(error) });
  }
}

export function finish() {
  const failed = results.length === 0 || results.includes(false);
  process.exit(failed ? 1 : 0);
}
