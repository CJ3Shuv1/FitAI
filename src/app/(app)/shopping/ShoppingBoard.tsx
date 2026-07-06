"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShoppingListItem } from "@/lib/types";
import { addShoppingItem, clearCheckedItems, deleteShoppingItem, toggleShoppingItem } from "./actions";

export default function ShoppingBoard({ initialItems }: { initialItems: ShoppingListItem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const hasChecked = initialItems.some((i) => i.checked);

  return (
    <div>
      <h1 className="mb-4 text-3xl font-extrabold uppercase tracking-tight">Einkaufsliste</h1>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await addShoppingItem(name.trim(), amount.trim());
          setName("");
          setAmount("");
          router.refresh();
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Artikel"
          className="flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--copper)]"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Menge"
          className="w-24 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--copper)]"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--copper)] px-4 text-sm font-bold text-[#1A1209]"
        >
          +
        </button>
      </form>

      <div className="space-y-2">
        {initialItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
          >
            <button
              onClick={async () => {
                await toggleShoppingItem(item.id, !item.checked);
                router.refresh();
              }}
              className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 text-[14px] font-black ${
                item.checked
                  ? "border-[var(--good)] bg-[var(--good)] text-[#0D1A0A]"
                  : "border-[var(--hairline)] text-transparent"
              }`}
            >
              ✓
            </button>
            <span
              className={`flex-1 text-sm ${item.checked ? "text-[var(--text-faint)] line-through" : ""}`}
            >
              {item.name}
            </span>
            {item.amount && (
              <span className="font-mono text-[12.5px] text-[var(--steel)]">{item.amount}</span>
            )}
            <button
              onClick={async () => {
                await deleteShoppingItem(item.id);
                router.refresh();
              }}
              className="text-[var(--text-faint)]"
            >
              ✕
            </button>
          </div>
        ))}
        {initialItems.length === 0 && (
          <p className="text-sm text-[var(--text-faint)]">Deine Einkaufsliste ist leer.</p>
        )}
      </div>

      {hasChecked && (
        <button
          onClick={async () => {
            await clearCheckedItems();
            router.refresh();
          }}
          className="mt-4 w-full rounded-xl border border-[var(--hairline)] py-2.5 text-sm text-[var(--text-faint)]"
        >
          Abgehakte entfernen
        </button>
      )}
    </div>
  );
}
