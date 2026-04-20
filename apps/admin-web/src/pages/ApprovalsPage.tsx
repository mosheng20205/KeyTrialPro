import { api } from "../api";
import type { ApprovalTicket } from "../types";

type ApprovalsPageProps = {
  tickets: ApprovalTicket[];
  onDecision: () => void;
};

export function ApprovalsPage({ tickets, onDecision }: ApprovalsPageProps) {
  async function decide(ticketId: number, decision: "approved" | "rejected") {
    await api.decideApproval(ticketId, decision);
    onDecision();
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">人工审核</p>
          <h3>审批队列</h3>
        </div>
      </div>

      <div className="ticket-list">
        {tickets.map((ticket) => (
          <article className="ticket-card" key={ticket.id}>
            <div>
              <strong>{ticket.ticket_type}</strong>
              <p>{ticket.machine_id}</p>
            </div>
            <div>
              <span className="eyebrow">申请者</span>
              <p>{ticket.requested_by ?? "系统"}</p>
            </div>
            <div>
              <span className="eyebrow">创建时间</span>
              <p>{ticket.created_at}</p>
            </div>
            <div className="decision-actions">
              <button className="action-button" onClick={() => decide(ticket.id, "approved")}>
                通过
              </button>
              <button className="action-button action-button-secondary" onClick={() => decide(ticket.id, "rejected")}>
                拒绝
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
