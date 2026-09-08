export function Icon({ name }: { name: "case" | "dashboard" | "settings" | "file" | "arrow" }) {
  const paths = { case: "M3 7h6l2 2h10v11H3z M3 7V4h7l2 3", dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z", settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2", file: "M6 2h8l4 4v16H6z M14 2v5h4 M9 12h6 M9 16h6", arrow: "M5 12h14 M13 6l6 6-6 6" };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
