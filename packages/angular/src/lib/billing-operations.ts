import type { BillRegistryAge, BillRegistryQuery, PaymentReviewItem, PaymentReviewQuery } from '@mindbill/browser';
import type { MindBillBillTasksCell } from './bill-tasks-dashboard';

export type MindBillBillingView = 'tasks' | 'bills' | 'procedures' | 'productivity' | 'payments';
export type MindBillPaymentRange = 'today' | 'week' | 'month' | 'year' | 'all';
export function mindBillTaskQuery(cell: MindBillBillTasksCell): BillRegistryQuery {
  const [taskType, taskLabel] = cell.rowId.split('::', 2);
  const age = cell.bucketId === '1-30' ? '0-30' : cell.bucketId as BillRegistryAge | null;
  if (cell.sectionId === 'waiting_sent' || cell.sectionId === 'waiting_accepted') return { status: cell.rowId, ...(age ? { age } : {}) };
  return { status: 'all', taskSection: cell.sectionId, ...(taskType ? { taskType } : {}), ...(taskLabel ? { taskLabel } : {}), ...(age ? { age } : {}) };
}
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function mindBillPaymentDateRange(range: MindBillPaymentRange, now = new Date()): Pick<PaymentReviewQuery, 'receivedFrom' | 'receivedTo'> {
  if (range === 'all') return {};
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'week') start.setDate(start.getDate() - (start.getDay()+6)%7);
  if (range === 'month') start.setDate(1);
  if (range === 'year') { start.setMonth(0); start.setDate(1); }
  return { receivedFrom: localDate(start), receivedTo: localDate(now) };
}
export function mindBillPaymentCsv(items: readonly PaymentReviewItem[]): string {
  const escape = (value: string | number | null) => {
    let text = value == null ? '' : String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g,'""')}"`;
  };
  return [['Patient','Bill','Claim','Date of service','Received','Posted','Status','Method','Source','Check / trace','Amount'], ...items.map(i => [i.patientName,i.billNumber,i.claimNumber,i.dateOfService,i.receivedDate,i.postedDate,'Received',i.method,i.source,i.checkNumber,i.amount])].map(row => row.map(escape).join(',')).join('\r\n');
}
