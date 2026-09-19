/**
 * Data odbioru i data w Bazie stawek to tekst `dd.mm.yyyy`.
 * Porównanie jest po dacie kalendarzowej. Pusty tekst jest starszy niż każda wpisana data.
 */

const SHEET_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function parseSheetDate(text: string): CalendarDate {
  const match = SHEET_DATE.exec(text);
  if (!match) {
    throw new Error(`Data nie jest tekstem dd.mm.yyyy: ${JSON.stringify(text)}`);
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`Data kalendarzowa nie istnieje: ${text}`);
  }
  return { year, month, day };
}

/** Pusty `a` jest starszy niż każda wpisana data. */
export function compareSheetDate(a: string, b: string): number {
  if (a === "" && b === "") {
    return 0;
  }
  if (a === "") {
    return -1;
  }
  if (b === "") {
    return 1;
  }
  const left = parseSheetDate(a);
  const right = parseSheetDate(b);
  if (left.year !== right.year) {
    return left.year - right.year;
  }
  if (left.month !== right.month) {
    return left.month - right.month;
  }
  return left.day - right.day;
}

/** `validFrom` pusta albo nie późniejsza niż data odbioru. */
export function isOnOrBefore(validFrom: string, pickupDate: string): boolean {
  parseSheetDate(pickupDate);
  if (validFrom === "") {
    return true;
  }
  return compareSheetDate(validFrom, pickupDate) <= 0;
}
