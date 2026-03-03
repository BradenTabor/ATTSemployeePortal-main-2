import { PageErrorBoundary } from "../../../components/layout/ErrorBoundary";
import { AdminJSAContent } from "../AdminJSA";

export default function JSASection() {
  return (
    <PageErrorBoundary>
      <AdminJSAContent />
    </PageErrorBoundary>
  );
}
