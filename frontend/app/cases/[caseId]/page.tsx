import type { Metadata } from "next";
import { CaseScreen } from "@/components/case-screen";

export async function generateMetadata({ params }: { params: Promise<{ caseId: string }> }): Promise<Metadata> {
  const { caseId } = await params;
  return { title: `${caseId} — PatchBond case`, description: `Follow the immutable remediation lifecycle for PatchBond case ${caseId}.`, openGraph: { title: `${caseId} — PatchBond`, description: "Immutable funded security remediation case." }, twitter: { title: `${caseId} — PatchBond`, description: "Immutable funded security remediation case." } };
}

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseScreen caseId={caseId} />;
}
