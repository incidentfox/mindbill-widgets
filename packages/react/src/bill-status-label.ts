/** Preserve server-classified response overdue detail within the accepted stage. */
export function acceptedNoResponseLabel(state: string, nativeStatus?: string): string | undefined {
  const value = state.toLowerCase();
  if (value === "accepted_no_response" ||
      ((value === "accepted" || !value) && nativeStatus?.toLowerCase() === "accepted_no_response")) {
    return "Accepted – No Response";
  }
  return undefined;
}
