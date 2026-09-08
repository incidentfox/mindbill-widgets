import { useCallback, useEffect, useState } from "react";
import { jsonRequest } from "../api-client";

export function useCaseBill(caseId: string) {
  const endpoint = `/api/cases/${encodeURIComponent(caseId)}/bill`;
  const [billId, setBillId] = useState<string | null>(null);
  const [creationKey, setCreationKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const saved = await jsonRequest(endpoint, { signal });
        if (!signal?.aborted) { setBillId(saved.billId); setCreationKey(saved.creationKey); }
      } catch (cause) {
        if (!signal?.aborted) setError((cause as Error).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint],
  );

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  async function saveBill(id: string) {
    setBillId(id); // Display the created bill even if saving its link fails.
    setLinkError("");
    try {
      await jsonRequest(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: id }),
      });
    } catch {
      setLinkError(
        "Your bill was created, but its case link could not be saved.",
      );
    }
  }

  return { billId, creationKey, loading, error, linkError, reload, saveBill };
}
