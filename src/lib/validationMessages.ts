/**
 * User-Friendly Validation Messages
 * 
 * Provides context-specific, actionable error messages for form validation.
 * Messages are designed to be clear, helpful, and guide users to fix issues.
 */

/**
 * Format field name from camelCase to Title Case
 * 
 * @param fieldKey - The field key in camelCase
 * @returns Formatted field name
 */
export function formatFieldName(fieldKey: string): string {
  // Field label mappings for better readability
  const FIELD_LABELS: Record<string, string> = {
    truckNumber: 'Truck Number',
    equipmentType: 'Equipment Type',
    equipmentNumber: 'Equipment Number',
    driversName: "Driver's Name",
    submittedBy: 'Submitted By',
    mileage: 'Odometer Reading',
    oilDipstickPhoto: 'Oil Dipstick Photo',
    hydraulicPhoto: 'Hydraulic Fluid Photo',
    vehicleTrailerChecklist: 'Vehicle Inspection Checklist',
    generalChecklist: 'General Checklist',
    specificChecklist: 'Specific Checklist',
    signature: 'Signature',
    ocContact: 'OC Contact',
    docContact: 'DOC Contact',
    gfContact: 'GF Contact',
    safetyContact: 'Safety Contact',
    jobDate: 'Job Date',
    workLocation: 'Work Location',
    jobsPerformed: 'Jobs Performed',
    employeeSignature: 'Employee Signature',
    nearestHospital: 'Nearest Hospital',
    nearestClinic: 'Nearest Clinic',
  };

  return FIELD_LABELS[fieldKey] || fieldKey
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
}

export interface ValidationMessageContext {
  fieldName?: string;
  previousValue?: string | number;
  requiredCount?: number;
  currentCount?: number;
  availableOptions?: string[];
  [key: string]: unknown;
}

/**
 * Generate user-friendly validation messages
 */
export const validationMessages = {
  /**
   * Required field messages
   */
  required: (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      truckNumber: "Please select a truck number",
      equipmentType: "Select an equipment type",
      equipmentNumber: "Select an equipment number",
      driversName: "Driver's name is required",
      submittedBy: "Submitted by is required",
      mileage: "Odometer reading is required",
      oilDipstickPhoto: "Oil dipstick photo is required",
      hydraulicPhoto: "Hydraulic fluid level photo is required",
      signature: "Signature is required",
    };
    
    return fieldMap[fieldName] || `${fieldName} is required`;
  },

  /**
   * Format validation messages
   */
  format: (_fieldName: string, format: string): string => {
    const formatMap: Record<string, string> = {
      phone: "Enter a valid phone number (e.g., 555-123-4567)",
      email: "Enter a valid email address",
      mileage: "Enter a valid numeric odometer reading",
      date: "Enter a valid date (MM/DD/YYYY)",
    };
    
    return formatMap[format] || `Enter a valid ${format}`;
  },

  /**
   * Range validation messages
   */
  range: (
    _fieldName: string,
    min?: number,
    max?: number,
    previousValue?: number
  ): string => {
    if (previousValue !== undefined) {
      return `Odometer reading (${min?.toLocaleString()} mi) cannot be lower than previous (${previousValue.toLocaleString()} mi)`;
    }
    
    if (min !== undefined && max !== undefined) {
      return `Enter a value between ${min} and ${max}`;
    }
    
    if (min !== undefined) {
      return `Enter a value greater than ${min}`;
    }
    
    if (max !== undefined) {
      return `Enter a value less than ${max}`;
    }
    
    return "Enter a valid value";
  },

  /**
   * Checklist completion messages
   */
  checklist: (
    completed: number,
    required: number,
    itemLabel: string = "items"
  ): string => {
    return `Complete ${itemLabel}: ${completed}/${required} ${itemLabel} checked`;
  },

  /**
   * Photo/file messages
   */
  photo: (photoName: string, required: boolean = true): string => {
    if (required) {
      return `${photoName} photo is required before submitting`;
    }
    return `Please upload ${photoName} photo`;
  },

  /**
   * Signature messages
   */
  signature: (type?: string): string => {
    if (type) {
      return `${type} signature is required`;
    }
    return "At least one signature (Driver or Foreman) is required";
  },

  /**
   * Equipment-specific messages
   */
  equipment: {
    type: (): string => "Select an equipment type",
    number: (type?: string): string => {
      if (type) {
        return `Select a valid ${type} equipment number`;
      }
      return "Select a valid equipment number for the chosen type";
    },
  },

  /**
   * Generic validation message
   */
  generic: (message: string): string => message,
};

/**
 * Get a validation message based on error code and context
 */
export function getValidationMessage(
  errorCode: string,
  context?: ValidationMessageContext
): string {
  const { fieldName, previousValue, requiredCount, currentCount } = context || {};

  switch (errorCode) {
    case 'REQUIRED':
      return fieldName ? validationMessages.required(fieldName as string) : "This field is required";
    
    case 'FORMAT':
      return fieldName && context && (context.format as string)
        ? validationMessages.format(fieldName as string, context.format as string)
        : "Invalid format";
    
    case 'RANGE':
      return validationMessages.range(
        fieldName || 'value',
        context?.min as number | undefined,
        context?.max as number | undefined,
        previousValue as number | undefined
      );
    
    case 'CHECKLIST':
      return validationMessages.checklist(
        currentCount || 0,
        requiredCount || 0,
        context?.itemLabel as string | undefined
      );
    
    case 'PHOTO':
      return validationMessages.photo(
        fieldName || 'Photo',
        context?.required !== false
      );
    
    case 'SIGNATURE':
      return validationMessages.signature(context?.type as string | undefined);
    
    default:
      return (context?.message as string) || "Validation error";
  }
}
