import data from "../data/directories.json";
export type DirectoryKind = "menus" | "listings" | "community" | "festivals";
export type DirectoryItem = {
  name: string;
  description: string;
  location: string;
  category: string;
  image: string;
  href: string;
  date?: string;
  endDate?: string;
  phone?: string;
  phoneUrl?: string;
};
export const directoryInfo = {
  menus: {
    title: "Something good is cooking.",
    label: "Menus",
    eyebrow: "Pull up a chair",
    description:
      "Find your next favorite meal, browse local menus, and make a plan to eat close to home.",
    action: "View menu",
    path: "restaurants",
  },
  listings: {
    title: "Good people. Local places.",
    label: "Listings",
    eyebrow: "Keep it local",
    description:
      "Meet the businesses that keep our community going. Find services, contact details, and a familiar face.",
    action: "Explore business",
    path: "businesses",
  },
  community: {
    title: "A place to belong.",
    label: "Community",
    eyebrow: "Neighbors helping neighbors",
    description:
      "Connect with local organizations, family programs, and the people making a difference in Sabine Parish.",
    action: "Explore organization",
    path: "organizations",
  },
  festivals: {
    title: "Make a little room for fun.",
    label: "Festivals",
    eyebrow: "Meet you there",
    description:
      "Fairground evenings, hometown traditions, and something to look forward to. Your next Sabine outing starts here.",
    action: "View festival & schedule",
    path: "festivals",
  },
};
export function directoryItems(kind: DirectoryKind): DirectoryItem[] {
  return normalizeDirectoryItems(kind, data[kind]);
}
export function normalizeDirectoryItems(kind: DirectoryKind, rows: Record<string, any>[]): DirectoryItem[] {
  const origin = `https://${kind}.allthingssabine.com`;
  return rows
    .map(item => ({
      name: item.name,
      description:
        item.shortDescription || item.description || item.tagline || "",
      location:
        item.location || [item.city, item.state].filter(Boolean).join(", "),
      category:
        item.category?.name ||
        (kind === "menus"
          ? item.serviceStyleLabel
          : kind === "festivals"
            ? "Festival & event"
            : directoryInfo[kind].label),
      image:
        item.primaryImageUrl || item.imageUrl || item.image_path
          ? new URL(
              item.primaryImageUrl || item.imageUrl || item.image_path,
              origin
            ).href
          : "",
      href: `${origin}/${directoryInfo[kind].path}/${item.slug}/`,
      date: item.starts_on,
      endDate: item.ends_on || item.starts_on,
      phone: item.phone || item.phoneNumber,
      phoneUrl: item.phoneUrl,
    }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
export const eventDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(date + "T12:00:00Z"));
