"use server";

import { z } from "zod";
import { currentUserId } from "@/auth";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { CONTACT_TOPICS, TOPICS_WITH_ORDER, type ContactTopic } from "@/lib/contact";


type Field = "name" | "email" | "topic" | "orderNumber" | "message";
export type ContactState = { ok: true; reference: string } | { ok: false; fieldErrors: Partial<Record<Field, string>> } | null;

const schema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer"),
    email: z.email("Enter a valid email address so we can reply").max(254),
    topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]], { error: "Choose what your message is about" }),
    orderNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(20)
      .optional()
      .transform((v) => v || null)
      .refine((v) => !v || /^OC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v), "Order numbers look like OC-7K3P-92QX (see Your orders)"),
    message: z.string().trim().min(10, "Tell us a bit more (at least 10 characters)").max(3000, "Keep it under 3,000 characters"),
  })
  .refine((d) => !TOPICS_WITH_ORDER.includes(d.topic) || d.orderNumber, { path: ["orderNumber"], message: "Add the order number so we can find it quickly" });

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const reference = () => `OC-MSG-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHABET[b % ALPHABET.length]).join("")}`;

export async function sendContactMessage(_prev: ContactState, fd: FormData): Promise<ContactState> {
  const parsed = schema.safeParse({
    name: fd.get("name"),
    email: String(fd.get("email") ?? "").trim(),
    topic: fd.get("topic") || undefined,
    orderNumber: String(fd.get("orderNumber") ?? ""),
    message: fd.get("message"),
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<Field, string>> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path[0] as Field] ??= i.message;
    return { ok: false, fieldErrors };
  }
  const ref = reference();
  await db.insert(contactMessages).values({ ...parsed.data, reference: ref, userId: await currentUserId() });
  return { ok: true, reference: ref };
}
