/**
 * Admin Operations Hub
 * 
 * Unified page combining Work Sites, Crews, and Job Progress Tracker.
 * Enables admins to manage all operational elements from one interface.
 */

import { useState, useMemo, useCallback, useEffect, memo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, Marker } from '@react-google-maps/api';
import {
  Briefcase,
  MapPin,
  Users,
  Plus,
  Sparkles,
  Shield,
  AlertTriangle,
  Search,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  RefreshCw,
  MapPinOff,
  Crosshair,
  Map,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useJobs, useCrewMembers } from '../../hooks/jobs';
import { useCrews } from '../../hooks/useCrews';
import { useGoogleMaps, darkMapStyles } from '../../hooks/useGoogleMaps';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { calculateJobProgress } from '../../lib/jobProgressUtils';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';
import { toast } from '../../lib/toast';
import { JobList, JobCreationForm, JobTrackerErrorBoundary } from '../../components/jobs';
import { AdminSegmentedControl, type SegmentTab } from '../../components/admin/AdminSegmentedControl';
import { CrewManager } from '../../components/admin/CrewManager';
import { TextEffect } from '../../components/ui/TextEffect';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import type { JobFormData, JobStatus } from '../../types/jobs';

// =============================================================================
// TYPES
// =============================================================================

interface WorkSite {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
  crew_id: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkSiteFormData {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'atts:admin:operations:activeTab';
const DFW_CENTER = { lat: 32.7767, lng: -96.7970 };

const mapContainerStyle = {
  width: '100%',
  height: '180px',
  borderRadius: '12px',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: darkMapStyles,
  gestureHandling: 'cooperative',
  clickableIcons: true,
};

// =============================================================================
// TAB CONFIGURATION
// =============================================================================

function getOperationsTabs(sitesCount: number, crewsCount: number, jobsCount: number): SegmentTab[] {
  return [
    { 
      id: 'jobs', 
      label: 'Jobs', 
      shortLabel: 'Jobs',
      icon: <Briefcase className="w-4 h-4" />,
      badgeCount: jobsCount > 0 ? jobsCount : undefined,
    },
    { 
      id: 'sites', 
      label: 'Work Sites', 
      shortLabel: 'Sites',
      icon: <MapPin className="w-4 h-4" />,
      badgeCount: sitesCount > 0 ? sitesCount : undefined,
    },
    { 
      id: 'crews', 
      label: 'Crews', 
      shortLabel: 'Crews',
      icon: <Users className="w-4 h-4" />,
      badgeCount: crewsCount > 0 ? crewsCount : undefined,
    },
  ];
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function getPersistedTab(): string {
  if (typeof window === 'undefined') return 'jobs';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['jobs', 'sites', 'crews'].includes(stored)) return stored;
  } catch { /* ignore */ }
  return 'jobs';
}

function persistTab(tabId: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, tabId); } catch { /* ignore */ }
}

// =============================================================================
// WORK SITES COMPONENTS
// =============================================================================

function SitesEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#f4c979]/10 border border-[#f4c979]/20 flex items-center justify-center mb-4">
        <MapPinOff className="w-7 h-7 text-[#f4c979]/50" />
      </div>
      <h3 className="text-base font-semibold text-white/90 mb-2">No Work Sites Yet</h3>
      <p className="text-sm text-white/50 text-center max-w-sm mb-5">
        Add GPS locations for weather-based safety forecasting.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] font-semibold text-sm hover:scale-[1.02] transition-transform"
      >
        <Plus className="w-4 h-4" />
        Add First Site
      </button>
    </motion.div>
  );
}

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
  
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false);
  
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const hasValidCoordinates = useMemo(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  }, [form.latitude, form.longitude]);

  const mapCenter = useMemo(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
    return DFW_CENTER;
  }, [form.latitude, form.longitude]);

  const handleAddressChange = useCallback((value: string) => {
    setForm(prev => ({ ...prev, address: value }));
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
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

  const handleSelectPrediction = useCallback((prediction: PlacePrediction) => {
    setShowPredictions(false);
    setPredictions([]);
    setForm(prev => ({ ...prev, address: prediction.description }));

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
            name: prev.name || place.name || prediction.structured_formatting.main_text || '',
          }));
          
          setShowMap(true);
          toast.success('Location found!');
          sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
        }
      }
    );
  }, []);

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
        toast.success('Location captured!');
        
        if (window.google?.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results?.[0]) {
              setForm(prev => ({ ...prev, address: results[0].formatted_address }));
            }
          });
        }
      },
      () => {
        setGettingCurrentLocation(false);
        toast.error('Could not get location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const placeId = (e as google.maps.MapMouseEvent & { placeId?: string }).placeId;
    
    if (placeId && placesService.current) {
      setIsSearching(true);
      placesService.current.getDetails(
        { placeId, fields: ['geometry', 'formatted_address', 'name', 'types'] },
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
          }
        }
      );
      return;
    }
    
    setForm(prev => ({ ...prev, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
    
    if (window.google?.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          setForm(prev => ({ ...prev, address: results[0].formatted_address }));
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
        className="w-full max-w-md rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] shadow-2xl overflow-hidden my-auto"
      >
        <div className="px-5 py-4 border-b border-[#f6dcb2]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f4c979]/15 flex items-center justify-center">
              {isEdit ? <Pencil className="w-5 h-5 text-[#f4c979]" /> : <Plus className="w-5 h-5 text-[#f4c979]" />}
            </div>
            <div>
              <h3 className="font-semibold text-white">{isEdit ? 'Edit Site' : 'Add Work Site'}</h3>
              <p className="text-xs text-white/40">GPS location for forecasting</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Close site form">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Site Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Main Yard"
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40"
            />
          </div>

          <div className="relative" ref={inputRef}>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Address</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => predictions.length > 0 && setShowPredictions(true)}
                  placeholder="Search address..."
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#f4c979]/40 pr-10"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-[#f4c979] animate-spin" />
                  </div>
                )}
                
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
                            <p className="text-sm text-white truncate">{prediction.structured_formatting.main_text}</p>
                            <p className="text-xs text-white/50 truncate">{prediction.structured_formatting.secondary_text}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={gettingCurrentLocation}
                className="px-3 py-2.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30 text-[#f4c979] hover:bg-[#f4c979]/25 transition-colors disabled:opacity-50"
                title="Use current location"
              >
                {gettingCurrentLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isLoaded && !isApiKeyMissing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5" />
                  Map
                </label>
                {!showMap && !hasValidCoordinates && (
                  <button type="button" onClick={() => setShowMap(true)} className="text-xs text-[#f4c979]">
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
                          position={{ lat: parseFloat(form.latitude), lng: parseFloat(form.longitude) }}
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
                      Click to set location
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

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
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{isEdit ? 'Save' : 'Add Site'}</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// SITES TAB CONTENT
// =============================================================================

function SitesTabContent() {
  const [sites, setSites] = useState<WorkSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<WorkSite | null>(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const fetchSites = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('work_sites').select('*').order('name');
      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      logger.error('[Sites] Fetch error:', error);
      toast.error('Failed to load sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const filteredSites = useMemo(() => {
    let result = sites;
    if (!showInactive) result = result.filter(s => s.is_active);
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(query) || s.address?.toLowerCase().includes(query));
    }
    return result;
  }, [sites, debouncedSearch, showInactive]);

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
        const { error } = await supabase.from('work_sites').update(siteData).eq('id', editingSite.id);
        if (error) throw error;
        toast.success('Site updated');
      } else {
        const { error } = await supabase.from('work_sites').insert([{ ...siteData, is_active: true }]);
        if (error) throw error;
        toast.success('Site added');
      }

      setShowModal(false);
      setEditingSite(null);
      fetchSites();
    } catch (error) {
      logger.error('[Sites] Save error:', error);
      toast.error('Failed to save site');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (site: WorkSite) => {
    try {
      const { error } = await supabase.from('work_sites').update({ is_active: !site.is_active }).eq('id', site.id);
      if (error) throw error;
      toast.success(site.is_active ? 'Site deactivated' : 'Site activated');
      fetchSites();
    } catch (error) {
      logger.error('[Sites] Toggle error:', error);
      toast.error('Failed to update site');
    }
  };

  const handleDelete = async (site: WorkSite) => {
    if (!confirm(`Delete "${site.name}"?`)) return;
    try {
      const { error } = await supabase.from('work_sites').delete().eq('id', site.id);
      if (error) throw error;
      toast.success('Site deleted');
      fetchSites();
    } catch (error) {
      logger.error('[Sites] Delete error:', error);
      toast.error('Failed to delete site');
    }
  };

  if (loading) return <TableSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
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
              showInactive ? 'bg-[#f4c979]/15 border-[#f4c979]/30 text-[#f4c979]' : 'border-white/10 text-white/50 hover:text-white/70'
            }`}
          >
            {showInactive ? 'Hide' : 'Show'} Inactive
          </button>
          <button onClick={fetchSites} className="p-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/70 transition-colors" aria-label="Refresh work sites">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditingSite(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#332308] font-semibold text-sm hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        </div>
      </div>

      {filteredSites.length === 0 && !debouncedSearch ? (
        <SitesEmptyState onAdd={() => setShowModal(true)} />
      ) : (
        <div className="rounded-xl border border-[#f6dcb2]/15 overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#14110d]">
              <tr className="text-left text-xs text-white/50 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Address</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Coordinates</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSites.map((site) => (
                <tr key={site.id} className={site.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-4 h-4 ${site.is_active ? 'text-[#f4c979]' : 'text-white/30'}`} />
                      <span className="font-medium text-white/90 text-sm">{site.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/60 max-w-[200px] truncate hidden sm:table-cell">
                    {site.address || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/50 font-mono hidden md:table-cell">
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
                        onClick={() => { setEditingSite(site); setShowModal(true); }}
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
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSites.length === 0 && debouncedSearch && (
            <div className="py-8 text-center text-white/40 text-sm">No sites match "{debouncedSearch}"</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <SiteFormModal
            site={editingSite}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditingSite(null); }}
            isLoading={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// JOBS TAB CONTENT
// =============================================================================

function JobsTabContent({ userId }: { userId: string }) {
  const {
    jobs,
    loading: jobsLoading,
    createJob,
    updateJob,
    deleteJob,
    updateJobStatus,
    toggleMilestone,
    stackJobs,
    unstackJobs,
  } = useJobs();

  const { crewMembers, loading: crewLoading } = useCrewMembers();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const jobStats = useMemo(() => {
    const stats = { active: 0, exceeded: 0 };
    jobs.forEach(job => {
      if (job.status === 'active') stats.active++;
      if (job.status === 'active' && job.tracking_type !== 'job_progress') {
        const progress = calculateJobProgress(job.start_date, job.end_date);
        if (progress.status === 'exceeded') stats.exceeded++;
      }
    });
    return stats;
  }, [jobs]);

  const handleCreateJob = useCallback(async (data: JobFormData) => {
    const result = await createJob(data, userId);
    if (result.success) {
      setShowCreateForm(false);
      toast.success(`Job "${data.job_name}" created`);
    } else {
      toast.error(result.error || 'Failed to create job');
    }
    return result;
  }, [createJob, userId]);

  const handleUpdateJob = useCallback(async (jobId: string, data: JobFormData) => {
    const result = await updateJob(jobId, data, userId);
    if (result.success) toast.success('Job updated');
    else toast.error(result.error || 'Failed to update');
    return result;
  }, [updateJob, userId]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    const result = await deleteJob(jobId);
    if (result.success) toast.success('Job deleted');
    else toast.error(result.error || 'Failed to delete');
    return result;
  }, [deleteJob]);

  const handleStatusChange = useCallback(async (jobId: string, status: JobStatus) => {
    const result = await updateJobStatus(jobId, status);
    if (result.success) toast.success(`Status updated to ${status}`);
    else toast.error(result.error || 'Failed to update status');
    return result;
  }, [updateJobStatus]);

  const handleToggleMilestone = useCallback(async (milestoneId: string, isCompleted: boolean) => {
    const result = await toggleMilestone(milestoneId, isCompleted, userId);
    if (result.success) toast.success(isCompleted ? 'Milestone completed' : 'Milestone uncompleted');
    else toast.error(result.error || 'Failed to update milestone');
    return result;
  }, [toggleMilestone, userId]);

  return (
    <JobTrackerErrorBoundary>
      <div className="space-y-4">
        <AnimatePresence>
          {jobStats.exceeded > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-3"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-400">
                    {jobStats.exceeded} job{jobStats.exceeded !== 1 ? 's' : ''} exceeded timeline
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/30">
              <Briefcase className="w-5 h-5 text-[#f4c979]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">All Jobs</h3>
              <p className="text-xs text-white/50">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] text-sm font-semibold hover:shadow-[0_0_20px_rgba(244,201,121,0.3)] transition-shadow"
          >
            <Plus className="w-4 h-4" />
            Create Job
          </motion.button>
        </div>

        <JobList
          jobs={jobs}
          crewMembers={crewMembers}
          crewLoading={crewLoading}
          loading={jobsLoading}
          onUpdate={handleUpdateJob}
          onDelete={handleDeleteJob}
          onStatusChange={handleStatusChange}
          onToggleMilestone={handleToggleMilestone}
          onStackJobs={stackJobs}
          onUnstackJobs={unstackJobs}
          userId={userId}
        />

        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowCreateForm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-6 shadow-[0_40px_80px_rgba(0,0,0,0.7)]"
              >
                <JobCreationForm
                  crewMembers={crewMembers}
                  crewLoading={crewLoading}
                  onSubmit={handleCreateJob}
                  onCancel={() => setShowCreateForm(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </JobTrackerErrorBoundary>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function AdminOperationsHub() {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const userId = user?.id || '';
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state derived from URL or fallback to persisted
  const urlTab = searchParams.get('tab');
  
  // Derive activeTab: URL takes priority, then persisted value
  const activeTab = useMemo(() => {
    const validTabs = ['jobs', 'sites', 'crews'];
    if (urlTab && validTabs.includes(urlTab)) return urlTab;
    return getPersistedTab();
  }, [urlTab]);

  const handleTabChange = useCallback((tabId: string) => {
    persistTab(tabId);
    setSearchParams({ tab: tabId });
  }, [setSearchParams]);

  // Data for stats
  const { jobs } = useJobs();
  const { crews } = useCrews();
  const [sitesCount, setSitesCount] = useState(0);

  useEffect(() => {
    supabase.from('work_sites').select('id', { count: 'exact', head: true }).eq('is_active', true)
      .then(({ count }) => setSitesCount(count || 0));
  }, []);

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  const activeJobsCount = jobs.filter(j => j.status === 'active').length;
  const activeCrewsCount = crews.filter(c => c.is_active).length;

  const TABS = useMemo(
    () => getOperationsTabs(sitesCount, activeCrewsCount, activeJobsCount),
    [sitesCount, activeCrewsCount, activeJobsCount]
  );

  if (!isAdmin) {
    return (
      <DashboardLayout title="Operations Hub">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Operations Hub">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Header */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
                backdropFilter: 'blur(24px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
                    <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">Admin Operations</span>
                  </motion.div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20 text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">
                      <MapPin className="w-3 h-3 text-[#f4c979]" />
                      {sitesCount} sites
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20 text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">
                      <Users className="w-3 h-3 text-[#f4c979]" />
                      {activeCrewsCount} crews
                    </span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20 text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">
                      <Briefcase className="w-3 h-3 text-[#f4c979]" />
                      {activeJobsCount} jobs
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-12 md:h-14 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(244, 201, 121, 0.5)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]">
                        Operations Hub
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">
                        Operations Hub
                      </h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium">
                      Manage work sites, crews, and job assignments
                    </motion.p>
                  </div>
                </div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="mt-4">
                  <AdminSegmentedControl tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === 'jobs' && (
              <motion.div
                key="jobs"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <JobsTabContent userId={userId} />
              </motion.div>
            )}
            {activeTab === 'sites' && (
              <motion.div
                key="sites"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <SitesTabContent />
              </motion.div>
            )}
            {activeTab === 'crews' && (
              <motion.div
                key="crews"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <CrewManager userId={userId} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default memo(AdminOperationsHub);
