export function TechnicalDetails({ children }: { children: React.ReactNode }) {
  return <details className="technical-details"><summary>Technical details</summary><div>{children}</div></details>;
}
