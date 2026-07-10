function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const DEFAULT_PAGE_LIMIT = readPositiveInt(
  import.meta.env.VITE_DEFAULT_PAGE_LIMIT,
  5,
)
