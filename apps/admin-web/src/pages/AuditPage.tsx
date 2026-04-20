import { Fragment } from "react";
import type { AuditLogRecord } from "../types";

type AuditPageProps = {
  logs: AuditLogRecord[];
};

export function AuditPage({ logs }: AuditPageProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">审计日志</p>
          <h3>管理员与客户端操作记录</h3>
        </div>
      </div>

      <div className="table-grid audit-grid">
        <div className="table-head">时间</div>
        <div className="table-head">操作者</div>
        <div className="table-head">操作</div>
        <div className="table-head">目标</div>
        <div className="table-head">IP</div>
        {logs.map((log) => (
          <Fragment key={log.id}>
            <div className="table-cell" key={`time-${log.id}`}>{log.created_at}</div>
            <div className="table-cell" key={`actor-${log.id}`}>{log.actor_type}:{log.actor_id}</div>
            <div className="table-cell" key={`action-${log.id}`}>{log.action_code}</div>
            <div className="table-cell" key={`target-${log.id}`}>{log.target_type}:{log.target_id}</div>
            <div className="table-cell" key={`ip-${log.id}`}>{log.ip_address ?? "-"}</div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
