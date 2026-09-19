import type { Grosze } from "./types.js";

/**
 * Złote z arkusza albo z pola na grosze.
 * Połówki w górę. Wejście silnika i tak jest już w groszach — to brama dla odczytu.
 */
export function toGrosze(zloty: number): Grosze {
  if (!Number.isFinite(zloty)) {
    throw new Error("kwota nie jest liczbą");
  }
  const negative = zloty < 0;
  const [whole, frac = "0"] = Math.abs(zloty).toFixed(2).split(".");
  const grosze = Number(whole) * 100 + Number(frac);
  return negative ? -grosze : grosze;
}

/** Dzielenie kwoty. Cyfra 5 i wyższa w górę. Reszta grosza nie jest nigdzie dopisywana. */
export function divRoundHalfUp(amount: Grosze, divisor: number): Grosze {
  if (!(divisor > 0) || !Number.isFinite(divisor)) {
    throw new Error("dzielnik musi być większy od zera");
  }
  const negative = amount < 0;
  const numerator = Math.abs(amount);
  const rounded = Number.isInteger(divisor)
    ? roundInteger(numerator, divisor)
    : roundReal(numerator / divisor);
  return negative ? -rounded : rounded;
}

export function mulGrosze(count: number, unit: Grosze): Grosze {
  if (count === 0 || unit === 0) {
    return 0;
  }
  if (Number.isInteger(count)) {
    return count * unit;
  }
  const negative = count < 0 !== unit < 0;
  const rounded = roundReal(Math.abs(count) * Math.abs(unit));
  return negative ? -rounded : rounded;
}

/** Koszt odbioru / ilość worków. Pusta ilość albo 0 dzieli przez 1. */
export function costPerBag(cost: Grosze, bagCount: number | null): Grosze {
  const divisor = bagCount !== null && bagCount > 0 ? bagCount : 1;
  return divRoundHalfUp(cost, divisor);
}

function roundInteger(numerator: number, divisor: number): number {
  const quotient = Math.floor(numerator / divisor);
  const remainder = numerator % divisor;
  return remainder * 2 >= divisor ? quotient + 1 : quotient;
}

function roundReal(value: number): number {
  const floored = Math.floor(value + 1e-10);
  const fraction = value - floored;
  return fraction >= 0.5 - 1e-10 ? floored + 1 : floored;
}
