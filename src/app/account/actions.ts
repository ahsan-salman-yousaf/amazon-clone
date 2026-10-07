"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUserId } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { addressSchema, type AddressField } from "@/lib/address";
import { deleteAddress, setDefaultAddress, upsertAddress } from "@/lib/address-book";

const UUID = /^[0-9a-f-]{36}$/i;

async function requireUser() {
  const id = await currentUserId();
  if (!id) redirect("/signin?next=/account");
  return id;
}

export type AddressFormState = { ok?: true; error?: string; fieldErrors?: Partial<Record<AddressField, string>> } | null;

export async function saveAddressAction(_prev: AddressFormState, fd: FormData): Promise<AddressFormState> {
  const userId = await requireUser();
  const parsed = addressSchema.safeParse(Object.fromEntries(["fullName", "line1", "line2", "city", "state", "postalCode", "phone"].map((k) => [k, String(fd.get(k) ?? "")])));
  if (!parsed.success) {
    const fieldErrors: Partial<Record<AddressField, string>> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path[0] as AddressField] ??= i.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  const id = String(fd.get("id") ?? "");
  await upsertAddress(userId, parsed.data, { id: UUID.test(id) ? id : undefined, makeDefault: fd.get("makeDefault") === "on" });
  refresh();
  return { ok: true };
}

export async function deleteAddressAction(id: string) {
  const userId = await requireUser();
  if (UUID.test(id)) await deleteAddress(userId, id);
  refresh();
}

export async function setDefaultAddressAction(id: string) {
  const userId = await requireUser();
  if (UUID.test(id)) await setDefaultAddress(userId, id);
  refresh();
}

export type NameFormState = { ok?: true; error?: string } | null;
const nameSchema = z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer");

export async function updateNameAction(_prev: NameFormState, fd: FormData): Promise<NameFormState> {
  const userId = await requireUser();
  const parsed = nameSchema.safeParse(fd.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.update(users).set({ name: parsed.data }).where(eq(users.id, userId));
  refresh();
  return { ok: true };
}
