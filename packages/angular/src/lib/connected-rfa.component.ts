import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createRfaWorkflowClient, type RfaWorkflowClient, type RfaDraftInput, type RfaRecord, type RfaSigningPreview, type RfaDocumentType, type BillLifecycleSessionProvider, type BillClaimsAdministratorDirectory, type RfaAuthorizationDestinationOption, type RfaDecisionItemInput, type RfaTransmissionInput, type RfaAuthorizationContact } from '@mindbill/browser';
import { RfaDraftFormComponent } from './rfa-draft-form.component';
import { MindBillRfaAuthorizationDestinationComponent } from './rfa-authorization-destination.component';
import { mindBillAngularAppearanceStyle, type MindBillAngularAppearance } from './appearance';
import { treatmentDraftKey } from './submission-treatment';
import { canEditRfa, rfaRecordDraft, rfaEditInput, validateRfaDecision, validateRfaTransmission } from './rfa-workflow-state';

/** A host-authorized case document. Bytes are loaded only after an explicit Attach action. */
export type MindBillRfaSourceDocument = {
  id: string;
  label: string;
  filename: string;
  documentType: RfaDocumentType;
  loadBlob: () => Promise<Blob>;
};

type AuthorizationContactFields = { contactName: string; line1: string; city: string; state: string; postalCode: string; phone: string; fax: string; email: string };

type DecisionRow = { itemId: string; description: string; outcome: '' | RfaDecisionItemInput['outcome']; authorizationNumber: string; decisionReason: string; reviewerName: string; reviewerPhone: string; authorizedProcedureCode: string; authorizedQuantity: number | null; authorizedUnits: number | null; effectiveFrom: string; effectiveTo: string };
/** Connected native Angular RFA workflow. Every write is an explicit, separate action. */
@Component({ selector: 'mindbill-connected-rfa', standalone: true, imports: [CommonModule, FormsModule, RfaDraftFormComponent, MindBillRfaAuthorizationDestinationComponent], templateUrl: './connected-rfa.html', styleUrls: ['./connected-rfa.css'] })
export class MindBillConnectedRfaComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) initialDraft!: RfaDraftInput;
  @Input() rfaId: string | null = null;
  @Input() createIdempotencyKey?: string;
  @Input() contextKey = '';
  @Input() sessionEndpoint = '/api/mindbill/session';
  @Input() getSession?: BillLifecycleSessionProvider;
  @Input() apiBaseUrl?: string;
  @Input() client?: RfaWorkflowClient;
  @Input() injuryState = 'CA';
  @Input() claimsAdministratorId?: string;
  @Input() authorizationContact?: RfaAuthorizationContact;
  @Input() actorReference = '';
  @Input() billingProviderId?: string;
  @Input() showList = true;
  @Input() sourceDocuments: MindBillRfaSourceDocument[] = [];
  @Input() appearance?: MindBillAngularAppearance;
  @Output() changed = new EventEmitter<RfaRecord | null>();
  @Output() saved = new EventEmitter<RfaRecord>();
  @Output() rfaSelected = new EventEmitter<RfaRecord>();
  @Output() rfaError = new EventEmitter<Error>();
  @Output() destinationChange = new EventEmitter<RfaAuthorizationDestinationOption | null>();
  record: RfaRecord | null = null; records: RfaRecord[] = []; draft: RfaDraftInput | null = null;
  directory: BillClaimsAdministratorDirectory | null = null; directoryLoading = false; directoryError: string | null = null;
  destination: RfaAuthorizationDestinationOption | null = null;
  loading = false; busy = false; error = ''; notice = ''; dirty = false; reconcileRequired = false;
  preview: RfaSigningPreview | null = null; previewUrl: string | null = null; previewReviewed = false;
  contactFields: AuthorizationContactFields = { contactName: '', line1: '', city: '', state: '', postalCode: '', phone: '', fax: '', email: '' };
  contactConfirmed = false;
  private contactInputKey = '';
  private previewGeneration = 0;
  diagnosisDescriptions: Record<string, string> = {};
  documentType: RfaDocumentType = 'clinical_report'; file: File | null = null; selectedDocuments: Record<string, boolean> = {};
  transmissionDirection: 'outbound' | 'inbound' = 'outbound'; transmissionChannel: RfaTransmissionInput['channel'] = 'fax';
  transmissionStatus: RfaTransmissionInput['status'] = 'sent'; occurredAt = ''; receivedAt = ''; providerMessageId = ''; proofDocumentId = '';
  decidedAt = ''; responseDocumentId = ''; imrDocumentId = ''; decisions: DecisionRow[] = [];
  private workflow!: RfaWorkflowClient; private generation = 0; private inputKey = ''; private previousClient: RfaWorkflowClient | undefined;
  private previousSession: BillLifecycleSessionProvider | undefined; private createKey = '';
  private readonly detector = inject(ChangeDetectorRef);
  get theme() { return mindBillAngularAppearanceStyle(this.appearance); }
  get editable() { return !this.record || canEditRfa(this.record); }
  get blocked() { return this.loading || this.busy || this.reconcileRequired; }
  get currentDocuments() { return this.record?.documents.filter(document => document.contentRevision === this.record?.contentRevision) ?? []; }
  get canSign() { return !!this.record && this.editable && !this.dirty && !this.blocked && !!this.preview && this.preview.contentRevision === this.record.contentRevision && this.preview.renderingProviderId === this.record.renderingProviderId && Date.parse(this.preview.expiresAt) > Date.now() && this.previewReviewed && !!this.actorReference.trim(); }
  ngOnChanges() {
    if (!this.initialDraft) return;
    const contactKey = treatmentDraftKey(this.authorizationContact ?? null);
    if (contactKey !== this.contactInputKey) { this.contactInputKey = contactKey; this.resetContact(); this.clearPreview(); }
    const key = treatmentDraftKey({ context: this.contextKey, draft: this.initialDraft, id: this.rfaId, endpoint: this.sessionEndpoint, base: this.apiBaseUrl, injuryState: this.injuryState, payer: this.claimsAdministratorId, createKey: this.createIdempotencyKey, actor: this.actorReference, billingProvider: this.billingProviderId });
    if (key === this.inputKey && this.client === this.previousClient && this.getSession === this.previousSession) return;
    this.inputKey = key; this.previousClient = this.client; this.previousSession = this.getSession;
    this.workflow?.clearSession(); this.generation++; this.reset();
    this.workflow = this.client ?? createRfaWorkflowClient({ sessionEndpoint: this.sessionEndpoint, ...(this.getSession ? { getSession: this.getSession } : {}), ...(this.apiBaseUrl ? { apiBaseUrl: this.apiBaseUrl } : {}) });
    this.createKey = this.createIdempotencyKey ?? globalThis.crypto.randomUUID(); void this.reload();
  }
  ngOnDestroy() { this.generation++; this.workflow?.clearSession(); this.clearPreview(); }
  private reset() { this.record = null; this.records = []; this.draft = null; this.directory = null; this.destination = null; this.directoryError = null; this.dirty = false; this.busy = false; this.error = ''; this.notice = ''; this.reconcileRequired = false; this.clearPreview(); this.clearEvidence(); this.resetContact(); }
  private clearEvidence() { this.file = null; this.selectedDocuments = {}; this.occurredAt = ''; this.receivedAt = ''; this.providerMessageId = ''; this.proofDocumentId = ''; this.decidedAt = ''; this.responseDocumentId = ''; this.imrDocumentId = ''; this.decisions = []; }
  invalidatePreview() { this.clearPreview(); }
  private clearPreview() { this.previewGeneration++; if (this.previewUrl) URL.revokeObjectURL(this.previewUrl); this.previewUrl = null; this.preview = null; this.previewReviewed = false; }
  draftChanged(dirty: boolean) { this.dirty = dirty; if (dirty) this.clearPreview(); }
  async reload() {
    if (this.busy) return;
    const generation = ++this.generation; this.loading = true; this.error = ''; this.clearPreview();
    try {
      const records: RfaRecord[] = []; let cursor: string | undefined;
      do { const page = await this.workflow.list({ claimId: this.initialDraft.claimId, ...(cursor ? { cursor } : {}), limit: 100 }); if (generation !== this.generation) return; records.push(...page.data); cursor = page.nextCursor ?? undefined; } while (cursor);
      const id = this.rfaId ?? this.record?.id;
      const record = id ? await this.workflow.get(id) : records.find(item => !!this.initialDraft.externalId && item.externalId === this.initialDraft.externalId) ?? null;
      if (generation !== this.generation) return;
      if (record && (record.claimId !== this.initialDraft.claimId || record.patientId !== this.initialDraft.patientId || record.renderingProviderId !== this.initialDraft.renderingProviderId)) throw new Error('The saved request does not belong to this case and rendering provider.');
      this.records = records; this.reconcileRequired = false; this.accept(record); this.notice = 'Loaded the latest saved state.';
      void this.loadDirectory(generation);
    } catch (error) { if (generation === this.generation) { this.reconcileRequired = true; this.fail(error); } }
    finally { if (generation === this.generation) { this.loading = false; this.detector.markForCheck(); } }
  }
  async select(id: string) {
    if (this.blocked || this.dirty) return;
    const generation = ++this.generation; this.loading = true;
    try { const record = await this.workflow.get(id); if (generation !== this.generation) return; if (record.claimId !== this.initialDraft.claimId || record.patientId !== this.initialDraft.patientId || record.renderingProviderId !== this.initialDraft.renderingProviderId) throw new Error('This request belongs to a different case or provider.'); this.accept(record); this.rfaSelected.emit(record); void this.loadDirectory(generation); }
    catch (error) { if (generation === this.generation) this.fail(error); }
    finally { if (generation === this.generation) { this.loading = false; this.detector.markForCheck(); } }
  }
  private accept(record: RfaRecord | null) {
    this.record = record; this.draft = record ? rfaRecordDraft(record) : structuredClone(this.initialDraft); this.dirty = false; this.clearPreview(); this.clearEvidence(); this.diagnosisDescriptions = {};
    this.decisions = record?.items.map(item => ({ itemId: item.id, description: item.serviceDescription, outcome: '', authorizationNumber: '', decisionReason: '', reviewerName: '', reviewerPhone: '', authorizedProcedureCode: '', authorizedQuantity: null, authorizedUnits: null, effectiveFrom: '', effectiveTo: '' })) ?? [];
    this.changed.emit(record);
    if (record) this.records = [record, ...this.records.filter(item => item.id !== record.id)];
  }
  private async loadDirectory(generation: number) {
    this.directory = null; this.destination = null; this.directoryError = null;
    const payerId = this.claimsAdministratorId;
    if (!payerId) { this.directoryError = 'No claims administrator selected.'; return; }
    this.directoryLoading = true;
    try { const directory = await this.workflow.getDirectory(payerId, this.injuryState); if (generation === this.generation) this.directory = directory; }
    catch { if (generation === this.generation) this.directoryError = 'Could not load authorization contacts.'; }
    finally { if (generation === this.generation) { this.directoryLoading = false; this.detector.markForCheck(); } }
  }
  setDestination(value: RfaAuthorizationDestinationOption | null) { if (this.hasContactFields && treatmentDraftKey(this.destination) !== treatmentDraftKey(value)) this.contactConfirmed = false; this.clearPreview(); this.destination = value; if (value) this.transmissionChannel = value.method; this.destinationChange.emit(value); }
  private resetContact() {
    const contact = this.authorizationContact;
    this.contactFields = { contactName: contact?.contactName ?? '', line1: contact?.address?.line1 ?? '', city: contact?.address?.city ?? '', state: contact?.address?.state ?? '', postalCode: contact?.address?.postalCode ?? '', phone: contact?.phone ?? '', fax: contact?.fax ?? '', email: contact?.email ?? '' };
    this.contactConfirmed = this.hasContactFields;
  }
  get hasContactFields() { return Object.values(this.contactFields).some(value => !!value.trim()); }
  get previewContactMissing() { return (this.hasContactFields && !this.contactConfirmed) || (!!this.claimsAdministratorId && !this.destination && !(this.contactConfirmed && this.hasContactFields)); }
  setContactField(field: keyof AuthorizationContactFields, value: string) { this.contactFields[field] = value; this.contactConfirmed = false; this.clearPreview(); }
  confirmContact(confirmed: boolean) { this.contactConfirmed = confirmed; this.clearPreview(); }
  get previewAuthorizationContact(): RfaAuthorizationContact | undefined {
    const fields = this.contactFields;
    const contact: RfaAuthorizationContact = {};
    for (const key of ['contactName', 'phone', 'fax', 'email'] as const) if (fields[key].trim()) contact[key] = fields[key].trim();
    if (fields.line1.trim()) {
      contact.address = { line1: fields.line1.trim() };
      for (const key of ['city', 'state', 'postalCode'] as const) if (fields[key].trim()) contact.address[key] = fields[key].trim();
    }
    // A selected authorization route wins over a separately entered fax/email value.
    if (this.destination) {
      contact[this.destination.method] = this.destination.destination;
      if (this.destination.phone) contact.phone = this.destination.phone;
      if (!contact.contactName) contact.contactName = this.destination.label;
    }
    return Object.keys(contact).length ? contact : undefined;
  }
  private fail(error: unknown) { this.error = error instanceof Error ? error.message : 'The request could not be completed.'; this.rfaError.emit(error instanceof Error ? error : new Error(this.error)); }
  private async mutation(action: () => Promise<RfaRecord>, message: string): Promise<RfaRecord> {
    if (this.blocked) throw new Error('Reload the current request before another change.');
    const generation = this.generation; this.busy = true; this.error = ''; this.notice = '';
    try { const record = await action(); if (generation !== this.generation) throw new Error('The case changed while the request was saving.'); this.accept(record); this.saved.emit(record); this.notice = message; return record; }
    catch (error) { if (generation === this.generation) { this.reconcileRequired = true; this.fail(error); } throw error; }
    finally { if (generation === this.generation) { this.busy = false; this.detector.markForCheck(); } }
  }
  saveDraft = async (draft: RfaDraftInput) => {
    if (!this.editable) throw new Error('Signed or submitted requests cannot be edited.');
    return this.mutation(() => this.record ? this.workflow.updateDraft(this.record.id, rfaEditInput(draft, this.record.contentRevision), { idempotencyKey: crypto.randomUUID() }) : this.workflow.create(draft, { idempotencyKey: this.createKey }), 'Unsigned draft saved.');
  };
  async preparePreview() {
    const record = this.record; if (!record || this.blocked || this.dirty || !this.editable) return;
    if (this.previewContactMissing) { this.error = 'Choose an authorization office above, or enter and confirm the verified case contact before preparing the preview.'; return; }
    if (!this.contactFields.line1.trim() && [this.contactFields.city, this.contactFields.state, this.contactFields.postalCode].some(value => value.trim())) { this.error = 'Enter the verified street address, or clear the incomplete postal address.'; return; }
    if (record.items.some(item => !this.diagnosisDescriptions[item.id]?.trim())) { this.error = 'Enter a diagnosis description for every requested service.'; return; }
    const generation = this.generation; this.busy = true; this.error = ''; this.clearPreview();
    const previewGeneration = this.previewGeneration;
    const authorizationContact = this.previewAuthorizationContact;
    try {
      const preview = await this.workflow.signingPreview(record.id, { diagnosisDescriptions: { ...this.diagnosisDescriptions }, ...(this.billingProviderId ? { billingProviderId: this.billingProviderId } : {}), ...(authorizationContact ? { authorizationContact } : {}) }, { idempotencyKey: crypto.randomUUID() });
      if (generation !== this.generation || previewGeneration !== this.previewGeneration) return;
      const pdf = await this.workflow.downloadDocument(record.id, preview.previewDocumentId);
      if (generation !== this.generation || previewGeneration !== this.previewGeneration) return;
      if (preview.contentRevision !== record.contentRevision) throw new Error('The request changed. Reload before preparing a preview.');
      this.preview = preview; this.previewUrl = URL.createObjectURL(pdf);
    } catch (error) { if (generation === this.generation && previewGeneration === this.previewGeneration) { this.reconcileRequired = true; this.fail(error); } }
    finally { if (generation === this.generation) { this.busy = false; this.detector.markForCheck(); } }
  }
  async sign() {
    if (!this.canSign || !this.record || !this.preview) return;
    const record = this.record, preview = this.preview;
    try { await this.mutation(() => this.workflow.sign(record.id, { snapshotId: preview.id, contentHash: preview.contentHash, renderingProviderId: preview.renderingProviderId, physicianAuthorized: true, actorReference: this.actorReference }, { idempotencyKey: crypto.randomUUID() }), 'Request signed. No delivery was initiated.'); } catch { /* surfaced by mutation */ }
  }
  async attachSource(source: MindBillRfaSourceDocument) {
    if (!this.record || this.blocked || this.dirty) return;
    const record = this.record, generation = this.generation, workflow = this.workflow;
    try {
      await this.mutation(async () => {
        const file = await source.loadBlob();
        if (generation !== this.generation) throw new Error('The case changed before the document was attached.');
        if (file.size < 1 || file.size > 25 * 1024 * 1024 || !source.filename.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF between 1 byte and 25 MB.');
        return workflow.uploadDocument(record.id, { file, filename: source.filename, documentType: source.documentType, contentRevision: record.contentRevision }, { idempotencyKey: crypto.randomUUID() });
      }, 'Case document attached.');
    } catch { /* surfaced by mutation; stale case results are discarded */ }
  }
  chooseFile(event: Event) { this.file = (event.target as HTMLInputElement).files?.[0] ?? null; }
  async upload() {
    if (!this.record || !this.file || this.blocked || this.dirty) return;
    const record = this.record, file = this.file;
    if (file.size < 1 || file.size > 25 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf')) { this.error = 'Choose a PDF between 1 byte and 25 MB.'; return; }
    try { await this.mutation(() => this.workflow.uploadDocument(record.id, { file, filename: file.name, documentType: this.documentType, contentRevision: record.contentRevision }, { idempotencyKey: crypto.randomUUID() }), 'Document uploaded.'); } catch { /* surfaced */ }
  }
  private download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
  async packet() {
    if (!this.record || this.blocked || this.dirty) return;
    const documentIds = this.currentDocuments.filter(item => this.selectedDocuments[item.id]).map(item => item.id);
    const selected = this.currentDocuments.filter(item => documentIds.includes(item.id));
    if (!this.record.signedAt || selected.length < 2 || !selected.some(item => item.documentType === 'rfa_form') || !selected.some(item => item.documentType === 'clinical_report')) { this.error = 'Select the signed RFA form and at least one current clinical report for the packet.'; return; }
    const generation = this.generation; this.busy = true;
    try { const pdf = await this.workflow.downloadPacket(this.record.id, { documentIds }); if (generation === this.generation) this.download(pdf, 'rfa-packet.pdf'); }
    catch (error) { if (generation === this.generation) this.fail(error); }
    finally { if (generation === this.generation) { this.busy = false; this.detector.markForCheck(); } }
  }
  private isoTime(value: string) { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : ''; }
  async recordTransmission() {
    if (!this.record || this.blocked || this.dirty) return;
    const input: RfaTransmissionInput = { direction: this.transmissionDirection, channel: this.transmissionChannel, status: this.transmissionStatus, occurredAt: this.isoTime(this.occurredAt), ...(this.destination ? { destination: this.destination.destination } : {}), ...(this.providerMessageId.trim() ? { providerMessageId: this.providerMessageId.trim() } : {}), ...(this.proofDocumentId ? { proofDocumentId: this.proofDocumentId } : {}), ...(this.receivedAt ? { receivedAt: this.isoTime(this.receivedAt) } : {}) };
    if (input.direction === 'outbound' && this.destination && input.channel !== this.destination.method) { this.error = 'The recorded delivery channel must match the confirmed authorization destination.'; return; }
    const error = validateRfaTransmission(input); if (error) { this.error = error; return; }
    const record = this.record;
    try { await this.mutation(() => this.workflow.recordTransmission(record.id, input, { idempotencyKey: crypto.randomUUID() }), 'External delivery evidence recorded.'); } catch { /* surfaced */ }
  }
  async recordDecision() {
    if (!this.record || this.blocked || this.dirty) return;
    const decisions: RfaDecisionItemInput[] = this.decisions.flatMap(row => row.outcome ? [{ itemId: row.itemId, outcome: row.outcome, ...(row.authorizationNumber.trim() ? { authorizationNumber: row.authorizationNumber.trim() } : {}), ...(row.decisionReason.trim() ? { decisionReason: row.decisionReason.trim() } : {}), ...(row.reviewerName.trim() ? { reviewerName: row.reviewerName.trim() } : {}), ...(row.reviewerPhone.trim() ? { reviewerPhone: row.reviewerPhone.trim() } : {}), ...(row.authorizedProcedureCode.trim() ? { authorizedProcedureCode: row.authorizedProcedureCode.trim() } : {}), ...(row.authorizedQuantity !== null ? { authorizedQuantity: row.authorizedQuantity } : {}), ...(row.authorizedUnits !== null ? { authorizedUnits: row.authorizedUnits } : {}), ...(row.effectiveFrom ? { effectiveFrom: row.effectiveFrom } : {}), ...(row.effectiveTo ? { effectiveTo: row.effectiveTo } : {}) }] : []);
    const input = { decidedAt: this.isoTime(this.decidedAt), responseDocumentId: this.responseDocumentId, ...(this.imrDocumentId ? { imrDocumentId: this.imrDocumentId } : {}), decisions };
    const error = validateRfaDecision(input); if (error) { this.error = error; return; }
    const record = this.record;
    try { await this.mutation(() => this.workflow.recordDecision(record.id, input, { idempotencyKey: crypto.randomUUID() }), 'Item decisions recorded from the UR response.'); } catch { /* surfaced */ }
  }
}
