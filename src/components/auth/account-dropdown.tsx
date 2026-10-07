"use client";

import Link from "next/link";
import { ChevronDownIcon, LogOutIcon, PackageIcon, UserIcon } from "lucide-react";
import { signOutAction } from "@/app/signin/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountDropdown({ firstName, email }: { firstName: string; email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm transition-colors hover:bg-black/5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none">
        <UserIcon aria-hidden className="size-4" />
        <span className="hidden max-w-28 truncate sm:inline">Hi, {firstName}</span>
        <span className="sr-only sm:hidden">Account menu</span>
        <ChevronDownIcon aria-hidden className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">Hi, {firstName}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/orders">
            <PackageIcon aria-hidden /> Your orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction()}>
          <LogOutIcon aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
