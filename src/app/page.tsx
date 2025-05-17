import TipCalculator from "@/components/tip-calculator";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <Suspense fallback={<div>Loading...</div>}>
        <TipCalculator />
      </Suspense>
    </main>
  );
}
