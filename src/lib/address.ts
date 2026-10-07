import { z } from "zod";

// US only (owner decision).
export const US_STATES: [code: string, name: string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
const STATE_CODES = new Set(US_STATES.map(([c]) => c));

export const addressSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the recipient's name").max(80),
  line1: z.string().trim().min(1, "Enter a street address").max(120),
  line2: z.string().trim().max(120).optional().transform((v) => v || null),
  city: z.string().trim().min(1, "Enter a city").max(80),
  state: z.string().refine((s) => STATE_CODES.has(s), "Choose a state"),
  postalCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code"),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^[\d\s()+.-]{7,20}$/.test(v), "Enter a valid phone number"),
});
export type AddressInput = z.infer<typeof addressSchema>;
export type AddressField = keyof AddressInput;
