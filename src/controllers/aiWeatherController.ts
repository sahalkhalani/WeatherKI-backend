import { Request, Response } from 'express';
import axios from 'axios';

interface WeatherData {
  main: {
    temp: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
  }>;
  wind: {
    speed: number;
  };
  visibility?: number;
}

class AIWeatherController {
  private async getWeatherData(location: string): Promise<WeatherData | null> {
    try {
      console.log(`Fetching weather for: ${location}`);
      console.log(`Weather API Key exists: ${!!process.env.WEATHER_API_KEY}`);
      
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );
      
      console.log(`Weather API response for ${location}:`, response.status);
      return response.data;
    } catch (error: any) {
      console.error(`Weather API Error for ${location}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      return null; // Return null instead of throwing
    }
  }

  private async callOpenAI(messages: any[], maxTokens: number = 150): Promise<string> {
    try {
      console.log(`Calling OpenAI with ${messages.length} messages`);
      console.log(`OpenAI API Key exists: ${process.env.OPENAI_API_KEY}`);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages,
          max_tokens: maxTokens,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('OpenAI API response:', response.status);
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error('OpenAI API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error('AI service unavailable');
    }
  }

  // POST /api/weather/ai/chat
  public async handleWeatherChat(req: Request, res: Response): Promise<void> {
    try {
      const { question, locations } = req.body;
      console.log('Chat request:', { question, locations });

      if (!question) {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      // Get weather data for mentioned locations
      let weatherContext = '';
      if (locations && locations.length > 0) {
        console.log('Fetching weather data for locations:', locations);
        
        const weatherPromises = locations.map((loc: string) => 
          this.getWeatherData(loc)
        );
        const weatherResults = await Promise.all(weatherPromises);

        console.log('Weather results:', weatherResults.map(r => r ? 'success' : 'failed'));

        weatherContext = weatherResults.map((data, index) => {
          if (data) {
            return `${locations[index]}: ${data.main.temp}°C, ${data.weather[0].description}, humidity ${data.main.humidity}%`;
          }
          return `${locations[index]}: Weather data unavailable`;
        }).join('. ');
      }

      console.log('Weather context:', weatherContext);

      const messages = [
        {
          role: 'system',
          content: 'You are a helpful weather assistant. Answer weather questions in a conversational, friendly way. Use the provided weather data when available. Keep responses concise and informative.'
        },
        {
          role: 'user',
          content: `Question: ${question}\nCurrent weather data: ${weatherContext}`
        }
      ];

      const response = await this.callOpenAI(messages, 200);
      res.json({ response });
    } catch (error: any) {
      console.error('Weather chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to process chat request' });
    }
  }

  // POST /api/weather/ai/summary
  public async generateWeatherSummary(req: Request, res: Response): Promise<void> {
    try {
      const { locations } = req.body;
      console.log(`Summary request for locations:`, locations);

      if (!locations || locations.length === 0) {
        res.status(400).json({ error: 'Locations array is required' });
        return;
      }

      // Check environment variables
      if (!process.env.WEATHER_API_KEY) {
        console.error('WEATHER_API_KEY not found in environment variables');
        res.status(500).json({ error: 'Weather service configuration error' });
        return;
      }

      if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not found in environment variables');
        res.status(500).json({ error: 'AI service configuration error' });
        return;
      }

      // Fetch weather data for all locations
      const weatherPromises = locations.map((loc: string) => 
        this.getWeatherData(loc)
      );
      const weatherResults = await Promise.all(weatherPromises);

      console.log('Weather results summary:', weatherResults.map((result, index) => ({
        location: locations[index],
        success: !!result,
        temp: result?.main?.temp
      })));

      // Build weather summary from successful results
      let weatherSummary = '';
      let successfulResults = 0;

      weatherResults.forEach((data, index) => {
        if (data) {
          weatherSummary += `${locations[index]}: ${data.main.temp}°C, ${data.weather[0].description}. `;
          successfulResults++;
        } else {
          console.warn(`No weather data for ${locations[index]}`);
        }
      });

      console.log(`Successfully fetched weather for ${successfulResults}/${locations.length} locations`);
      console.log('Weather summary data:', weatherSummary);

      if (!weatherSummary) {
        res.status(400).json({ 
          error: 'No weather data available for provided locations',
          details: 'All weather API calls failed. Check your API key and location names.'
        });
        return;
      }

      const messages = [
        {
          role: 'system',
          content: 'Create concise, informative daily weather summaries. Highlight important patterns and provide brief insights. Keep it engaging and easy to understand.'
        },
        {
          role: 'user',
          content: `Create a daily weather summary for these locations: ${weatherSummary}`
        }
      ];

      console.log('Sending to OpenAI:', messages[1].content);
      const summary = await this.callOpenAI(messages, 250);
      console.log('Generated summary:', summary);
      
      res.json({ summary });
    } catch (error: any) {
      console.error('Weather summary error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate weather summary' });
    }
  }

  // POST /api/weather/ai/suggestions
  public async getLocationSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { currentLocations, interests } = req.body;
      console.log('Suggestions request:', { currentLocations, interests });

      if (!interests) {
        res.status(400).json({ error: 'Interests are required' });
        return;
      }

      if (!process.env.OPENAI_API_KEY) {
        res.status(500).json({ error: 'AI service configuration error' });
        return;
      }

      const messages = [
        {
          role: 'system',
          content: 'You are a travel and weather advisor. Suggest interesting weather locations based on user interests. Provide exactly 5 suggestions with brief explanations. Format as a numbered list.'
        },
        {
          role: 'user',
          content: `User currently tracks: ${currentLocations?.join(', ') || 'No locations yet'}. Their interests: ${interests}. Suggest 5 new interesting locations to track weather for.`
        }
      ];

      const suggestions = await this.callOpenAI(messages, 300);
      res.json({ suggestions });
    } catch (error: any) {
      console.error('Location suggestions error:', error);
      res.status(500).json({ error: error.message || 'Failed to get location suggestions' });
    }
  }

  // POST /api/weather/ai/trivia
  public async generateWeatherTrivia(req: Request, res: Response): Promise<void> {
    try {
      const { location } = req.body;
      console.log('Trivia request for location:', location);

      if (!location) {
        res.status(400).json({ error: 'Location is required' });
        return;
      }

      if (!process.env.WEATHER_API_KEY || !process.env.OPENAI_API_KEY) {
        res.status(500).json({ error: 'Service configuration error' });
        return;
      }

      const weatherData = await this.getWeatherData(location);
      
      if (!weatherData) {
        res.status(400).json({ 
          error: `Unable to fetch weather data for ${location}`,
          details: 'Check if the location name is correct and try again.'
        });
        return;
      }

      const messages = [
        {
          role: 'system',
          content: 'Generate interesting, educational weather trivia. Make it fun and surprising, focusing on weather phenomena, climate facts, or historical weather events. Keep it concise and engaging.'
        },
        {
          role: 'user',
          content: `Generate interesting weather trivia for ${location}. Current weather: ${weatherData.main.temp}°C, ${weatherData.weather[0].description}`
        }
      ];

      const trivia = await this.callOpenAI(messages, 200);
      res.json({ trivia, weather: weatherData });
    } catch (error: any) {
      console.error('Weather trivia error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate weather trivia' });
    }
  }

  // Debug endpoint to test weather API
  public async testWeatherAPI(req: Request, res: Response): Promise<void> {
    try {
      const { location } = req.params;
      console.log('Testing weather API for:', location);
      
      const weatherData = await this.getWeatherData(location);
      
      if (weatherData) {
        res.json({ 
          success: true, 
          location,
          weather: weatherData,
          apiKeyExists: !!process.env.WEATHER_API_KEY
        });
      } else {
        res.status(400).json({ 
          success: false, 
          location,
          error: 'Weather data not available',
          apiKeyExists: !!process.env.WEATHER_API_KEY
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new AIWeatherController();