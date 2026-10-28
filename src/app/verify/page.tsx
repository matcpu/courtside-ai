import type { Metadata } from "next";
import { GuardianVerification } from "@/components/guardian-verification";
export const metadata: Metadata = {
  title: "Secure guardian verification · Courtside AI",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function VerifyPage() {
  return <GuardianVerification />;
}
