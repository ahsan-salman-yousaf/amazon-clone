// The "All" drawer groups the 22 categories into six short lists (owner decision).
export const DEPARTMENT_GROUPS: { name: string; slugs: string[] }[] = [
  { name: "Electronics", slugs: ["smartphones", "laptops", "tablets", "mobile-accessories"] },
  { name: "Home & Kitchen", slugs: ["kitchen-accessories", "home-decoration", "furniture"] },
  { name: "Beauty", slugs: ["beauty", "skin-care", "fragrances"] },
  {
    name: "Fashion",
    slugs: [
      "mens-shirts",
      "mens-shoes",
      "mens-watches",
      "tops",
      "womens-dresses",
      "womens-shoes",
      "womens-bags",
      "womens-jewellery",
      "womens-watches",
      "sunglasses",
    ],
  },
  { name: "Sports & Outdoors", slugs: ["sports-accessories"] },
  { name: "Groceries", slugs: ["groceries"] },
];

export type DepartmentGroup = { name: string; categories: { slug: string; name: string }[] };

export function groupDepartments(categories: { slug: string; name: string }[]): DepartmentGroup[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  return DEPARTMENT_GROUPS.map((g) => ({
    name: g.name,
    categories: g.slugs.flatMap((s) => {
      const c = bySlug.get(s);
      return c ? [{ slug: c.slug, name: c.name }] : [];
    }),
  })).filter((g) => g.categories.length > 0);
}
