"use client";

import { useId, type CSSProperties, type ReactElement, type ReactNode } from "react";

export type BillDetailValidationIssue = { severity: "error" | "warning"; message: string };

export type BillDetailSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  validationIssues?: readonly BillDetailValidationIssue[];
  children: ReactNode;
  id?: string;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  style?: CSSProperties;
};

/** Shared read/edit section. Validation remains visible alongside the affected fields. */
export function BillDetailSection({ title, description, actions, validationIssues = [], children, id, className, headerClassName, bodyClassName, style }: BillDetailSectionProps): ReactElement {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const errors = validationIssues.filter((issue) => issue.severity === "error");
  const warnings = validationIssues.filter((issue) => issue.severity === "warning");
  return <section id={id} className={["mb-detail-section", errors.length ? "mb-detail-section-error" : warnings.length ? "mb-detail-section-warning" : "", className].filter(Boolean).join(" ")} aria-labelledby={titleId} style={style}>
    <style>{DETAIL_STYLES}</style>
    <header className={["mb-detail-section-header", headerClassName ?? "mb-detail-section-header-default"].join(" ")}><div><h3 id={titleId}>{title}</h3>{description ? <div className="mb-detail-section-description">{description}</div> : null}</div>{actions ? <div className="mb-detail-section-actions">{actions}</div> : null}</header>
    {errors.length || warnings.length ? <div className="mb-detail-section-issues" aria-live="polite">{errors.length ? <ul className="mb-detail-errors" aria-label="Errors">{errors.map((issue, index) => <li key={index}><strong>Error: </strong>{issue.message}</li>)}</ul> : null}{warnings.length ? <ul className="mb-detail-warnings" aria-label="Warnings">{warnings.map((issue, index) => <li key={index}><strong>Warning: </strong>{issue.message}</li>)}</ul> : null}</div> : null}
    <div className={["mb-detail-section-body", bodyClassName ?? "mb-detail-section-body-default"].join(" ")}>{children}</div>
  </section>;
}

export type BillDetailLayoutProps = {
  header?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/** Shared responsive frame; the host retains its status ribbon, editing controls and navigation. */
export function BillDetailLayout({ header, actions, children, sidebar, className, style }: BillDetailLayoutProps): ReactElement {
  return <div className={["mb-detail-layout", className].filter(Boolean).join(" ")} style={style}>
    <style>{DETAIL_STYLES}</style>
    {header || actions ? <div className="mb-detail-layout-header"><div>{header}</div>{actions ? <div className="mb-detail-layout-actions">{actions}</div> : null}</div> : null}
    <div className={sidebar ? "mb-detail-layout-columns has-sidebar" : "mb-detail-layout-columns"}><div className="mb-detail-layout-main">{children}</div>{sidebar ? <aside className="mb-detail-layout-sidebar">{sidebar}</aside> : null}</div>
  </div>;
}

const DETAIL_STYLES = `
.mb-detail-layout{min-width:0;color:var(--mb-text,inherit)}.mb-detail-layout-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.mb-detail-layout-header>div{min-width:0}.mb-detail-layout-actions,.mb-detail-section-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.mb-detail-layout-columns{display:grid;gap:20px;min-width:0}.mb-detail-layout-columns.has-sidebar{grid-template-columns:minmax(0,1fr) minmax(240px,320px)}.mb-detail-layout-main{display:grid;align-content:start;gap:16px;min-width:0}.mb-detail-layout-sidebar{min-width:0}.mb-detail-section{min-width:0;background:var(--mb-surface,#fff);border:1px solid var(--mb-border,#d7e0df);border-radius:var(--mb-radius,14px);overflow:hidden}.mb-detail-section-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mb-detail-section-header-default{padding:20px 20px 16px}.mb-detail-section-header h3{margin:0;font-size:1.05rem;font-weight:700}.mb-detail-section-description{margin-top:5px;color:var(--mb-muted,#607176)}.mb-detail-section-body{min-width:0}.mb-detail-section-body-default{padding:0 20px 20px}.mb-detail-section-error{border-color:var(--mb-danger,#b63d35);box-shadow:inset 3px 0 var(--mb-danger,#b63d35)}.mb-detail-section-warning{border-color:var(--mb-warning,#8a5c17);box-shadow:inset 3px 0 var(--mb-warning,#8a5c17)}.mb-detail-section-issues{padding:0 20px 16px;overflow-wrap:anywhere}.mb-detail-section-issues ul{margin:0;padding-left:20px}.mb-detail-section-issues ul+ul{margin-top:8px}.mb-detail-errors{color:var(--mb-danger,#b63d35)}.mb-detail-warnings{color:var(--mb-warning,#8a5c17)}
@media(max-width:760px){.mb-detail-layout-columns.has-sidebar{grid-template-columns:minmax(0,1fr)}.mb-detail-layout-header{flex-wrap:wrap}.mb-detail-section-header{flex-wrap:wrap}.mb-detail-section-header-default{padding:16px 16px 12px}.mb-detail-section-body-default{padding:0 16px 16px}.mb-detail-section-issues{padding:0 16px 12px}}
`;
