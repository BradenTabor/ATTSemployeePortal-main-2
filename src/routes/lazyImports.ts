import { lazy } from "react";

/**
 * Route chunk loaders.
 *
 * Every page is code-split. The loader functions are kept separately from the
 * `lazy()` wrappers so `routePrefetch.ts` can warm a chunk before React asks
 * for it (nav-card hover/touch, idle prefetch of the user's likely next pages).
 * Loader identity is stable, so `lazy()` and prefetch share one module promise.
 */
export const routeLoaders = {
  // Main pages
  Home: () => import("@/pages/Home"),
  ResetPassword: () => import("@/pages/ResetPassword"),
  Dashboard: () => import("@/pages/Dashboard"),
  AssignedJobs: () => import("@/pages/AssignedJobs"),
  Forms: () => import("@/pages/forms").then((m) => ({ default: m.Forms })),
  Announcements: () => import("@/pages/Announcements"),
  Resources: () => import("@/pages/Resources"),
  CertificationTest: () => import("@/pages/certifications/CertificationTest"),
  PracticalEvaluation: () => import("@/pages/certifications/PracticalEvaluation"),
  ResourceDocView: () => import("@/pages/ResourceDocView"),
  Contact: () => import("@/pages/Contact"),
  TeamContacts: () => import("@/pages/TeamContacts"),
  Profile: () => import("@/pages/Profile"),
  Settings: () => import("@/pages/Settings"),

  // Admin pages
  AdminDashboard: () => import("@/pages/admin/AdminDashboard"),
  AdminRTO: () => import("@/pages/admin/AdminRTO"),
  AdminUsersHub: () => import("@/pages/admin/AdminUsersHub"),
  AdminJSA: () => import("@/pages/admin/AdminJSA"),
  AdminJobProgress: () => import("@/pages/admin/AdminJobProgress"),
  AdminRewards: () => import("@/pages/admin/AdminRewards"),
  ManualAwardsHub: () => import("@/pages/admin/ManualAwardsHub"),
  AdminPartsFixesOverview: () => import("@/pages/admin/AdminPartsFixesOverview"),
  AdminTelemetry: () => import("@/pages/admin/AdminTelemetry"),
  AdminOperationsHub: () => import("@/pages/admin/AdminOperationsHub"),
  CertificationsHub: () => import("@/pages/admin/CertificationsHub"),
  AdminEmailRecipients: () => import("@/pages/admin/AdminEmailRecipients"),
  AdminSafetySettings: () => import("@/pages/admin/AdminSafetySettings"),
  AdminMassSms: () => import("@/pages/admin/AdminMassSms"),
  SafetyComplianceHub: () => import("@/pages/admin/SafetyComplianceHub"),
  RequestsOversightHub: () => import("@/pages/admin/RequestsOversightHub"),

  // Mechanic pages
  MechanicDashboard: () => import("@/pages/mechanic/MechanicDashboard"),
  MechanicDVIRCenter: () => import("@/pages/mechanic/MechanicDVIRCenter"),
  MechanicEquipmentCenter: () => import("@/pages/mechanic/MechanicEquipmentCenter"),
  MechanicEquipmentLogs: () => import("@/pages/mechanic/MechanicEquipmentLogs"),
  MechanicPartsRepairsLog: () => import("@/pages/mechanic/MechanicPartsRepairsLog"),

  // Foreman pages
  ForemanDashboard: () => import("@/pages/foreman/ForemanDashboard"),
  ForemanDailyReports: () => import("@/pages/foreman/ForemanDailyReports"),

  // General Foreman pages
  GeneralForemanDashboard: () => import("@/pages/general-foreman/GeneralForemanDashboard"),
  CrewOversight: () => import("@/pages/general-foreman/CrewOversight"),
  GeneralForemanSafetyCompliance: () => import("@/pages/general-foreman/GeneralForemanSafetyCompliance"),
  GeneralForemanEquipmentLogs: () => import("@/pages/general-foreman/GeneralForemanEquipmentLogs"),
  EmployeeAttendance: () => import("@/pages/general-foreman/EmployeeAttendance"),

  // Safety Officer pages
  SafetyOfficerDashboard: () => import("@/pages/safety-officer/SafetyOfficerDashboard"),
  OSHA300ASummary: () => import("@/pages/safety-officer/OSHA300ASummary"),
  InspectionReadiness: () => import("@/pages/safety-officer/InspectionReadiness"),
  FieldAuditPage: () => import("@/pages/safety-officer/FieldAuditPage"),
  FieldAuditHistoryPage: () => import("@/pages/safety-officer/FieldAuditHistoryPage"),
  /**
   * Emergency Action Plan. Lazy like every other route so ~70 KB of protocol
   * content stays out of the startup bundle; App warms it on idle so the chunk
   * is in memory (and in the service worker precache) before it's ever needed.
   */
  EmergencyActionPlan: () => import("@/pages/safety-officer/EmergencyActionPlan"),

  // Form pages
  RequestTimeOff: () => import("@/pages/forms/RequestTimeOff"),
  DVIRForm: () => import("@/pages/forms/DVIRForm"),
  DailyEquipmentInspectionForm: () => import("@/pages/forms/DailyEquipmentInspectionForm"),
  NearMissReportForm: () => import("@/pages/forms/NearMissReportForm"),
  DailyJSAForm: () => import("@/pages/forms/DailyJSAForm"),
  TreeFellingJSAForm: () => import("@/pages/forms/TreeFellingJSAForm"),
  FormHistory: () => import("@/pages/forms/FormHistory"),
  DVIRHistory: () => import("@/pages/forms/DVIRHistory"),
  JSAHistory: () => import("@/pages/forms/JSAHistory"),
  NotFound: () => import("@/pages/NotFound"),
  CertificateVerification: () => import("@/pages/CertificateVerification"),
  SafetyBriefingPage: () => import("@/pages/SafetyBriefingPage"),
  SafetyRewardsPage: () => import("@/pages/SafetyRewardsPage"),
  RewardsStorePage: () => import("@/pages/RewardsStorePage"),
  MyPointsPage: () => import("@/pages/MyPointsPage"),
  AdminSafetyRewardsPage: () => import("@/pages/admin/AdminSafetyRewardsPage"),
  AdminRedemptionFulfillment: () => import("@/pages/admin/AdminRedemptionFulfillment"),
  AdminRewardCatalog: () => import("@/pages/admin/AdminRewardCatalog"),
  SafetyBriefingGuard: () => import("@/components/SafetyBriefingGuard"),
} as const;

export type RouteLoaderName = keyof typeof routeLoaders;

// Main pages
export const Home = lazy(routeLoaders.Home);
export const ResetPassword = lazy(routeLoaders.ResetPassword);
export const Dashboard = lazy(routeLoaders.Dashboard);
export const AssignedJobs = lazy(routeLoaders.AssignedJobs);
export const Forms = lazy(routeLoaders.Forms);
export const Announcements = lazy(routeLoaders.Announcements);
export const Resources = lazy(routeLoaders.Resources);
export const CertificationTest = lazy(routeLoaders.CertificationTest);
export const PracticalEvaluation = lazy(routeLoaders.PracticalEvaluation);
export const ResourceDocView = lazy(routeLoaders.ResourceDocView);
export const Contact = lazy(routeLoaders.Contact);
export const TeamContacts = lazy(routeLoaders.TeamContacts);
export const Profile = lazy(routeLoaders.Profile);
export const Settings = lazy(routeLoaders.Settings);

// Admin pages
export const AdminDashboard = lazy(routeLoaders.AdminDashboard);
export const AdminRTO = lazy(routeLoaders.AdminRTO);
export const AdminUsersHub = lazy(routeLoaders.AdminUsersHub);
export const AdminJSA = lazy(routeLoaders.AdminJSA);
export const AdminJobProgress = lazy(routeLoaders.AdminJobProgress);
export const AdminRewards = lazy(routeLoaders.AdminRewards);
export const ManualAwardsHub = lazy(routeLoaders.ManualAwardsHub);
export const AdminPartsFixesOverview = lazy(routeLoaders.AdminPartsFixesOverview);
export const AdminTelemetry = lazy(routeLoaders.AdminTelemetry);
export const AdminOperationsHub = lazy(routeLoaders.AdminOperationsHub);
export const CertificationsHub = lazy(routeLoaders.CertificationsHub);
export const AdminEmailRecipients = lazy(routeLoaders.AdminEmailRecipients);
export const AdminSafetySettings = lazy(routeLoaders.AdminSafetySettings);
export const AdminMassSms = lazy(routeLoaders.AdminMassSms);
export const SafetyComplianceHub = lazy(routeLoaders.SafetyComplianceHub);
export const RequestsOversightHub = lazy(routeLoaders.RequestsOversightHub);

// Mechanic pages
export const MechanicDashboard = lazy(routeLoaders.MechanicDashboard);
export const MechanicDVIRCenter = lazy(routeLoaders.MechanicDVIRCenter);
export const MechanicEquipmentCenter = lazy(routeLoaders.MechanicEquipmentCenter);
export const MechanicEquipmentLogs = lazy(routeLoaders.MechanicEquipmentLogs);
export const MechanicPartsRepairsLog = lazy(routeLoaders.MechanicPartsRepairsLog);

// Foreman pages
export const ForemanDashboard = lazy(routeLoaders.ForemanDashboard);
export const ForemanDailyReports = lazy(routeLoaders.ForemanDailyReports);

// General Foreman pages
export const GeneralForemanDashboard = lazy(routeLoaders.GeneralForemanDashboard);
export const CrewOversight = lazy(routeLoaders.CrewOversight);
export const GeneralForemanSafetyCompliance = lazy(routeLoaders.GeneralForemanSafetyCompliance);
export const GeneralForemanEquipmentLogs = lazy(routeLoaders.GeneralForemanEquipmentLogs);
export const EmployeeAttendance = lazy(routeLoaders.EmployeeAttendance);

// Safety Officer pages
export const SafetyOfficerDashboard = lazy(routeLoaders.SafetyOfficerDashboard);
export const OSHA300ASummary = lazy(routeLoaders.OSHA300ASummary);
export const InspectionReadiness = lazy(routeLoaders.InspectionReadiness);
export const FieldAuditPage = lazy(routeLoaders.FieldAuditPage);
export const FieldAuditHistoryPage = lazy(routeLoaders.FieldAuditHistoryPage);
export const EmergencyActionPlan = lazy(routeLoaders.EmergencyActionPlan);

// Form pages
export const RequestTimeOff = lazy(routeLoaders.RequestTimeOff);
export const DVIRForm = lazy(routeLoaders.DVIRForm);
export const DailyEquipmentInspectionForm = lazy(routeLoaders.DailyEquipmentInspectionForm);
export const NearMissReportForm = lazy(routeLoaders.NearMissReportForm);
export const DailyJSAForm = lazy(routeLoaders.DailyJSAForm);
export const TreeFellingJSAForm = lazy(routeLoaders.TreeFellingJSAForm);
export const FormHistory = lazy(routeLoaders.FormHistory);
export const DVIRHistory = lazy(routeLoaders.DVIRHistory);
export const JSAHistory = lazy(routeLoaders.JSAHistory);
export const NotFound = lazy(routeLoaders.NotFound);
export const CertificateVerification = lazy(routeLoaders.CertificateVerification);
export const SafetyBriefingPage = lazy(routeLoaders.SafetyBriefingPage);
export const SafetyRewardsPage = lazy(routeLoaders.SafetyRewardsPage);
export const RewardsStorePage = lazy(routeLoaders.RewardsStorePage);
export const MyPointsPage = lazy(routeLoaders.MyPointsPage);
export const AdminSafetyRewardsPage = lazy(routeLoaders.AdminSafetyRewardsPage);
export const AdminRedemptionFulfillment = lazy(routeLoaders.AdminRedemptionFulfillment);
export const AdminRewardCatalog = lazy(routeLoaders.AdminRewardCatalog);
export const SafetyBriefingGuard = lazy(routeLoaders.SafetyBriefingGuard);
