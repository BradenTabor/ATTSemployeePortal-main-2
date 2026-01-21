/**
 * Weather API integration for fetching site weather data
 */

import { WeatherRiskFactors } from './types.ts';

// =============================================================================
// HEAT INDEX CALCULATION
// =============================================================================

export function calculateHeatIndex(tempF: number, humidity: number): number {
  if (tempF < 80) return tempF;
  
  const T = tempF, R = humidity;
  let hi = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (R * 0.094));
  
  if ((hi + T) / 2 >= 80) {
    hi = -42.379 + 2.04901523*T + 10.14333127*R - 0.22475541*T*R 
      - 0.00683783*T*T - 0.05481717*R*R + 0.00122874*T*T*R 
      + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
  }
  
  return hi;
}

// =============================================================================
// WEATHER API
// =============================================================================

export async function getWeatherForSite(
  lat: number, 
  lon: number,
  apiKey: string
): Promise<WeatherRiskFactors> {
  if (!apiKey) {
    console.warn('[Weather] API key not configured, using defaults');
    return {
      windGust: 0,
      heatIndex: 70,
      precipitation: 0,
      alerts: [],
      conditions: 'Unknown (API unavailable)',
    };
  }

  try {
    // Use OpenWeatherMap 2.5 API (free tier) - fetch both current and forecast
    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&cnt=8&appid=${apiKey}`)
    ]);
    
    if (!currentRes.ok || !forecastRes.ok) {
      console.error('[Weather] API error:', currentRes.status, forecastRes.status);
      throw new Error(`Weather API error: ${currentRes.status}/${forecastRes.status}`);
    }

    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();
    
    // Get current conditions
    const conditions = currentData.weather?.[0]?.description || 'Unknown';
    const currentWindGust = currentData.wind?.gust || currentData.wind?.speed || 0;
    
    // Process forecast data (3-hour intervals, next 24 hours = 8 entries)
    const forecasts = forecastData.list || [];
    
    if (forecasts.length === 0) {
      throw new Error('No forecast data');
    }

    // Find max values across forecast period
    const maxWindGust = Math.max(
      currentWindGust,
      // deno-lint-ignore no-explicit-any
      ...forecasts.map((f: any) => f.wind?.gust || f.wind?.speed || 0)
    );
    const maxTemp = Math.max(
      currentData.main?.temp || 70,
      // deno-lint-ignore no-explicit-any
      ...forecasts.map((f: any) => f.main?.temp || 70)
    );
    const maxHumidity = Math.max(
      currentData.main?.humidity || 50,
      // deno-lint-ignore no-explicit-any
      ...forecasts.map((f: any) => f.main?.humidity || 50)
    );
    // 2.5 API uses 'pop' (probability of precipitation) as 0-1 decimal
    // deno-lint-ignore no-explicit-any
    const maxPrecipProb = Math.max(...forecasts.map((f: any) => f.pop || 0));
    
    // Note: 2.5 API doesn't include weather alerts (only available in 3.0)
    const alerts: string[] = [];

    return {
      windGust: Math.round(maxWindGust),
      heatIndex: Math.round(calculateHeatIndex(maxTemp, maxHumidity)),
      precipitation: maxPrecipProb,
      alerts,
      conditions: conditions.charAt(0).toUpperCase() + conditions.slice(1),
    };
  } catch (error) {
    console.error('[Weather] Failed for', lat, lon, error);
    return {
      windGust: 0,
      heatIndex: 70,
      precipitation: 0,
      alerts: [],
      conditions: 'Unknown (API error)',
    };
  }
}
