/**
 * Admin Work Sites Management Page
 * 
 * Manage GPS-enabled work sites for the Safety Forecast feature.
 * Sites are used to fetch location-specific weather data.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { 
  MapPin, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Check, 
  MapPinOff,
  Navigation,
  Loader2,
  RefreshCw,
  CloudSun,
  Building2,
  Crosshair,
  Map
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { logger } from "../../lib/logger";
import { TextEffect } from "../../components/ui/TextEffect";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import TableSkeleton from "../../components/skeletons/TableSkeleton";
import { useGoogleMaps, darkMapStyles } from "../../hooks/useGoogleMaps";

interface WorkSite {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  region: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkSiteFormData {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
}


// Default center for DFW area
const DFW_CENTER = { lat: 32.7767, lng: -96.7970 };

// Google Maps container style for the preview
const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '12px',
};

// Map options for dark theme - clickableIcons enables POI clicks
const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: darkMapStyles,
  gestureHandling: 'cooperative',
  clickableIcons: true, // Allow clicking on POIs (businesses, landmarks)
};

// Place prediction type
interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// Format coordinates for display
function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

// Empty state component
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-[#f4c979]/10 border border-[#f4c979]/20 flex items-center justify-center mb-4">
        <MapPinOff className="w-8 h-8 text-[#f4c979]/50" />
      </div>
      <h3 className="text-lg font-semibold text-white/90 mb-2">No Work Sites Yet</h3>
      <p className="text-sm text-white/50 text-center max-w-md mb-6">
        Add work sites with GPS coordinates to enable location-specific weather forecasting 
        in your daily Safety Forecast emails.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] font-semibold text-sm shadow-lg hover:scale-[1.02] transition-transform"
      >
        <Plus className="w-4 h-4" />
        Add First Site
      </button>
    </motion.div>
  );
}

// Site card for mobile view
function MobileSiteCard({ 
  site, 
  onEdit, 
  onToggleActive, 
  onDelete 
}: { 
  site: WorkSite; 
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-xl border p-4 ${
        site.is_active 
          ? 'bg-gradient-to-br from-[#14110d] to-[#0b0906] border-[#f6dcb2]/20' 
          : 'bg-[#0a0908] border-white/5 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            site.is_active ? 'bg-[#f4c979]/15' : 'bg-white/5'
          }`}>
            <MapPin className={`w-4 h-4 ${site.is_active ? 'text-[#f4c979]' : 'text-white/30'}`} />
          </div>
          <div>
            <h4 className="font-semibold text-white/90 text-sm">{site.name}</h4>
          </div>
        </div>
        <button
          onClick={onToggleActive}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
            site.is_active
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/5 text-white/40 border border-white/10'
          }`}
        >
          {site.is_active ? 'Active' : 'Inactive'}
        </button>
      </div>

      {site.address && (
        <p className="text-xs text-white/50 mb-2 line-clamp-2">{site.address}</p>
      )}

      <div className="flex items-center gap-2 text-[10px] text-white/40 mb-3">
        <Navigation className="w-3 h-3" />
        <span>{formatCoords(site.latitude, site.longitude)}</span>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

// Add/Edit Modal with Google Maps Integration
function SiteFormModal({
  site,
  onSave,
  onClose,
  isLoading
}: {
  site: WorkSite | null;
  onSave: (data: WorkSiteFormData) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const isEdit = !!site;
  const { isLoaded, isApiKeyMissing } = useGoogleMaps();
  
  const [form, setForm] = useState<WorkSiteFormData>({
    name: site?.name || '',
    address: site?.address || '',
    latitude: site?.latitude?.toString() || '',
    longitude: site?.longitude?.toString() || '',
  });
  
  // Google Places state
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false);
  
  // Refs for Google services
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Google services when API is loaded
  useEffect(() => {
    if (!isLoaded || isApiKeyMissing) return;
    
    const initServices = () => {
      if (window.google?.maps?.places) {
        autocompleteService.current = new window.google.maps.places.AutocompleteService();
        const div = document.createElement('div');
        placesService.current = new window.google.maps.places.PlacesService(div);
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
        return true;
      }
      return false;
    };

    if (!initServices()) {
      const interval = setInterval(() => {
        if (initServices()) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isLoaded, isApiKeyMissing]);

  // Derive if we have valid coordinates (avoids useEffect setState pattern)
  const hasValidCoordinates = useMemo(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  }, [form.latitude, form.longitude]);

  // Current map center based on form or default
  const mapCenter = useMemo(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
    return DFW_CENTER;
  }, [form.latitude, form.longitude]);

  // Handle address input change with autocomplete
  const handleAddressChange = useCallback((value: string) => {
    setForm(prev => ({ ...prev, address: value }));
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    if (!value.trim() || !autocompleteService.current) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(() => {
      autocompleteService.current?.getPlacePredictions(
        {
          input: value,
          sessionToken: sessionToken.current || undefined,
          componentRestrictions: { country: 'us' },
        },
        (results, status) => {
          setIsSearching(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results.slice(0, 5) as PlacePrediction[]);
            setShowPredictions(true);
          } else {
            setPredictions([]);
            setShowPredictions(false);
          }
        }
      );
    }, 300);
  }, []);

  // Handle selecting a prediction
  const handleSelectPrediction = useCallback((prediction: PlacePrediction) => {
    setShowPredictions(false);
    setPredictions([]);
    setForm(prev => ({ ...prev, address: prediction.description }));

    // Get place details for coordinates
    if (!placesService.current) return;
    
    setIsSearching(true);
    placesService.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'formatted_address', 'name'],
        sessionToken: sessionToken.current || undefined,
      },
      (place, status) => {
        setIsSearching(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          
          setForm(prev => ({
            ...prev,
            address: place.formatted_address || prediction.description,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
            // Auto-fill name if empty
            name: prev.name || place.name || prediction.structured_formatting.main_text || '',
          }));
          
          setShowMap(true);
          toast.success('Location found! Coordinates auto-filled.');
          
          // Reset session token
          sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
        } else {
          toast.error('Could not get location details');
        }
      }
    );
  }, []);

  // Get current location
  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    setGettingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        setForm(prev => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        }));
        setShowMap(true);
        setGettingCurrentLocation(false);
        toast.success('Current location captured!');
        
        // Reverse geocode to get address
        if (window.google?.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results?.[0]) {
              setForm(prev => ({
                ...prev,
                address: results[0].formatted_address,
              }));
            }
          });
        }
      },
      (error) => {
        setGettingCurrentLocation(false);
        logger.error('[Location] Error:', error);
        toast.error('Could not get location. Check permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Handle map click to set coordinates - supports both POI clicks and arbitrary clicks
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    // Check if a Place of Interest (POI) was clicked
    // The placeId property exists when clicking on a business/landmark on the map
    const placeId = (e as google.maps.MapMouseEvent & { placeId?: string }).placeId;
    
    if (placeId && placesService.current) {
      // User clicked on a POI - fetch full place details
      setIsSearching(true);
      placesService.current.getDetails(
        {
          placeId: placeId,
          fields: ['geometry', 'formatted_address', 'name', 'types'],
        },
        (place, status) => {
          setIsSearching(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            const placeLat = place.geometry?.location?.lat() || lat;
            const placeLng = place.geometry?.location?.lng() || lng;
            
            setForm(prev => ({
              ...prev,
              name: prev.name || place.name || '',
              address: place.formatted_address || '',
              latitude: placeLat.toFixed(6),
              longitude: placeLng.toFixed(6),
            }));
            
            toast.success(`Selected: ${place.name || 'Location'}`);
          } else {
            // Fallback to just using coordinates
            setForm(prev => ({
              ...prev,
              latitude: lat.toFixed(6),
              longitude: lng.toFixed(6),
            }));
          }
        }
      );
      return;
    }
    
    // No POI clicked - use coordinates directly and reverse geocode
    setForm(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    
    // Reverse geocode to get address
    if (window.google?.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          setForm(prev => ({
            ...prev,
            address: results[0].formatted_address,
          }));
          toast.success('Location set from map');
        }
      });
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast.error('Site name is required');
      return;
    }
    if (!form.latitude || !form.longitude) {
      toast.error('Coordinates are required');
      return;
    }

    onSave(form);
  };

  // Close predictions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowPredictions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f6dcb2]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f4c979]/15 flex items-center justify-center">
              {isEdit ? <Pencil className="w-5 h-5 text-[#f4c979]" /> : <Plus className="w-5 h-5 text-[#f4c979]" />}
            </div>
            <div>
              <h3 className="font-semibold text-white">{isEdit ? 'Edit Work Site' : 'Add Work Site'}</h3>
              <p className="text-xs text-white/40">
                {isLoaded && !isApiKeyMissing ? 'Search or click map to set location' : 'Enter GPS coordinates'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close work site form"
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Site Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Dallas Main Yard"
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40"
            />
          </div>

          {/* Address with Google Places Autocomplete */}
          <div className="relative" ref={inputRef}>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Address
              {isLoaded && !isApiKeyMissing && (
                <span className="ml-2 text-[#f4c979]/60">(Google Maps enabled)</span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => predictions.length > 0 && setShowPredictions(true)}
                  placeholder="Start typing to search..."
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40 pr-10"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-[#f4c979] animate-spin" />
                  </div>
                )}
                
                {/* Predictions dropdown */}
                <AnimatePresence>
                  {showPredictions && predictions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-[#f4c979]/20 bg-[#14110d] shadow-xl overflow-hidden"
                    >
                      {predictions.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          type="button"
                          onClick={() => handleSelectPrediction(prediction)}
                          className="w-full px-3 py-2.5 text-left hover:bg-[#f4c979]/10 transition-colors flex items-start gap-2"
                        >
                          <MapPin className="w-4 h-4 text-[#f4c979] flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">
                              {prediction.structured_formatting.main_text}
                            </p>
                            <p className="text-xs text-white/50 truncate">
                              {prediction.structured_formatting.secondary_text}
                            </p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Current location button */}
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={gettingCurrentLocation}
                className="px-3 py-2.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30 text-[#f4c979] hover:bg-[#f4c979]/25 transition-colors disabled:opacity-50"
                title="Use current location"
              >
                {gettingCurrentLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crosshair className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-1">
              {isLoaded && !isApiKeyMissing 
                ? 'Type to search or use current location' 
                : 'Enter address manually'}
            </p>
          </div>

          {/* Map Preview */}
          {isLoaded && !isApiKeyMissing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5" />
                  Map Preview
                </label>
                {!showMap && !hasValidCoordinates && (
                  <button
                    type="button"
                    onClick={() => setShowMap(true)}
                    className="text-xs text-[#f4c979] hover:text-[#f4c979]/80"
                  >
                    Show map
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {(showMap || hasValidCoordinates) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl overflow-hidden border border-white/10"
                  >
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={mapCenter}
                      zoom={14}
                      options={mapOptions}
                      onClick={handleMapClick}
                    >
                      {form.latitude && form.longitude && (
                        <Marker
                          position={{
                            lat: parseFloat(form.latitude),
                            lng: parseFloat(form.longitude),
                          }}
                          icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#f4c979',
                            fillOpacity: 1,
                            strokeColor: '#332308',
                            strokeWeight: 2,
                          }}
                        />
                      )}
                    </GoogleMap>
                    <p className="text-[10px] text-white/40 text-center py-1.5 bg-black/40">
                      Click a place or anywhere on the map to auto-fill location
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Latitude *</label>
              <input
                type="text"
                value={form.latitude}
                onChange={(e) => setForm(prev => ({ ...prev, latitude: e.target.value }))}
                placeholder="32.7767"
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Longitude *</label>
              <input
                type="text"
                value={form.longitude}
                onChange={(e) => setForm(prev => ({ ...prev, longitude: e.target.value }))}
                placeholder="-96.7970"
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40 font-mono"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {isEdit ? 'Save Changes' : 'Add Site'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function AdminWorkSites() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [sites, setSites] = useState<WorkSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<WorkSite | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Fetch sites
  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_sites')
        .select('*')
        .order('name');

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      logger.error('[AdminWorkSites] Failed to fetch:', error);
      toast.error('Failed to load work sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Filter sites
  const filteredSites = useMemo(() => {
    let result = sites;
    
    if (!showInactive) {
      result = result.filter(s => s.is_active);
    }
    
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.address?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [sites, debouncedSearch, showInactive]);

  // Save site (add or update)
  const handleSave = async (formData: WorkSiteFormData) => {
    setSaving(true);
    try {
      const siteData = {
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
      };

      if (editingSite) {
        // Update
        const { error } = await supabase
          .from('work_sites')
          .update(siteData)
          .eq('id', editingSite.id);
        
        if (error) throw error;
        toast.success('Site updated successfully');
      } else {
        // Insert
        const { error } = await supabase
          .from('work_sites')
          .insert([{ ...siteData, is_active: true }]);
        
        if (error) throw error;
        toast.success('Site added successfully');
      }

      setShowModal(false);
      setEditingSite(null);
      fetchSites();
    } catch (error) {
      logger.error('[AdminWorkSites] Save failed:', error);
      toast.error('Failed to save site');
    } finally {
      setSaving(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (site: WorkSite) => {
    try {
      const { error } = await supabase
        .from('work_sites')
        .update({ is_active: !site.is_active })
        .eq('id', site.id);

      if (error) throw error;
      toast.success(site.is_active ? 'Site deactivated' : 'Site activated');
      fetchSites();
    } catch (error) {
      logger.error('[AdminWorkSites] Toggle failed:', error);
      toast.error('Failed to update site');
    }
  };

  // Delete site
  const handleDelete = async (site: WorkSite) => {
    if (!confirm(`Are you sure you want to delete "${site.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('work_sites')
        .delete()
        .eq('id', site.id);

      if (error) throw error;
      toast.success('Site deleted');
      fetchSites();
    } catch (error) {
      logger.error('[AdminWorkSites] Delete failed:', error);
      toast.error('Failed to delete site');
    }
  };

  // Authorization check
  if (!isAdmin) {
    return (
      <DashboardLayout title="Work Sites">
        <div className="max-w-xl mx-auto mt-10 text-center text-sm text-gray-300">
          You do not have permission to view this page.
        </div>
      </DashboardLayout>
    );
  }

  const activeCount = sites.filter(s => s.is_active).length;

  return (
    <DashboardLayout title="Work Sites">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f4c979]/20 to-[#d79a32]/10 border border-[#f4c979]/30 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#f4c979]" />
              </div>
              <div>
                <TextEffect
                  as="h1"
                  preset="fade"
                  className="text-xl sm:text-2xl font-bold text-white"
                >
                  Work Sites
                </TextEffect>
                <p className="text-xs text-white/50 flex items-center gap-1.5">
                  <CloudSun className="w-3 h-3" />
                  {activeCount} active site{activeCount !== 1 ? 's' : ''} for weather forecasting
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingSite(null);
                setShowModal(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] font-semibold text-sm shadow-lg hover:scale-[1.02] transition-transform"
            >
              <Plus className="w-4 h-4" />
              Add Site
            </button>
          </div>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sites..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                showInactive
                  ? 'bg-[#f4c979]/15 border-[#f4c979]/30 text-[#f4c979]'
                  : 'border-white/10 text-white/50 hover:text-white/70'
              }`}
            >
              {showInactive ? 'Hide' : 'Show'} Inactive
            </button>
            <button
              onClick={fetchSites}
              className="p-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/70 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <TableSkeleton rows={5} />
        ) : filteredSites.length === 0 && !debouncedSearch ? (
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredSites.map((site) => (
                  <MobileSiteCard
                    key={site.id}
                    site={site}
                    onEdit={() => {
                      setEditingSite(site);
                      setShowModal(true);
                    }}
                    onToggleActive={() => handleToggleActive(site)}
                    onDelete={() => handleDelete(site)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block rounded-xl border border-[#f6dcb2]/15 overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#14110d]">
                  <tr className="text-left text-xs text-white/50 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Site</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">Coordinates</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {filteredSites.map((site) => (
                      <motion.tr
                        key={site.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`${site.is_active ? '' : 'opacity-50'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <MapPin className={`w-4 h-4 ${site.is_active ? 'text-[#f4c979]' : 'text-white/30'}`} />
                            <span className="font-medium text-white/90 text-sm">{site.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-white/60 max-w-[200px] truncate">
                          {site.address || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-white/50 font-mono">
                          {formatCoords(site.latitude, site.longitude)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleActive(site)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              site.is_active
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {site.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingSite(site);
                                setShowModal(true);
                              }}
                              className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white/80 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(site)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {filteredSites.length === 0 && debouncedSearch && (
                <div className="py-12 text-center text-white/40 text-sm">
                  No sites match "{debouncedSearch}"
                </div>
              )}
            </div>
          </>
        )}

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 rounded-xl border border-[#f4c979]/15 bg-[#f4c979]/5"
        >
          <div className="flex items-start gap-3">
            <CloudSun className="w-5 h-5 text-[#f4c979] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-white/60 space-y-1">
              <p className="font-medium text-white/80">How Work Sites Are Used</p>
              <p>Active work sites are included in the daily <strong>Safety Forecast</strong> email at 6:30 AM.</p>
              <p>Each site gets its own weather forecast with risk scoring based on wind, heat, and precipitation.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <SiteFormModal
            site={editingSite}
            onSave={handleSave}
            onClose={() => {
              setShowModal(false);
              setEditingSite(null);
            }}
            isLoading={saving}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
