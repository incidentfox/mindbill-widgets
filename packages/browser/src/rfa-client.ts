import type { BillClaimsAdministratorDirectory, BillLifecycleSession, BillLifecycleSessionProvider } from './index';

export type RfaStatus = 'draft'|'ready'|'submitted'|'received'|'incomplete'|'under_review'|'information_requested'|'deferred'|'approved'|'modified'|'denied'|'mixed'|'canceled'|'closed';
export type RfaDocumentType = 'rfa_form'|'clinical_report'|'supporting_record'|'ur_response'|'imr_form'|'fax_cover'|'other';
export type RfaDraftItemInput = {
  id?: string; externalId?: string; diagnosisCode: string; serviceDescription: string; procedureCode?: string;
  quantity?: number; units?: number; frequency?: string; duration?: string; requestedFrom?: string; requestedTo?: string;
  metadata?: Record<string, unknown>;
};
/** Unsigned content only. Signing is a separate explicit API operation. */
export type RfaDraftInput = {
  claimId: string; patientId: string; renderingProviderId: string; employeeName: string; providerName: string;
  externalId?: string; claimsAdminId?: string; requestType?: 'new'|'resubmission_material_change'|'oral_authorization_confirmation';
  reviewType?: 'prospective'|'concurrent'|'retrospective'; expedited?: boolean; placeOfServiceCode?: string;
  providerNpi?: string; providerPhone?: string; providerFax?: string; claimNumber?: string; dateOfInjury?: string;
  rationale?: string; materialChange?: string; items: RfaDraftItemInput[]; metadata?: Record<string, unknown>;
};
export type RfaEditDraftInput = Omit<RfaDraftInput,'claimId'|'patientId'|'renderingProviderId'|'externalId'> & { expectedRevision: number };
export type RfaDocument = { id:string; documentType:RfaDocumentType; filename:string; sha256:string; sizeBytes:number; createdAt:string; contentUrl:string; contentRevision:number };
export type RfaItem = { [K in keyof RfaDraftItemInput]: RfaDraftItemInput[K] | null } & {
  id:string; ordinal:number; diagnosisCode:string; serviceDescription:string; outcome:'pending'|'approved'|'modified'|'denied';
  authorizationNumber?:string|null; authorizedProcedureCode?:string|null; authorizedQuantity?:number|null; authorizedUnits?:number|null;
  effectiveFrom?:string|null; effectiveTo?:string|null; decisionReason?:string|null; reviewerName?:string|null; reviewerPhone?:string|null;
  decidedAt?:string|null; currentDecisionEventId?:string|null; currentResponseDocumentId?:string|null; currentImrDocumentId?:string|null;
};
export type RfaTransmissionInput = {
  direction:'outbound'|'inbound'; channel:'fax'|'email'|'edi'|'portal'|'mail'|'manual'; status:'queued'|'sent'|'delivered'|'received'|'failed';
  occurredAt:string; destination?:string; providerMessageId?:string; proofDocumentId?:string; receivedAt?:string;
  nonBusinessDates?:string[]; metadata?:Record<string,unknown>;
};
export type RfaTransmission = Omit<RfaTransmissionInput,'destination'|'providerMessageId'|'proofDocumentId'|'receivedAt'> & {
  id:string; createdAt:string; destination?:string|null; providerMessageId?:string|null; proofDocumentId?:string|null; receivedAt?:string|null;
  purpose:'submission'|'forward'; packetId:string|null;
};
export type RfaDecisionItemInput = {
  itemId:string; outcome:'approved'|'modified'|'denied'; authorizationNumber?:string; authorizedProcedureCode?:string;
  authorizedQuantity?:number; authorizedUnits?:number; effectiveFrom?:string; effectiveTo?:string; decisionReason?:string;
  reviewerName?:string; reviewerPhone?:string;
};
export type RfaDecisionInput = { decidedAt:string; responseDocumentId:string; imrDocumentId?:string; decisions:RfaDecisionItemInput[] };
export type RfaRecord = Omit<{ [K in keyof RfaDraftInput]: RfaDraftInput[K] | null },'items'> & {
  id:string; claimId:string; patientId:string; renderingProviderId:string; employeeName:string; providerName:string;
  status:RfaStatus; contentRevision:number; items:RfaItem[]; documents:RfaDocument[]; transmissions:RfaTransmission[];
  readiness:{ready:boolean;missing:string[]}; signedAt?:string|null; submittedAt?:string|null; receivedAt?:string|null;
  decidedAt?:string|null; decisionDueAt?:string|null; decisionDeadlineBasis?:string|null; createdAt:string; updatedAt:string;
  events:{id:string;type:string;occurredAt:string}[];
};
export type RfaSigningPreview = { id:string; contentHash:string; contentRevision:number; renderingProviderId:string; previewDocumentId:string; expiresAt:string };
/** Confirmed request-specific contact. Never substitute a bill-review destination. */
export type RfaAuthorizationContact = {
  contactName?:string;
  address?:{line1:string;city?:string;state?:string;postalCode?:string};
  phone?:string;fax?:string;email?:string;
};
export type RfaFormInput = { diagnosisDescriptions:Record<string,string>; billingProviderId?:string; authorizationContact?:RfaAuthorizationContact };
export type RfaSignInput = { snapshotId:string; contentHash:string; renderingProviderId:string; physicianAuthorized:true; actorReference:string };
export type RfaRequestOptions = { idempotencyKey?:string };
export type RfaListInput = { claimId?:string; renderingProviderId?:string; status?:RfaStatus; createdFrom?:string; createdTo?:string; cursor?:string; limit?:number };
export type RfaListResult = { data:RfaRecord[]; nextCursor:string|null; summary?:{total:number;byStatus:Partial<Record<RfaStatus,number>>} };
export type RfaWorkflowClient = {
  clearSession():void;
  list(input?:RfaListInput):Promise<RfaListResult>;
  get(id:string):Promise<RfaRecord>;
  create(draft:RfaDraftInput,options?:RfaRequestOptions):Promise<RfaRecord>;
  updateDraft(id:string,draft:RfaEditDraftInput,options?:RfaRequestOptions):Promise<RfaRecord>;
  copy(id:string,expectedRevision:number,options?:RfaRequestOptions):Promise<RfaRecord>;
  getDirectory(payerId:string,injuryState?:string):Promise<BillClaimsAdministratorDirectory>;
  signingPreview(id:string,input:RfaFormInput,options?:RfaRequestOptions):Promise<RfaSigningPreview>;
  sign(id:string,input:RfaSignInput,options?:RfaRequestOptions):Promise<RfaRecord>;
  uploadDocument(id:string,input:{file:Blob;filename:string;documentType:RfaDocumentType;contentRevision:number},options?:RfaRequestOptions):Promise<RfaRecord>;
  downloadDocument(id:string,documentId:string):Promise<Blob>;
  downloadPacket(id:string,input:{documentIds:string[]}):Promise<Blob>;
  recordTransmission(id:string,input:RfaTransmissionInput,options?:RfaRequestOptions):Promise<RfaRecord>;
  recordDecision(id:string,input:RfaDecisionInput,options?:RfaRequestOptions):Promise<RfaRecord>;
};
export type RfaWorkflowClientOptions = {
  sessionEndpoint?:string; getSession?:BillLifecycleSessionProvider; apiBaseUrl?:string; fetch?:typeof globalThis.fetch;
};
export class RfaWorkflowError extends Error {
  constructor(message:string,public readonly status:number,public readonly code:string,public readonly outcomeUncertain=false) { super(message); this.name='RfaWorkflowError'; }
}
const editableFields = ['claimsAdminId','requestType','reviewType','expedited','employeeName','providerName','placeOfServiceCode','providerNpi','providerPhone','providerFax','claimNumber','dateOfInjury','rationale','materialChange','items','metadata'];
function draftPayload(input:RfaDraftInput|RfaEditDraftInput,create:boolean):Record<string,unknown> {
  const fields=[...editableFields,...(create?['claimId','patientId','renderingProviderId','externalId']:['expectedRevision'])];
  const result=Object.fromEntries(fields.flatMap(key=>{const value=(input as unknown as Record<string,unknown>)[key];return value===undefined?[]:[[key,value]];}));
  const itemFields=['diagnosisCode','serviceDescription','procedureCode','quantity','units','frequency','duration','requestedFrom','requestedTo','metadata',create?'externalId':'id'];
  result['items']=input.items.map(item=>Object.fromEntries(itemFields.flatMap(key=>{const value=(item as unknown as Record<string,unknown>)[key];return value===undefined||value===null?[]:[[key,value]];})));
  return result;
}
function normalizedSession(body:unknown):BillLifecycleSession {
  if (!body || typeof body!=='object') throw new RfaWorkflowError('The RFA session is unavailable.',401,'session_unavailable');
  const envelope=body as Record<string,unknown>;
  if (envelope['data'] || envelope['session']) return normalizedSession(envelope['data']??envelope['session']);
  if (typeof envelope['token']!=='string' || !envelope['token'].startsWith('mbes_')) throw new RfaWorkflowError('Use a short-lived browser session for RFA access.',401,'invalid_session');
  return {token:envelope['token'],...(typeof envelope['expiresAt']==='string'?{expiresAt:envelope['expiresAt']}:{}),...(typeof envelope['apiBaseUrl']==='string'?{apiBaseUrl:envelope['apiBaseUrl']}:{})};
}
/** Uses origin-bound, organization-wide browser sessions. No automatic mutation retries after ambiguous failures. */
export function createRfaWorkflowClient(options:RfaWorkflowClientOptions):RfaWorkflowClient {
  const fetcher=options.fetch??globalThis.fetch;
  if (!fetcher) throw new Error('A fetch implementation is required.');
  let session:BillLifecycleSession|null=null, pending:Promise<BillLifecycleSession>|null=null, generation=0;
  async function mint(force=false):Promise<BillLifecycleSession> {
    if (force) session=null;
    if (session && (!session.expiresAt || Date.parse(session.expiresAt)>Date.now()+30000)) return session;
    if (pending) return pending;
    const currentGeneration=generation;
    const request=(async()=>{
      const signal=new AbortController().signal;
      const raw=options.getSession?await options.getSession({signal}):await (async()=>{
        if (!options.sessionEndpoint) throw new RfaWorkflowError('Configure an authenticated RFA session endpoint.',401,'session_unavailable');
        const response=await fetcher(options.sessionEndpoint,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}',signal});
        if (!response.ok) throw new RfaWorkflowError('The RFA session could not be created. Sign in and check your permissions.',response.status,'session_unavailable');
        return response.json();
      })();
      if(currentGeneration!==generation)throw new RfaWorkflowError('The RFA context changed. Reload before continuing.',409,'context_changed');
      session=normalizedSession(raw); return session;
    })().finally(()=>{if(pending===request)pending=null;});
    pending=request;return request;
  }
  async function request(path:string,init:RequestInit={},options:RfaRequestOptions={},mutation=false):Promise<Response> {
    const headers=new Headers(init.headers);
    if (mutation) headers.set('idempotency-key',options.idempotencyKey??globalThis.crypto.randomUUID());
    const perform=async(active:BillLifecycleSession)=>{
      headers.set('authorization',`Bearer ${active.token}`);
      return fetcher((active.apiBaseUrl??clientBase).replace(/\/$/,'')+'/partner/v2'+path,{...init,headers,credentials:'omit'});
    };
    let response:Response;
    try { response=await perform(await mint()); if (response.status===401) response=await perform(await mint(true)); }
    catch(cause) { if (cause instanceof RfaWorkflowError) throw cause; throw new RfaWorkflowError(mutation?'The request outcome is uncertain. Reload saved state before retrying.':'Could not reach the RFA service.',0,'network_error',mutation); }
    if (!response.ok) {
      const problem=await response.json().catch(()=>({})) as {type?:unknown;code?:unknown};
      const candidate=typeof problem.code==='string'?problem.code:typeof problem.type==='string'?problem.type.split('/').pop():'';
      const code=candidate && /^[a-z0-9_-]{1,100}$/.test(candidate)?candidate:'request_failed';
      const message=response.status===409?'This request changed or an earlier action is pending. Reload before continuing.':response.status===403?'RFA access is unavailable. Check organization capabilities and session permissions.':response.status===422?'The request needs attention. Check its readiness, required fields, and evidence.':'The RFA request could not be completed.';
      throw new RfaWorkflowError(`${message} (${code})`,response.status,code,mutation&&response.status>=500);
    }
    return response;
  }
  const clientBase=options.apiBaseUrl??'https://app.mindbill.org';
  const route=(id:string)=>'/rfas/'+encodeURIComponent(id);
  async function data<T>(path:string,method='GET',body?:unknown,opts?:RfaRequestOptions):Promise<T> {
    const response=await request(path,{method,...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})},opts,method!=='GET');
    const result=await response.json() as {data?:T};
    if (!result || result.data===undefined) throw new RfaWorkflowError('The RFA service returned an invalid result. Reload saved state.',502,'invalid_response',method!=='GET');
    return result.data;
  }
  async function pdf(path:string,body?:unknown):Promise<Blob> {
    const response=await request(path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/pdf')) throw new RfaWorkflowError('The service did not return a PDF.',502,'invalid_document');
    const blob=await response.blob(); if (!blob.size) throw new RfaWorkflowError('The PDF is empty.',502,'invalid_document'); return blob;
  }
  return {
    clearSession() { generation++;session=null;pending=null; },
    async list(input={}) {const params=new URLSearchParams(); for(const [key,value] of Object.entries(input)) if(value!==undefined)params.set(key,String(value));const response=await request('/rfas'+(params.size?'?'+params:''));const result=await response.json() as RfaListResult;if(!Array.isArray(result.data))throw new RfaWorkflowError('The RFA list could not be read.',502,'invalid_response');return result;},
    get:id=>data(route(id)),
    create:(draft,opts)=>data('/rfas','POST',draftPayload(draft,true),opts),
    updateDraft:(id,draft,opts)=>data(route(id)+'/draft','PATCH',draftPayload(draft,false),opts),
    copy:(id,expectedRevision,opts)=>data(route(id)+'/copy','POST',{expectedRevision},opts),
    getDirectory:(payerId,injuryState='CA')=>data('/claims-administrators/'+encodeURIComponent(payerId)+'?'+new URLSearchParams({injuryState})),
    signingPreview:(id,input,opts)=>data(route(id)+'/signing-preview','POST',input,opts),
    sign:(id,input,opts)=>data(route(id)+'/sign','POST',input,opts),
    async uploadDocument(id,input,opts) {
      if (!input.file.size || input.file.size>25*1024*1024) throw new RfaWorkflowError('Choose a PDF between 1 byte and 25 MB.',422,'invalid_document');
      const form=new FormData();form.set('file',input.file,input.filename);form.set('documentType',input.documentType);form.set('contentRevision',String(input.contentRevision));
      const response=await request(route(id)+'/documents',{method:'POST',body:form},opts,true);const body=await response.json() as {data:RfaRecord};if(!body.data?.id)throw new RfaWorkflowError('Reload the request to check the uploaded document.',502,'invalid_response',true);return body.data;
    },
    downloadDocument:(id,documentId)=>pdf(route(id)+'/documents/'+encodeURIComponent(documentId)),
    downloadPacket:(id,input)=>pdf(route(id)+'/packet',input),
    recordTransmission:(id,input,opts)=>data(route(id)+'/transmissions','POST',input,opts),
    recordDecision:(id,input,opts)=>data(route(id)+'/decisions','POST',input,opts),
  };
}
