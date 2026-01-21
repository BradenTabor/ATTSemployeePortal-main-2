/**
 * Test Data Factories Index
 * 
 * Central export for all test data factories.
 * Import from this file for cleaner imports in test files.
 */

// DVIR Factory
export {
  createValidDVIR,
  createMinimalDVIR,
  createDVIRMissingOilDipstick,
  createDVIRMissingTruckNumber,
  createDVIRMissingDriverName,
  createDVIRWithInvalidMileage,
  createDVIRWithXSSPayload,
  createDVIRWithSQLInjection,
  createDVIRWithUnicode,
  createDVIRWithFailures,
  createDVIRForMechanicUpdate,
  createMechanicUpdatePayload,
  MILEAGE_BOUNDARY_VALUES,
  type DVIRTestData,
} from './dvirFactory';

// JSA Factory
export {
  createValidJSA,
  createMinimalDraftJSA,
  createCompletedJSA,
  createJSAMissingSignature,
  createJSAMissingJobDate,
  createJSAMissingLocation,
  createJSAWithMaxSpans,
  createJSAWithAllHazards,
  createJSAWithPPEReplacement,
  createJSAForStatusTransition,
  STATUS_TRANSITIONS,
  STEP_VALIDATION_REQUIREMENTS,
  type JSATestData,
  type JsaSpan,
  type PpeState,
} from './jsaFactory';

// Equipment Factory
export {
  createValidEquipment,
  createMinimalEquipment,
  createEquipmentForAllTypes,
  createEquipmentMissingHydraulicPhoto,
  createEquipmentMissingType,
  createEquipmentInvalidNumber,
  createEquipmentMissingSubmitter,
  createEquipmentWithFailures,
  createEquipmentForMechanicUpdate,
  createEquipmentMechanicUpdate,
  createEquipmentMalformedChecklist,
  EQUIPMENT_NUMBERS,
  GENERAL_CHECKLIST_ITEMS,
  SPECIFIC_CHECKLIST_ITEMS,
  EQUIPMENT_TYPE_VALIDATION,
  EQUIPMENT_NUMBER_VALIDATION,
  type EquipmentTestData,
  type EquipmentType,
  type ChecklistValue,
} from './equipmentFactory';

// RTO Factory
export {
  createValidRTO,
  createSingleDayRTO,
  createRTOMissingDates,
  createRTOInvalidDateRange,
  createRTOPastDates,
  createApprovedRTO,
  createDeniedRTO,
  RTO_REASONS,
  type RTOTestData,
} from './rtoFactory';
