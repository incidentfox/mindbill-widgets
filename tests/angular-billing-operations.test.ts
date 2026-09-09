import { describe, expect, it } from 'vitest';
import { mindBillTaskQuery, mindBillPaymentDateRange, mindBillPaymentCsv } from '../packages/angular/src/lib/billing-operations';
import type { PaymentReviewItem } from '../packages/browser/src';

describe('Angular connected operations filters and exports', () => {
  it('distinguishes aging task drilldowns from waiting bill counts', () => {
    const cell = { sectionId:'incomplete',rowId:'send_bill::Send Bill',bucketId:'1-30',refs:['synthetic-bill'],count:1 };
    expect(mindBillTaskQuery(cell)).toEqual({status:'all',taskSection:'incomplete',taskType:'send_bill',taskLabel:'Send Bill',age:'0-30'});
    expect(mindBillTaskQuery({...cell,sectionId:'waiting_accepted',rowId:'accepted_no_response',bucketId:null})).toEqual({status:'accepted_no_response'});
  });
  it('uses a Monday week boundary including Sundays and clears all-date bounds', () => {
    expect(mindBillPaymentDateRange('week',new Date(2026,8,6,12))).toEqual({receivedFrom:'2026-08-31',receivedTo:'2026-09-06'});
    expect(mindBillPaymentDateRange('year',new Date(2026,8,8,12))).toEqual({receivedFrom:'2026-01-01',receivedTo:'2026-09-08'});
    expect(mindBillPaymentDateRange('all')).toEqual({});
  });
  it('quotes exported cells and neutralizes spreadsheet formulas', () => {
    const item: PaymentReviewItem = {id:'payment-demo',billId:'bill-demo',billNumber:42,patientName:'=IMPORTXML("example")',claimNumber:'DEMO,42',dateOfService:null,receivedDate:'2026-09-08',postedDate:null,status:'received',method:'check',source:'Manual',checkNumber:'\tformula',amount:125.50};
    const csv = mindBillPaymentCsv([item]);
    expect(csv).toContain('"\'=IMPORTXML(""example"")"');
    expect(csv).toContain('"DEMO,42"');
    expect(csv).toContain('"\'\tformula"');
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).not.toContain('bill-demo');
  });
});
