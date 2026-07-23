import React from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { getTopLevelCategories as dbGetTopLevelCategories } from "@/lib/db/categories";
import { mockCategories } from "@/data/mock-categories";
import type { Category } from "@/types";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let categories: Category[] = [];
  try {
    categories = await dbGetTopLevelCategories();
  } catch {
    categories = mockCategories.filter((c) => c.is_active && !c.parent_id);
  }

  return (
    <>
      <PublicNavbar categories={categories} />
      <main className="flex-1 pt-[72px] lg:pt-20">{children}</main>
      <PublicFooter categories={categories} />
      <WhatsAppButton />
    </>
  );
}
