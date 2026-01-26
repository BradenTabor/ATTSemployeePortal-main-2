/**
 * DVIR Form Module
 * 
 * Barrel exports for the DVIR form components, types, and constants.
 */

// Types and constants
export * from './types';

// Components
export {
  SectionCard,
  MileageInput,
  ChecklistQuickActions,
  FormProgress,
  UploadTile,
  SignaturePad,
} from './components';

// Sections
export { SectionA } from './sections/SectionA';

export type {
  ProgressStep,
  SignaturePadHandle,
} from './components';
