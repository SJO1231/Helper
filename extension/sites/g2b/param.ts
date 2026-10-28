import { toText } from './form';

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isScalar = (value: unknown): boolean => value === null || ['string', 'number', 'boolean'].includes(typeof value);

export interface ParamFlat { param: Record<string, string>; dropped: number }

// 스칼라는 param.<키>, 객체는 한 단계만 param.<객체>.<키>. 더 깊은 것과 배열은 버리고 수만 센다.
export function flattenParam(param: unknown): ParamFlat {
  const flat: Record<string, string> = {};
  let dropped = 0;
  if (!isObject(param)) return { param: flat, dropped };
  for (const [key, value] of Object.entries(param)) {
    if (isScalar(value)) {
      flat[`param.${key}`] = toText(value);
    } else if (isObject(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        if (isScalar(innerValue)) flat[`param.${key}.${inner}`] = toText(innerValue);
        else dropped++;
      }
    } else {
      dropped++;
    }
  }
  return { param: flat, dropped };
}
