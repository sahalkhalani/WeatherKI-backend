import { Request, Response } from 'express';
import { WeatherService } from '../services/weatherService';
import { errorMessages, successMessages } from '../helpers/message.helper';

export class WeatherController {
  private weatherService: WeatherService;

  constructor() {
    this.weatherService = new WeatherService();
  }

  // Weather data for a location
  async getWeatherData(req: Request, res: Response): Promise<void> {
    try {
      const { location } = req.params;

      if (!location || typeof location !== 'string' || location.trim().length === 0) {
        res.status(400).json({
          error: errorMessages.InvalidLocation,
          message: errorMessages.LocationRequired,
        });
        return;
      }

      const weatherData = await this.weatherService.getWeatherForLocation(location.trim());
      
      res.json(weatherData);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            error: errorMessages.LocationNotFound,
            message: error.message,
          });
        } else if (error.message.includes('API')) {
          res.status(503).json({
            error: errorMessages.WeatherServiceUnavailableError,
            message: errorMessages.WeatherServiceUnavailableMessage,
          });
        } else {
          res.status(500).json({
            error: errorMessages.FailedToFetchWeatherData,
            message: error.message,
          });
        }
      } else {
        res.status(500).json({
          error: errorMessages.InternalServerError,
          message: errorMessages.InternalServerMessage,
        });
      }
    }
  }

  // Clear weather cache
  async clearCache(req: Request, res: Response): Promise<void> {
    try {
      this.weatherService.clearExpiredCache();
      res.json({
        message: successMessages.CacheCleared,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        error: errorMessages.FailedToClearCacheError,
        message: errorMessages.FailedToClearCacheMessage,
      });
    }
  }

  // Get cache statistics
  async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.weatherService.getCacheStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({
        error: errorMessages.CacheStatisticsError,
        message: errorMessages.CacheStatisticsMessage,
      });
    }
  }
}

export default new WeatherController();