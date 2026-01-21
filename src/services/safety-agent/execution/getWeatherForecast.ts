/**
 * Weather Forecast Execution Script
 * 
 * Fetches weather data from OpenWeatherMap One Call API 3.0
 * and calculates risk factors for the Safety Forecast system.
 * 
 * @see directives/admin_safety_forecast_6_30am.md
 */

// Deno runtime type declaration for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

export interface WeatherRiskFactors {
  windGust: number;       // mph (max for next 8 hours)
  heatIndex: number;      // °F (max for next 8 hours)
  precipitation: number;  // probability 0-1 (max for next 8 hours)
  alerts: string[];       // NWS alerts active in the area
  tempHigh: number;       // °F (max for next 8 hours)
  humidity: number;       // % (max for next 8 hours)
  conditions: string;     // Primary weather condition description
}

export interface WeatherApiResponse {
  lat: number;
  lon: number;
  timezone: string;
  current: {
    temp: number;
    humidity: number;
    wind_speed: number;
    wind_gust?: number;
    weather: Array<{ main: string; description: string }>;
  };
  hourly: Array<{
    dt: number;
    temp: number;
    humidity: number;
    wind_speed: number;
    wind_gust?: number;
    pop: number; // Probability of precipitation
    weather: Array<{ main: string; description: string }>;
  }>;
  alerts?: Array<{
    event: string;
    description: string;
    start: number;
    end: number;
  }>;
}

// Cache for weather data to avoid redundant API calls
const weatherCache = new Map<string, { data: WeatherRiskFactors; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Calculate the NWS heat index from temperature and humidity.
 * Uses the Rothfusz regression equation from NOAA.
 * 
 * @see https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
 */
export function calculateHeatIndex(tempF: number, humidity: number): number {
  // Heat index only applies at temps >= 80°F
  if (tempF < 80) return tempF;

  const T = tempF;
  const R = humidity;

  // Simple approximation for moderate conditions
  let hi = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (R * 0.094));

  // If average with temp is >= 80, use full Rothfusz regression
  if ((hi + T) / 2 >= 80) {
    hi = -42.379 +
      2.04901523 * T +
      10.14333127 * R -
      0.22475541 * T * R -
      0.00683783 * T * T -
      0.05481717 * R * R +
      0.00122874 * T * T * R +
      0.00085282 * T * R * R -
      0.00000199 * T * T * R * R;

    // Adjustments for extreme conditions
    if (R < 13 && T >= 80 && T <= 112) {
      hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    } else if (R > 85 && T >= 80 && T <= 87) {
      hi += ((R - 85) / 10) * ((87 - T) / 5);
    }
  }

  return hi;
}

/**
 * Generate cache key from coordinates (rounded to 3 decimal places)
 */
function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Fetch weather risk factors for a given location.
 * Results are cached for 30 minutes to avoid redundant API calls.
 * 
 * @param lat Latitude in decimal degrees
 * @param lon Longitude in decimal degrees
 * @param apiKey OpenWeatherMap API key (optional, uses env var if not provided)
 * @returns Weather risk factors for the next 8 hours
 * @throws Error if API key is missing or API call fails
 */
export async function getWeatherRiskFactors(
  lat: number,
  lon: number,
  apiKey?: string
): Promise<WeatherRiskFactors> {
  const key = apiKey || (typeof Deno !== 'undefined' ? Deno.env.get('OPENWEATHER_API_KEY') : process.env.OPENWEATHER_API_KEY);
  
  if (!key) {
    throw new Error('OPENWEATHER_API_KEY not configured');
  }

  // Check cache first
  const cacheKey = getCacheKey(lat, lon);
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch from API
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily&units=imperial&appid=${key}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Weather API error: ${response.status} - ${errorText}`);
  }

  const data: WeatherApiResponse = await response.json();
  
  // Get max values for next 8 hours (work shift window)
  const next8Hours = data.hourly.slice(0, 8);
  
  if (next8Hours.length === 0) {
    throw new Error('No hourly forecast data available');
  }

  // Calculate max wind gust (use wind_gust if available, else wind_speed)
  const maxWindGust = Math.max(
    ...next8Hours.map((h) => h.wind_gust ?? h.wind_speed)
  );

  // Get max temperature and humidity for heat index calculation
  const maxTemp = Math.max(...next8Hours.map((h) => h.temp));
  const maxHumidity = Math.max(...next8Hours.map((h) => h.humidity));
  
  // Calculate heat index from worst-case temp/humidity combo
  const heatIndex = calculateHeatIndex(maxTemp, maxHumidity);

  // Get max precipitation probability
  const maxPrecipProb = Math.max(...next8Hours.map((h) => h.pop));

  // Get any active weather alerts
  const alerts = (data.alerts || []).map((a) => a.event);

  // Get primary weather condition
  const conditions = data.current.weather[0]?.description || 'Unknown';

  const riskFactors: WeatherRiskFactors = {
    windGust: Math.round(maxWindGust),
    heatIndex: Math.round(heatIndex),
    precipitation: maxPrecipProb,
    alerts,
    tempHigh: Math.round(maxTemp),
    humidity: Math.round(maxHumidity),
    conditions: conditions.charAt(0).toUpperCase() + conditions.slice(1),
  };

  // Cache the result
  weatherCache.set(cacheKey, { data: riskFactors, timestamp: Date.now() });

  return riskFactors;
}

/**
 * Fetch weather for multiple locations in batch.
 * Deduplicates requests for nearby coordinates.
 * 
 * @param locations Array of { lat, lon } objects
 * @returns Map of cache key to weather risk factors
 */
export async function getWeatherForMultipleLocations(
  locations: Array<{ lat: number; lon: number }>,
  apiKey?: string
): Promise<Map<string, WeatherRiskFactors>> {
  const results = new Map<string, WeatherRiskFactors>();
  const uniqueKeys = new Set<string>();

  // Deduplicate by cache key
  for (const loc of locations) {
    uniqueKeys.add(getCacheKey(loc.lat, loc.lon));
  }

  // Fetch all unique locations
  const fetchPromises = Array.from(uniqueKeys).map(async (key) => {
    const [lat, lon] = key.split(',').map(Number);
    try {
      const weather = await getWeatherRiskFactors(lat, lon, apiKey);
      results.set(key, weather);
    } catch (error) {
      console.error(`Failed to fetch weather for ${key}:`, error);
      // Don't throw - allow partial results
    }
  });

  await Promise.all(fetchPromises);

  return results;
}

/**
 * Get weather risk factors with fallback for API failures.
 * Returns default "unknown" values if API is unavailable.
 */
export async function getWeatherRiskFactorsSafe(
  lat: number,
  lon: number,
  apiKey?: string
): Promise<WeatherRiskFactors & { isDefault: boolean }> {
  try {
    const weather = await getWeatherRiskFactors(lat, lon, apiKey);
    return { ...weather, isDefault: false };
  } catch (error) {
    console.error('Weather API failed, using defaults:', error);
    return {
      windGust: 0,
      heatIndex: 70, // Neutral
      precipitation: 0,
      alerts: [],
      tempHigh: 70,
      humidity: 50,
      conditions: 'Unknown (API unavailable)',
      isDefault: true,
    };
  }
}

/**
 * Clear the weather cache (useful for testing)
 */
export function clearWeatherCache(): void {
  weatherCache.clear();
}
