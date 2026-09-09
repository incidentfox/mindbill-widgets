import { describe, expect, it, vi } from 'vitest';
import { createRfaWorkflowClient, RfaWorkflowError, type RfaDraftInput } from '../packages/browser/src/rfa-client';
const draft:RfaDraftInput={claimId:'claim-synthetic',patientId:'patient-synthetic',renderingProviderId:'provider-synthetic',employeeName:'Synthetic Worker',providerName:'Synthetic Physician',items:[{diagnosisCode:'M25.531',serviceDescription:'Synthetic treatment'}]};
const session={token:'mbes_synthetic',apiBaseUrl:'https://api.example.test'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
describe('RFA browser workflow client',()=>{
  it('passes only explicitly supplied authorization contact with the signing preview',async()=>{
    const fetcher=vi.fn().mockImplementation(async()=>json({data:{id:'snapshot-synthetic'}}));
    const client=createRfaWorkflowClient({getSession:async()=>session,fetch:fetcher});
    const authorizationContact={contactName:'Synthetic handling office',phone:'555-555-0100',fax:'+14155550100',address:{line1:'100 Example Street',city:'Sacramento',state:'CA',postalCode:'95814'}};
    await client.signingPreview('rfa-synthetic',{diagnosisDescriptions:{'item-synthetic':'Wrist pain'},authorizationContact});
    expect(JSON.parse(fetcher.mock.calls[0]![1].body).authorizationContact).toEqual(authorizationContact);
    await client.signingPreview('rfa-synthetic',{diagnosisDescriptions:{'item-synthetic':'Wrist pain'}});
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).not.toHaveProperty('authorizationContact');
  });
  it('coalesces origin-bound session minting and preserves list cursor',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{void init;return String(input)==='/api/rfa-session'?json(session):String(input).includes('?')?json({data:[],nextCursor:'opaque-next'}):json({data:{id:'rfa-synthetic'}});});
    const client=createRfaWorkflowClient({sessionEndpoint:'/api/rfa-session',fetch:fetcher});
    const [list]=await Promise.all([client.list({claimId:'claim/one',cursor:'opaque+cursor'}),client.get('rfa-synthetic')]);
    expect(fetcher.mock.calls.filter(([url])=>url==='/api/rfa-session')).toHaveLength(1);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({method:'POST',credentials:'same-origin'});
    expect(list.nextCursor).toBe('opaque-next');
    const api=fetcher.mock.calls.find(([url])=>String(url).includes('?'))!;
    expect(String(api[0])).toContain('claimId=claim%2Fone&cursor=opaque%2Bcursor');
    expect(new Headers(api[1]?.headers).get('authorization')).toBe('Bearer mbes_synthetic');
    expect(api[1]?.credentials).toBe('omit');
  });
  it('refreshes a rejected session once with the same mutation key and strips signing state from drafts',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({},401)).mockResolvedValueOnce(json({data:{id:'rfa-synthetic'}}));
    const getSession=vi.fn().mockResolvedValueOnce(session).mockResolvedValueOnce({...session,token:'mbes_fresh'});
    const client=createRfaWorkflowClient({getSession,fetch:fetcher});
    await client.create({...draft,signedAt:'forbidden',items:[{...draft.items[0]!,id:'old-item',outcome:'approved'}]} as unknown as RfaDraftInput,{idempotencyKey:'request-stable'});
    expect(getSession).toHaveBeenCalledTimes(2);expect(fetcher).toHaveBeenCalledTimes(2);
    for(const [,init] of fetcher.mock.calls){expect(new Headers(init.headers).get('idempotency-key')).toBe('request-stable');const payload=JSON.parse(init.body);expect(payload.signedAt).toBeUndefined();expect(payload.items[0].id).toBeUndefined();expect(payload.items[0].outcome).toBeUndefined();}
  });
  it('does not replay uncertain writes and preserves revision and retained item IDs on updates',async()=>{
    const fetcher=vi.fn().mockRejectedValue(new TypeError('network'));
    const client=createRfaWorkflowClient({getSession:async()=>session,fetch:fetcher});
    await expect(client.updateDraft('rfa/synthetic',{...draft,expectedRevision:4,items:[{...draft.items[0]!,id:'keep-item',externalId:'omit-on-edit'}]},{idempotencyKey:'edit-stable'})).rejects.toMatchObject({outcomeUncertain:true,status:0});
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url,init]=fetcher.mock.calls[0]!;expect(url).toContain('/rfas/rfa%2Fsynthetic/draft');
    const payload=JSON.parse(init.body);expect(payload.expectedRevision).toBe(4);expect(payload.claimId).toBeUndefined();expect(payload.items[0].id).toBe('keep-item');expect(payload.items[0].externalId).toBeUndefined();
  });
  it('uploads multipart with no incorrect JSON content type and downloads only PDF responses',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({data:{id:'rfa-synthetic'}})).mockResolvedValueOnce(json({data:'not-pdf'}));
    const client=createRfaWorkflowClient({getSession:async()=>session,fetch:fetcher});
    await client.uploadDocument('rfa-synthetic',{file:new Blob(['%PDF-synthetic'],{type:'application/pdf'}),filename:'synthetic.pdf',documentType:'clinical_report',contentRevision:2});
    const init=fetcher.mock.calls[0]![1];expect(new Headers(init.headers).has('content-type')).toBe(false);expect(init.body).toBeInstanceOf(FormData);expect(init.body.get('contentRevision')).toBe('2');
    await expect(client.downloadDocument('rfa-synthetic','doc-synthetic')).rejects.toBeInstanceOf(RfaWorkflowError);
  });
  it('rejects permanent credentials and invalidates pending session when context changes',async()=>{
    const fetcher=vi.fn();const unsafe=createRfaWorkflowClient({getSession:async()=>({token:'mbp_sandbox_synthetic'}),fetch:fetcher});
    await expect(unsafe.get('rfa-synthetic')).rejects.toMatchObject({code:'invalid_session'});expect(fetcher).not.toHaveBeenCalled();
    let complete!:(s:typeof session)=>void;
    const client=createRfaWorkflowClient({getSession:()=>new Promise(resolve=>{complete=resolve;}),fetch:fetcher});
    const result=client.get('old-context');client.clearSession();complete(session);
    await expect(result).rejects.toMatchObject({code:'context_changed'});expect(fetcher).not.toHaveBeenCalled();
  });
  it('records evidence only on explicit calls and does not expose backend exception text',async()=>{
    const fetcher=vi.fn().mockResolvedValue(json({type:'https://example.test/problems/rfa_not_ready',detail:'sensitive backend exception'},422));
    const client=createRfaWorkflowClient({getSession:async()=>session,fetch:fetcher});
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.recordTransmission('rfa-synthetic',{direction:'outbound',channel:'email',status:'sent',occurredAt:'2026-09-09T00:00:00Z',providerMessageId:'synthetic-proof'})).rejects.toMatchObject({code:'rfa_not_ready',message:expect.not.stringContaining('sensitive')});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
