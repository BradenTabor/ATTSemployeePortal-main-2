import { PageErrorBoundary } from "../../../components/layout/ErrorBoundary";
import { AdminPartsFixesContent } from "../AdminPartsFixesOverview";

export default function PartsFixesSection() {
  return (
    <PageErrorBoundary>
      <AdminPartsFixesContent />
    </PageErrorBoundary>
  );
}
