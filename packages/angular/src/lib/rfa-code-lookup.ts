import type { MindBillComboOption } from './submission-controls';

export type MindBillRfaCodeOption = { code: string; description?: string };
export type MindBillRfaCodeSearch = (query: string) => Promise<MindBillRfaCodeOption[]>;

export function customRfaDiagnosis(query: string): MindBillComboOption | null {
  const code = query.trim().toUpperCase();
  return /^[A-Z][0-9][A-Z0-9](?:\.?[A-Z0-9]{1,4})?$/.test(code)
    ? { id: code, label: code, detail: 'Use this diagnosis code' } : null;
}
export function customRfaProcedure(query: string): MindBillComboOption | null {
  const code = query.trim().toUpperCase();
  return /^(?:[0-9]{5}|[A-Z][0-9]{4}|[0-9]{4}[A-Z]|ML[0-9]{3})$/.test(code)
    ? { id: code, label: code, detail: 'Use this procedure code' } : null;
}

/** Search state is separate from draft values. Disposal invalidates delayed and in-flight work. */
export class RfaCodeLookup {
  query = '';
  options: MindBillComboOption[] = [];
  loading = false;
  error = '';
  private generation = 0;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly notify: () => void) {}
  search(query: string, lookup?: MindBillRfaCodeSearch) {
    if (this.disposed) return;
    this.cancel(); this.query = query; this.options = []; this.error = '';
    if (!lookup) { this.error = 'Enter a code and choose it from the list.'; this.notify(); return; }
    const generation = this.generation; this.loading = true; this.notify();
    this.timer = setTimeout(async () => {
      try {
        const results = await lookup(query.trim());
        if (this.disposed || generation !== this.generation) return;
        const seen = new Set<string>();
        this.options = results.flatMap(result => {
          const code = result.code.trim().toUpperCase();
          if (!code || seen.has(code)) return [];
          seen.add(code);
          return [{ id: code, label: code, ...(result.description?.trim() ? { detail: result.description.trim() } : {}) }];
        });
      } catch { if (!this.disposed && generation === this.generation) this.error = 'Search is unavailable. Enter a code to use it, or search again.'; }
      finally { if (!this.disposed && generation === this.generation) { this.loading = false; this.notify(); } }
    }, 180);
  }
  cancel() { clearTimeout(this.timer); this.generation++; this.loading = false; }
  dispose() { this.cancel(); this.disposed = true; }
}
