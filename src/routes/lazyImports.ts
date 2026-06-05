import { lazy } from "react";

// Main pages
export const Home = lazy(() => import("@/pages/Home"));
export const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
export const Dashboard = lazy(() => import("@/pages/Dashboard"));
export const AssignedJobs = lazy(() => import("@/pages/AssignedJobs"));
export const Forms = lazy(() => import("@/pages/forms").then((m) => ({ default: m.Forms })));
export const Announcements = lazy(() => import("@/pages/Announcements"));
export const Resources = lazy(() => import("@/pages/Resources"));
export const CertificationTest = lazy(() => import("@/pages/certifications/CertificationTest"));
export const PracticalEvaluation = lazy(() => import("@/pages/certifications/PracticalEvaluation"));
export const ResourceDocView = lazy(() => import("@/pages/ResourceDocView"));
export const Contact = lazy(() => import("@/pages/Contact"));
export const TeamContacts = lazy(() => import("@/pages/TeamContacts"));
export const Profile = lazy(() => import("@/pages/Profile"));
export const Settings = lazy(() => import("@/pages/Settings"));

// Admin pages
export const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
export const AdminRTO = lazy(() => import("@/pages/admin/AdminRTO"));
export const AdminUsersHub = lazy(() => import("@/pages/admin/AdminUsersHub"));
export const AdminJSA = lazy(() => import("@/pages/admin/AdminJSA"));
export const AdminJobProgress = lazy(() => import("@/pages/admin/AdminJobProgress"));
export const AdminRewards = lazy(() => import("@/pages/admin/AdminRewards"));
export const AdminPartsFixesOverview = lazy(() => import("@/pages/admin/AdminPartsFixesOverview"));
export const AdminTelemetry = lazy(() => import("@/pages/admin/AdminTelemetry"));
export const AdminOperationsHub = lazy(() => import("@/pages/admin/AdminOperationsHub"));
export const CertificationsHub = lazy(() => import("@/pages/admin/CertificationsHub"));
export const AdminEmailRecipients = lazy(() => import("@/pages/admin/AdminEmailRecipients"));
export const AdminSafetySettings = lazy(() => import("@/pages/admin/AdminSafetySettings"));
export const AdminMassSms = lazy(() => import("@/pages/admin/AdminMassSms"));
export const AdminComplianceAudit = lazy(() => import("@/pages/admin/AdminComplianceAudit"));
export const SafetyComplianceHub = lazy(() => import("@/pages/admin/SafetyComplianceHub"));
export const RequestsOversightHub = lazy(() => import("@/pages/admin/RequestsOversightHub"));

// Mechanic pages
export const MechanicDashboard = lazy(() => import("@/pages/mechanic/MechanicDashboard"));
export const MechanicDVIRCenter = lazy(() => import("@/pages/mechanic/MechanicDVIRCenter"));
export const MechanicEquipmentCenter = lazy(
  () => import("@/pages/mechanic/MechanicEquipmentCenter")
);
export const MechanicEquipmentLogs = lazy(() => import("@/pages/mechanic/MechanicEquipmentLogs"));
export const MechanicPartsRepairsLog = lazy(() => import("@/pages/mechanic/MechanicPartsRepairsLog"));

// Foreman pages
export const ForemanDashboard = lazy(() => import("@/pages/foreman/ForemanDashboard"));
export const ForemanDailyReports = lazy(() => import("@/pages/foreman/ForemanDailyReports"));

// General Foreman pages
export const GeneralForemanDashboard = lazy(() => import("@/pages/general-foreman/GeneralForemanDashboard"));
export const CrewOversight = lazy(() => import("@/pages/general-foreman/CrewOversight"));
export const GeneralForemanSafetyCompliance = lazy(() => import("@/pages/general-foreman/GeneralForemanSafetyCompliance"));
export const GeneralForemanEquipmentLogs = lazy(() => import("@/pages/general-foreman/GeneralForemanEquipmentLogs"));
export const EmployeeAttendance = lazy(() => import("@/pages/general-foreman/EmployeeAttendance"));

// Safety Officer pages
export const SafetyOfficerDashboard = lazy(() => import("@/pages/safety-officer/SafetyOfficerDashboard"));
export const OSHA300ASummary = lazy(() => import("@/pages/safety-officer/OSHA300ASummary"));
export const InspectionReadiness = lazy(() => import("@/pages/safety-officer/InspectionReadiness"));

// Form pages
export const RequestTimeOff = lazy(() => import("@/pages/forms/RequestTimeOff"));
export const DVIRForm = lazy(() => import("@/pages/forms/DVIRForm"));
export const DailyEquipmentInspectionForm = lazy(
  () => import("@/pages/forms/DailyEquipmentInspectionForm")
);
export const NearMissReportForm = lazy(
  () => import("@/pages/forms/NearMissReportForm")
);
export const DailyJSAForm = lazy(() => import("@/pages/forms/DailyJSAForm"));
export const TreeFellingJSAForm = lazy(() => import("@/pages/forms/TreeFellingJSAForm"));
export const FormHistory = lazy(() => import("@/pages/forms/FormHistory"));
export const DVIRHistory = lazy(() => import("@/pages/forms/DVIRHistory"));
export const JSAHistory = lazy(() => import("@/pages/forms/JSAHistory"));
export const NotFound = lazy(() => import("@/pages/NotFound"));
export const CertificateVerification = lazy(() => import("@/pages/CertificateVerification"));
export const SafetyBriefingPage = lazy(() => import("@/pages/SafetyBriefingPage"));
export const SafetyRewardsPage = lazy(() => import("@/pages/SafetyRewardsPage"));
export const AdminSafetyRewardsPage = lazy(() => import("@/pages/admin/AdminSafetyRewardsPage"));
export const SafetyBriefingGuard = lazy(() => import("@/components/SafetyBriefingGuard"));
