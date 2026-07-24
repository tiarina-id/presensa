"use client";

import { useState, useEffect } from "react";
import { ClipboardList } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Alert } from "@/components/ui/alert";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface Log {
  id: number;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
}

export default function AuditLogsPage() {
  const t = useT();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setError(t("audit.loadError")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-display text-primary flex items-center gap-2">
        <ClipboardList size={22} className="text-accent" />
        {t("audit.title")}
      </h1>
      <p className="text-body text-text-muted">{t("audit.subtitle")}</p>

      {error && <Alert variant="error" className="mt-4">{error}</Alert>}

      <div className="mt-5">
        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("audit.time")}</TableHead>
                  <TableHead>{t("audit.action")}</TableHead>
                  <TableHead>{t("audit.entity")}</TableHead>
                  <TableHead>{t("audit.ip")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="text-text-muted">
                      {log.entityType}
                      {log.entityId ? `#${log.entityId}` : ""}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.ipAddress || "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-text-muted"
                    >
                      {t("audit.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </div>
  );
}
