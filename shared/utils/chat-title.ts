import { z } from "zod";

/** Short plain-text titles accepted from the model and streamed to the browser. */
export const chatTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\r\n]+$/)
  .refine((title) => title.split(/\s+/).length <= 6);
