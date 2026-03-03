export type NearMissCategory =
  | 'fall_hazard'
  | 'struck_by'
  | 'electrical'
  | 'caught_in'
  | 'vehicle'
  | 'environmental'
  | 'ergonomic'
  | 'other';

export interface NearMissReport {
  category: NearMissCategory;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  suggested_corrective_action: string;
  photos: string[];
}
