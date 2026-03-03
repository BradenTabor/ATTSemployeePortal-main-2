import { PageErrorBoundary } from "../../../components/layout/ErrorBoundary";
import { AdminRTOContent } from "../AdminRTO";

export default function RTOSection() {
  return (
    <PageErrorBoundary>
      <AdminRTOContent />
    </PageErrorBoundary>
  );
}
