export function TechnicalDetails({ children }: { children: React.ReactNode }) {
  return <details className="technical-details"><summary><span>Technical details</span><small>Identifiers, execution and settlement metadata</small></summary><div>{children}</div></details>;
}
