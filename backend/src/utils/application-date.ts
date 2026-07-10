const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_LOOKUP = new Map(
  MONTH_NAMES.map((month, index) => [month.toLowerCase(), index])
);

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const createUtcDate = (year: number, monthIndex: number, day: number): Date =>
  new Date(Date.UTC(year, monthIndex, day));

export const ensureApplicationDate = (value: unknown): Date => {
  if (value instanceof Date) {
    if (!isValidDate(value)) {
      throw new Error("Invalid application_date value.");
    }

    return createUtcDate(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    );
  }

  if (typeof value !== "string") {
    throw new Error("application_date must be a valid date string.");
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error("application_date is required.");
  }

  const isoMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return createUtcDate(Number(year), Number(month) - 1, Number(day));
  }

  const dayMonthYearMatch = trimmedValue.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dayMonthYearMatch) {
    const [, day, month, year] = dayMonthYearMatch;
    return createUtcDate(Number(year), Number(month) - 1, Number(day));
  }

  const dayMonthNameYearMatch = trimmedValue.match(
    /^(\d{2})[-/ ]([a-zA-Z]{3})[-/ ](\d{4})$/
  );
  if (dayMonthNameYearMatch) {
    const [, day, monthName, year] = dayMonthNameYearMatch;
    const monthIndex = MONTH_LOOKUP.get(monthName.toLowerCase());

    if (monthIndex === undefined) {
      throw new Error("application_date contains an unsupported month value.");
    }

    return createUtcDate(Number(year), monthIndex, Number(day));
  }

  const parsedDate = new Date(trimmedValue);
  if (!isValidDate(parsedDate)) {
    throw new Error("application_date must be a valid date.");
  }

  return createUtcDate(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate()
  );
};

export const formatApplicationDate = (value: Date | string): string => {
  const date = ensureApplicationDate(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  return `${day}-${month}-${year}`;
};
