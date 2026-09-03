import { computed, signal } from "@angular/core";
import {
  createBillLifecycleClient,
  type BillLifecycleClient,
  type BillLifecycleClientOptions,
  type BillLifecycleData,
  type CloseBillInput,
  type PostBillPaymentInput,
  type ResubmitBillInput,
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
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  connect(
    options: BillLifecycleClientOptions,
    refreshInterval = 60_000,
  ): void {
    this.disconnect();
    this.billId.set(options.billId);
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
  }

  async refresh(): Promise<BillLifecycleData | null> {
    if (!this.client) return null;
    this.loading.set(this.data() === null);
    try {
      const data = await this.client.getLifecycle();
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

  getDeliveryOptions() { return this.requireClient().getDeliveryOptions(); }
  getAttachment(id: string) { return this.requireClient().getAttachment(id); }
  getEor(id: string) { return this.requireClient().getEor(id); }
  closeBill(input: CloseBillInput) { return this.mutate(() => this.requireClient().closeBill(input)); }
  postPayment(input: PostBillPaymentInput) { return this.mutate(() => this.requireClient().postPayment(input)); }
  resubmitBill(input: ResubmitBillInput) { return this.mutate(() => this.requireClient().resubmitBill(input)); }
  submitSecondReview(input: SubmitSecondReviewInput) { return this.mutate(() => this.requireClient().submitSecondReview(input)); }

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
