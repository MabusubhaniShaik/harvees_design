export const isEmail = (v: unknown) =>
  typeof v === "string" && /\S+@\S+\.\S+/.test(v as string);
