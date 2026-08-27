import type { Metadata } from "next";
import { CaseScreen } from "@/components/case-screen";

export async function generateMetadata({ params }: { params: Promise<{ caseId: string }> }): Promise<Metadata> {
  const { caseId } = await params;
  return { title: `Verify ${caseId} — PatchBond`, description: `Public evidence and settlement audit for PatchBond case ${caseId}.`, openGraph: { title: `Verify ${caseId} — PatchBond`, description: "Public PatchBond evidence and settlement audit." }, twitter: { title: `Verify ${caseId} — PatchBond`, description: "Public PatchBond evidence and settlement audit." } };
}

export default async function VerifyPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseScreen caseId={caseId} verify />;
}
