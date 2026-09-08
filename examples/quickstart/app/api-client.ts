export async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error ?? "The request failed. Please try again.");
  return body;
}
