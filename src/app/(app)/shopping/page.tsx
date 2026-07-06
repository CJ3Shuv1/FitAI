import { createClient } from "@/lib/supabase/server";
import ShoppingBoard from "./ShoppingBoard";
import type { ShoppingListItem } from "@/lib/types";

export default async function ShoppingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  return <ShoppingBoard initialItems={(items || []) as ShoppingListItem[]} />;
}
