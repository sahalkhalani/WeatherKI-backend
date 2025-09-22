import axios from 'axios';
import { CacheService } from './cacheService';
import { errorMessages } from '../helpers/message.helper';

export interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  description: string;
  cityName: string;
  country: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

export class WeatherService {
  private cacheService: CacheService<WeatherData>;
  private readonly CACHE_DURATION = parseInt(process.env.CACHE_DURATION_MINUTES || '5') * 60 * 1000; // 5 minutes default

  constructor() {
    this.cacheService = new CacheService<WeatherData>(this.CACHE_DURATION);
  }

  private getWeatherIcon(weatherCode: number): string {
    // Open-Meteo Weather Code
    if (weatherCode === 0) return '☀️';
    if (weatherCode <= 3) return '⛅';
    if (weatherCode <= 48) return '🌫️';
    if (weatherCode <= 67) return '🌧️';
    if (weatherCode <= 77) return '🌨️';
    if (weatherCode <= 82) return '🌦️';
    if (weatherCode <= 99) return '⛈️';
    return '🌤️';
  }

  private getWeatherDescription(weatherCode: number): string {
    const descriptions: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Thunderstorm with heavy hail'
    };
    return descriptions[weatherCode] || 'Unknown';
  }

  private async geocodeLocation(location: string): Promise<GeocodeResult> {
    try {
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
      const response = await axios.get(geocodeUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Weather-Dashboard/1.0',
        },
      });
      
      if (!response.data.results || response.data.results.length === 0) {
        throw new Error(errorMessages.LocationNotFound);
      }

      const result = response.data.results[0];
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        name: result.name,
        country: result.country,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(errorMessages.ServiceTimeoutError('Geocoding'));
        }
        throw new Error(`Geocoding API error: ${error.response?.status || 'Network error'}`);
      }
      throw error;
    }
  }

  private async fetchWeatherData(latitude: number, longitude: number): Promise<any> {
    try {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
      
      const response = await axios.get(weatherUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Weather-Dashboard/1.0',
        },
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(errorMessages.ServiceTimeoutError('Weather'));
        }
        throw new Error(`Weather API error: ${error.response?.status || 'Network error'}`);
      }
      throw error;
    }
  }

  async getWeatherForLocation(location: string): Promise<WeatherData> {
    const cacheKey = location.toLowerCase().trim();
    
    // Check cache first
    const cachedData = this.cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for location: ${location}`);
      return cachedData;
    }

    console.log(`Cache miss for location: ${location}, fetching fresh data...`);

    try {
      // Get coordinates for the location
      const geocodeResult = await this.geocodeLocation(location);
      
      // Get weather data
      const weatherData = await this.fetchWeatherData(geocodeResult.latitude, geocodeResult.longitude);
      const current = weatherData.current;

      const weatherInfo: WeatherData = {
        temperature: Math.round(current.temperature_2m),
        condition: this.getWeatherDescription(current.weather_code),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m * 10) / 10,
        icon: this.getWeatherIcon(current.weather_code),
        description: this.getWeatherDescription(current.weather_code),
        cityName: geocodeResult.name,
        country: geocodeResult.country
      };

      // Cache the result
      this.cacheService.set(cacheKey, weatherInfo);
      
      return weatherInfo;
    } catch (error) {
      console.error('Weather service error:', error);
      throw error;
    }
  }

  clearExpiredCache(): void {
    this.cacheService.clearExpired();
  }

  getCacheStats(): any {
    return this.cacheService.getStats();
  }
}