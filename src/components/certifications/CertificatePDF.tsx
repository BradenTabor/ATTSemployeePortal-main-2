/**
 * Client-side PDF certificate generation with @react-pdf/renderer.
 * Brand colors: emerald (#059669, #10b981), dark (#042316).
 *
 * If @react-pdf/renderer conflicts with the build (e.g. Node-only deps in Vite),
 * alternative: render certificate content in a hidden div with print-only CSS
 * and trigger window.print() or use jspdf + html2canvas for a one-off PDF.
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CertificatePDFData } from "./certificatePDFDownload";

// Optional: register a font for a more formal look (fallback to Helvetica)
const styles = StyleSheet.create({
  page: {
    padding: 48,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  border: {
    flex: 1,
    borderWidth: 3,
    borderColor: "#059669",
    borderRadius: 8,
    padding: 32,
  },
  innerBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    borderRadius: 4,
    padding: 28,
  },
  title: {
    fontSize: 22,
    color: "#042316",
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 12,
    color: "#059669",
    textAlign: "center",
    marginBottom: 32,
  },
  name: {
    fontSize: 20,
    color: "#042316",
    textAlign: "center",
    marginBottom: 24,
    fontWeight: "bold",
  },
  certName: {
    fontSize: 16,
    color: "#065f46",
    textAlign: "center",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 10,
    color: "#6b7280",
  },
  value: {
    fontSize: 11,
    color: "#042316",
  },
  divider: {
    height: 1,
    backgroundColor: "#d1fae5",
    marginVertical: 20,
  },
  verification: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#a7f3d0",
  },
  verificationLabel: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 4,
  },
  verificationCode: {
    fontSize: 12,
    color: "#059669",
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  verificationUrl: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function CertificateDocument({ data }: { data: CertificatePDFData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.innerBorder}>
            <Text style={styles.title}>Certificate of Completion</Text>
            <Text style={styles.subtitle}>All Terrain Tree Service</Text>

            <Text style={styles.name}>{data.fullName}</Text>
            <Text style={styles.certName}>{data.certificationName}</Text>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.label}>Date passed</Text>
              <Text style={styles.value}>{formatDate(data.certifiedAt)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Expiration date</Text>
              <Text style={styles.value}>{formatDate(data.expiresAt)}</Text>
            </View>

            <View style={styles.verification}>
              <Text style={styles.verificationLabel}>Verification code</Text>
              <Text style={styles.verificationCode}>{data.verificationCode}</Text>
              <Text style={styles.verificationUrl}>{data.verificationUrl}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.footer}>
          This certificate can be verified at the URL above. Issued by ATTS.
        </Text>
      </Page>
    </Document>
  );
}

export { CertificateDocument };
