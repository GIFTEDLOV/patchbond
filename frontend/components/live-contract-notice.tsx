"use client";

import { getPublicConfig } from "@/lib/config";

export function LiveContractNotice() {
  const config = getPublicConfig();
  if (config.configured) return null;
  const title = config.configurationError ? "Frontend configuration needs attention" : "Live contract not deployed yet";
  return (
    <div className="notice notice-warm" role="status">
      <strong>{title}</strong>
      <span>{config.configurationError ?? "PatchBond is ready for configuration after the Stage 4 Bradbury deployment. Reads and writes are disabled; no sample data is substituted."}</span>
    </div>
  );
}
