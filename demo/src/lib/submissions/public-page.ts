/** Public, page-specific data shipped with the published HTML. Never includes secrets. */
export interface PageSnapshot<T> {
  path: string;
  api: string;
  generatedAt: string;
  data: T;
}

declare global {
  interface Window { __DIRECTORY_PRERENDER__?: boolean; }
}

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!));

export async function loadPublicData<T>(api: string): Promise<T> {
  const node = document.getElementById("page-snapshot");
  if (node) {
    const snapshot = JSON.parse(node.textContent || "") as PageSnapshot<T>;
    const normalize = (path: string) => path.replace(/\/+$/, "") || "/";
    if (normalize(snapshot.path) !== normalize(location.pathname) || snapshot.api !== api) {
      throw new Error("That page is not in this published directory.");
    }
    return snapshot.data;
  }
  // Production must never wait for Fly to display a public directory/profile.
  if (!import.meta.env.DEV) throw new Error("This page has not been published yet.");
  const response = await fetch(api);
  if (!response.ok) throw new Error("That page could not be loaded.");
  return response.json() as Promise<T>;
}

export function finishPage(): void {
  document.documentElement.dataset.directoryReady = "true";
}
