import { computed, signal } from "@angular/core";
import {
  createBillLifecycleClient,
  type BillLifecycleClient,
  type BillLifecycleClientOptions,
  type BillLifecycleData,
  type BrowserBillCreateInput,
  type BillReviewDocumentType,
  type BillReviewSaveInput,
  type CloseBillInput,
  type PostBillPaymentInput,
  type SubmitBillInput,
  type SubmitSecondReviewInput,
} from "@mindbill/browser";

export class MindBillLifecycleStore {
  readonly billId = signal("");
  readonly data = signal<BillLifecycleData | null>(null);
  readonly error = signal<Error | null>(null);
  readonly loading = signal(false);
  readonly mutating = signal(false);
  readonly ready = computed(() => this.data() !== null && !this.loading());
  private client: BillLifecycleClient | null = null;
  private createInput: BrowserBillCreateInput | undefined;
  private onBillCreated: ((billId: string, data: BillLifecycleData) => void) | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  connect(
    options: BillLifecycleClientOptions,
    refreshInterval = 60_000,
    createInput?: BrowserBillCreateInput,
    onBillCreated?: (billId: string, data: BillLifecycleData) => void,
  ): void {
    this.disconnect();
    this.billId.set(options.billId ?? "");
    this.createInput = createInput;
    this.onBillCreated = onBillCreated;
    this.client = createBillLifecycleClient(options);
    void this.refresh();
    if (refreshInterval > 0) {
      this.refreshTimer = setInterval(() => void this.refresh(), refreshInterval);
    }
  }

  disconnect(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    this.client?.clearSession();
    this.client = null;
    this.createInput = undefined;
    this.onBillCreated = undefined;
  }

  async refresh(): Promise<BillLifecycleData | null> {
    if (!this.client) return null;
    this.loading.set(this.data() === null);
    try {
      let data: BillLifecycleData;
      if (!this.client.getBillId()) {
        if (!this.createInput) {
          throw new Error("Pass billId to open a bill or create to start a new one.");
        }
        const created = await this.client.createBill(this.createInput);
        const isNew = !this.billId();
        this.billId.set(created.billId);
        if (isNew) this.onBillCreated?.(created.billId, created.data);
        data = created.data;
      } else {
        data = await this.client.getLifecycle();
      }
      this.data.set(data);
      this.error.set(null);
      return data;
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause : new Error("Bill could not be loaded."));
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  searchClaimsAdministrators(query: string, claimNumber?: string) {
    return this.requireClient().searchClaimsAdministrators(query, claimNumber);
  }
  getDeliveryOptions() { return this.requireClient().getDeliveryOptions(); }
  saveReview(input: BillReviewSaveInput) { return this.mutate(() => this.requireClient().saveReview(input)); }
  submitBill(input: BillReviewSaveInput, submission: SubmitBillInput) { return this.mutate(() => this.requireClient().submitBill(input, submission)); }
  addAttachment(file: File, type: BillReviewDocumentType, description?: string) { return this.mutate(() => this.requireClient().addAttachment(file, type, description)); }
  removeAttachment(id: string) { return this.mutate(() => this.requireClient().removeAttachment(id)); }
  getAttachment(id: string) { return this.requireClient().getAttachment(id); }
  getEor(id: string) { return this.requireClient().getEor(id); }
  closeBill(input: CloseBillInput) { return this.mutate(() => this.requireClient().closeBill(input)); }
  postPayment(input: PostBillPaymentInput) { return this.mutate(() => this.requireClient().postPayment(input)); }
  submitSecondReview(input: SubmitSecondReviewInput) { return this.mutate(() => this.requireClient().submitSecondReview(input)); }

  async startCorrection(): Promise<BillLifecycleData> {
    this.mutating.set(true);
    try {
      const result = await this.requireClient().startCorrection();
      this.billId.set(result.replacementBillId);
      this.data.set(result.data);
      this.error.set(null);
      return result.data;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Correction draft could not be created.");
      this.error.set(error);
      throw error;
    } finally {
      this.mutating.set(false);
    }
  }

  private requireClient(): BillLifecycleClient {
    if (!this.client) throw new Error("Connect the lifecycle store before using it.");
    return this.client;
  }

  private async mutate(task: () => Promise<BillLifecycleData>): Promise<BillLifecycleData> {
    this.mutating.set(true);
    this.error.set(null);
    try {
      const data = await task();
      this.data.set(data);
      return data;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("The billing request could not be completed.");
      this.error.set(error);
      throw error;
    } finally {
      this.mutating.set(false);
    }
  }
}
