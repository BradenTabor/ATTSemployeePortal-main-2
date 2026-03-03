/**
 * Thin entry point for certificate PDF download. Dynamic-imports the full
 * @react-pdf/renderer-based implementation so the ~1.5MB chunk loads only when
 * the user clicks "Download Certificate".
 */

import type React from "react";

export interface CertificatePDFData {
  fullName: string;
  certificationName: string;
  certifiedAt: string | null;
  expiresAt: string;
  verificationCode: string;
  verificationUrl: string;
}

export async function downloadCertificatePDF(
  data: CertificatePDFData,
  fileName?: string
): Promise<void> {
  const [React, { CertificateDocument }, { pdf }] = await Promise.all([
    import("react"),
    import("./CertificatePDF"),
    import("@react-pdf/renderer"),
  ]);
  const element = React.createElement(CertificateDocument as React.ComponentType<{ data: CertificatePDFData }>, {
    data,
  });
  // pdf() expects @react-pdf Document props; our element is valid at runtime
  const blob = await (pdf as (el: React.ReactElement) => { toBlob: () => Promise<Blob> })(element).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    fileName ??
    `ATTS-Certificate-${data.certificationName.replace(/\s+/g, "-")}-${data.verificationCode}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
