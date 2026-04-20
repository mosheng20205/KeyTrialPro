import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import type { LicenseDetail, LicenseListResponse, LicenseLogResponse } from "../types";

type LicenseInventoryPageProps = {
  productCode: string;
};

function translateStatus(status: string): string {
  switch (status) {
    case "active":
      return "正常";
    case "blocked":
      return "已封禁";
    case "inactive":
      return "已停用";
    default:
      return status;
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "永久有效";
  }

  return value;
}

function summarizeMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) {
    return "-";
  }

  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return "-";
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return `${key}: ${String(value)}`;
      }

      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(" | ");
}

function buildPageItems(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | string> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis-left");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis-right");
  }

  items.push(totalPages);

  return items;
}

export function LicenseInventoryPage({ productCode }: LicenseInventoryPageProps) {
  const [inventory, setInventory] = useState<LicenseListResponse>({
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalAll: 0, totalPages: 1 },
    filters: { status: "all", query: "" },
  });
  const [queryInput, setQueryInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [pageJumpInput, setPageJumpInput] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedLicenseId, setSelectedLicenseId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LicenseDetail | null>(null);
  const [detailLogs, setDetailLogs] = useState<LicenseLogResponse>({
    items: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const totalAll = inventory.pagination.totalAll ?? inventory.pagination.total;
  const hasActiveFilters = useMemo(
    () => statusFilter !== "all" || queryInput.trim() !== "",
    [queryInput, statusFilter],
  );
  const pageItems = useMemo(
    () => buildPageItems(inventory.pagination.page, inventory.pagination.totalPages),
    [inventory.pagination.page, inventory.pagination.totalPages],
  );

  const loadInventory = async (page: number, nextPageSize: number, nextStatus: string, nextQuery: string) => {
    if (!productCode) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.licenses({
        productCode,
        page,
        pageSize: nextPageSize,
        status: nextStatus,
        query: nextQuery,
      });
      setInventory(response);
      setPageJumpInput(String(response.pagination.page));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加载许可证库存失败。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedLicenseId(null);
    setDetail(null);
    setDetailLogs({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    setDetailError("");
    setQueryInput("");
    setStatusFilter("all");
    setPageSize(20);
    setPageJumpInput("1");
    void loadInventory(1, 20, "all", "");
  }, [productCode]);

  useEffect(() => {
    if (selectedLicenseId === null) {
      return;
    }

    let disposed = false;
    setDetailLoading(true);
    setDetailError("");

    Promise.all([api.licenseDetail(selectedLicenseId), api.licenseLogs(selectedLicenseId, 1, 20)])
      .then(([nextDetail, nextLogs]) => {
        if (disposed) {
          return;
        }

        setDetail(nextDetail);
        setDetailLogs(nextLogs);
      })
      .catch((err: unknown) => {
        if (!disposed) {
          setDetailError(err instanceof Error ? err.message : "加载许可证详情失败。");
        }
      })
      .finally(() => {
        if (!disposed) {
          setDetailLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [selectedLicenseId]);

  const handleFilterSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await loadInventory(1, pageSize, statusFilter, queryInput.trim());
  };

  const handleReset = async () => {
    setQueryInput("");
    setStatusFilter("all");
    setPageSize(20);
    setPageJumpInput("1");
    await loadInventory(1, 20, "all", "");
  };

  const handleStatusToggle = async (licenseId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "blocked" : "active";
    const confirmText = nextStatus === "blocked" ? "确认封禁这张卡密？" : "确认恢复这张卡密为正常状态？";

    if (!window.confirm(confirmText)) {
      return;
    }

    setStatusUpdatingId(licenseId);

    try {
      const updated = await api.updateLicenseStatus(licenseId, nextStatus);
      await loadInventory(inventory.pagination.page, inventory.pagination.pageSize, statusFilter, queryInput.trim());

      if (selectedLicenseId === licenseId) {
        setDetail(updated);
        const nextLogs = await api.licenseLogs(licenseId, 1, detailLogs.pagination.pageSize);
        setDetailLogs(nextLogs);
      }
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "更新许可证状态失败。");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleLogPageChange = async (page: number) => {
    if (selectedLicenseId === null) {
      return;
    }

    setDetailLoading(true);

    try {
      const nextLogs = await api.licenseLogs(selectedLicenseId, page, detailLogs.pagination.pageSize);
      setDetailLogs(nextLogs);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "加载许可证日志失败。");
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePageJump = async () => {
    const rawPage = Number(pageJumpInput);
    if (!Number.isFinite(rawPage)) {
      setPageJumpInput(String(inventory.pagination.page));
      return;
    }

    const targetPage = Math.min(
      Math.max(1, Math.trunc(rawPage)),
      Math.max(1, inventory.pagination.totalPages),
    );

    setPageJumpInput(String(targetPage));
    await loadInventory(targetPage, pageSize, statusFilter, queryInput.trim());
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">许可证库存</p>
          <h3>已发放的产品密钥</h3>
          <p className="section-note">支持按卡密和状态筛选、分页浏览，并可直接封禁或查看单卡历史。</p>
        </div>
      </div>

      <form className="license-toolbar" onSubmit={handleFilterSubmit}>
        <label>
          卡密搜索
          <input
            type="text"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="输入完整或部分卡密"
          />
        </label>

        <label>
          状态
          <select
            value={statusFilter}
            onChange={(event) => {
              const nextStatus = event.target.value;
              setStatusFilter(nextStatus);
              void loadInventory(1, pageSize, nextStatus, queryInput.trim());
            }}
          >
            <option value="all">全部</option>
            <option value="active">正常</option>
            <option value="blocked">已封禁</option>
            <option value="inactive">已停用</option>
          </select>
        </label>

        <label>
          每页条数
          <select
            value={pageSize}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setPageSize(nextValue);
              void loadInventory(1, nextValue, statusFilter, queryInput.trim());
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>

        <div className="license-toolbar-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "筛选中..." : "筛选"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void handleReset()}>
            重置
          </button>
        </div>
      </form>

      <div className="license-summary-bar">
        <span>总卡密 {totalAll} 张</span>
        <span>
          当前页 {inventory.items.length} 张，当前页码 {inventory.pagination.page} / {inventory.pagination.totalPages}
        </span>
        {hasActiveFilters ? <span>当前筛选命中 {inventory.pagination.total} 张</span> : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {!loading && inventory.items.length === 0 ? (
        <div className="info-banner">当前筛选条件下没有找到卡密记录。</div>
      ) : (
        <div className="table-grid license-grid-ops">
          <div className="table-head">卡密</div>
          <div className="table-head">状态</div>
          <div className="table-head">到期时间</div>
          <div className="table-head">已绑 / 上限</div>
          <div className="table-head">创建时间</div>
          <div className="table-head">操作</div>
          {inventory.items.map((license) => (
            <Fragment key={license.id}>
              <div className="table-cell table-cell-code table-cell-break">{license.license_key}</div>
              <div className="table-cell">
                <span className={`status-chip status-chip-${license.status}`}>{translateStatus(license.status)}</span>
              </div>
              <div className="table-cell table-cell-nowrap">{formatDateTime(license.expires_at)}</div>
              <div className="table-cell table-cell-nowrap">
                {license.active_binding_count ?? 0} / {license.max_bindings}
              </div>
              <div className="table-cell table-cell-nowrap">{formatDateTime(license.created_at)}</div>
              <div className="table-cell">
                <div className="license-row-actions">
                  <button type="button" className="mini-button" onClick={() => setSelectedLicenseId(license.id)}>
                    查看详情
                  </button>
                  <button
                    type="button"
                    className={license.status === "active" ? "mini-button mini-button-danger" : "mini-button mini-button-secondary"}
                    disabled={statusUpdatingId === license.id}
                    onClick={() => void handleStatusToggle(license.id, license.status)}
                  >
                    {statusUpdatingId === license.id ? "处理中..." : license.status === "active" ? "封禁" : "解封"}
                  </button>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      <div className="license-pagination">
        <div className="license-pagination-controls">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading || inventory.pagination.page <= 1}
            onClick={() => void loadInventory(inventory.pagination.page - 1, pageSize, statusFilter, queryInput.trim())}
          >
            上一页
          </button>
          <div className="license-pagination-pages" aria-label="License pages">
            {pageItems.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  className={item === inventory.pagination.page ? "page-number-button page-number-button-active" : "page-number-button"}
                  aria-current={item === inventory.pagination.page ? "page" : undefined}
                  disabled={loading}
                  onClick={() => void loadInventory(item, pageSize, statusFilter, queryInput.trim())}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="page-number-ellipsis" aria-hidden="true">
                  ...
                </span>
              ),
            )}
          </div>
          <span className="license-pagination-text">
            第 {inventory.pagination.page} / {inventory.pagination.totalPages} 页
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading || inventory.pagination.page >= inventory.pagination.totalPages}
            onClick={() => void loadInventory(inventory.pagination.page + 1, pageSize, statusFilter, queryInput.trim())}
          >
            下一页
          </button>
        </div>

        <div className="license-pagination-jump">
          <label htmlFor="license-page-jump">跳转到</label>
          <input
            id="license-page-jump"
            type="number"
            min={1}
            max={Math.max(1, inventory.pagination.totalPages)}
            value={pageJumpInput}
            onChange={(event) => setPageJumpInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handlePageJump();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void handlePageJump()}>
            跳转
          </button>
        </div>
      </div>

      {selectedLicenseId !== null ? (
        <div className="license-detail-shell">
          <div className="panel-header">
            <div>
              <p className="eyebrow">单卡详情</p>
              <h3>{detail?.license_key ?? `#${selectedLicenseId}`}</h3>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedLicenseId(null)}>
              关闭详情
            </button>
          </div>

          {detailError ? <div className="alert alert-error">{detailError}</div> : null}
          {detailLoading && detail === null ? <div className="info-banner">正在加载许可证详情...</div> : null}

          {detail ? (
            <>
              <div className="license-detail-grid">
                <div className="license-detail-card">
                  <span>产品</span>
                  <strong>{detail.product_name}</strong>
                  <small>{detail.productCode}</small>
                </div>
                <div className="license-detail-card">
                  <span>状态</span>
                  <strong>{translateStatus(detail.status)}</strong>
                  <small>{detail.license_type ?? "standard"}</small>
                </div>
                <div className="license-detail-card">
                  <span>到期时间</span>
                  <strong>{formatDateTime(detail.expires_at)}</strong>
                  <small>创建于 {formatDateTime(detail.created_at)}</small>
                </div>
                <div className="license-detail-card">
                  <span>绑定情况</span>
                  <strong>
                    {detail.active_binding_count ?? 0} / {detail.max_bindings}
                  </strong>
                  <small>最近更新 {formatDateTime(detail.updatedAt)}</small>
                </div>
              </div>

              <div className="license-detail-panels">
                <article className="license-detail-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">绑定记录</p>
                      <h3>最近绑定设备</h3>
                    </div>
                  </div>

                  {detail.bindings.length === 0 ? (
                    <div className="info-banner">这张卡密当前还没有绑定记录。</div>
                  ) : (
                    <div className="table-grid license-binding-grid">
                      <div className="table-head">机器码</div>
                      <div className="table-head">状态</div>
                      <div className="table-head">绑定时间</div>
                      <div className="table-head">最近验证</div>
                      {detail.bindings.map((binding) => (
                        <Fragment key={binding.id}>
                          <div className="table-cell table-cell-code table-cell-break">{binding.machineId}</div>
                          <div className="table-cell">{translateStatus(binding.status)}</div>
                          <div className="table-cell table-cell-nowrap">{formatDateTime(binding.boundAt)}</div>
                          <div className="table-cell table-cell-nowrap">{formatDateTime(binding.lastVerifiedAt)}</div>
                        </Fragment>
                      ))}
                    </div>
                  )}
                </article>

                <article className="license-detail-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">单卡日志</p>
                      <h3>该卡密相关操作历史</h3>
                    </div>
                  </div>

                  {detailLogs.items.length === 0 ? (
                    <div className="info-banner">暂时没有和这张卡密关联的日志。</div>
                  ) : (
                    <>
                      <div className="table-grid license-log-grid">
                        <div className="table-head">时间</div>
                        <div className="table-head">操作者</div>
                        <div className="table-head">动作</div>
                        <div className="table-head">详情</div>
                        <div className="table-head">IP</div>
                        {detailLogs.items.map((log) => (
                          <Fragment key={log.id}>
                            <div className="table-cell table-cell-nowrap">{formatDateTime(log.createdAt)}</div>
                            <div className="table-cell table-cell-break table-cell-code">
                              {log.actorType}:{log.actorId}
                            </div>
                            <div className="table-cell table-cell-break">{log.actionCode}</div>
                            <div className="table-cell table-cell-break table-cell-wide">{summarizeMetadata(log.metadata)}</div>
                            <div className="table-cell table-cell-nowrap">{log.ipAddress ?? "-"}</div>
                          </Fragment>
                        ))}
                      </div>

                      <div className="license-pagination">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={detailLoading || detailLogs.pagination.page <= 1}
                          onClick={() => void handleLogPageChange(detailLogs.pagination.page - 1)}
                        >
                          上一页
                        </button>
                        <span className="license-pagination-text">
                          第 {detailLogs.pagination.page} / {detailLogs.pagination.totalPages} 页
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={detailLoading || detailLogs.pagination.page >= detailLogs.pagination.totalPages}
                          onClick={() => void handleLogPageChange(detailLogs.pagination.page + 1)}
                        >
                          下一页
                        </button>
                      </div>
                    </>
                  )}
                </article>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
