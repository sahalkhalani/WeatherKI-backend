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

class GeminiAIController {
  private aiCache = new Map<string, { data: string; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(type: string, data: any): string {
    return `${type}-${JSON.stringify(data)}`;
  }

  private getCachedResponse(key: string): string | null {
    const cached = this.aiCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('Returning cached AI response');
      return cached.data;
    }
    return null;
  }

  private setCachedResponse(key: string, data: string): void {
    this.aiCache.set(key, { data, timestamp: Date.now() });
  }

  private async getWeatherData(location: string): Promise<WeatherData | null> {
    try {
      console.log(`Fetching weather for: ${location}`);
      
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );
      
      console.log(`Weather API response for ${location}:`, response.status);
      return response.data;
    } catch (error: any) {
      console.error(`Weather API Error for ${location}:`, error.message);
      return null;
    }
  }

  // Google Gemini API call (FREE)
  private async callGemini(prompt: string, maxTokens: number = 150): Promise<string> {
    try {
      console.log('Calling Google Gemini API...');
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 1,
            topP: 1,
            maxOutputTokens: maxTokens,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Gemini API response received');
      return response.data.candidates[0].content.parts[0].text;
    } catch (error: any) {
      console.error('Gemini API Error:', {
        status: error.response?.status,
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

      // Check cache first
      const cacheKey = this.getCacheKey('chat', { question, locations });
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        res.json({ response: cachedResponse });
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

        weatherContext = weatherResults.map((data, index) => {
          if (data) {
            return `${locations[index]}: ${data.main.temp}°C, ${data.weather[0].description}, humidity ${data.main.humidity}%`;
          }
          return `${locations[index]}: Weather data unavailable`;
        }).join('. ');
      }

      const prompt = `You are a helpful weather assistant. Answer this weather question in a conversational, friendly way: "${question}". 

Current weather data: ${weatherContext}

Keep your response concise and informative (under 100 words).`;

      try {
        const response = await this.callGemini(prompt, 200);
        this.setCachedResponse(cacheKey, response);
        res.json({ response });
      } catch (aiError) {
        // Fallback response
        res.json({ 
          response: `I can help with weather questions! You're currently tracking ${locations?.length || 0} locations. Check your weather widgets for current conditions.`
        });
      }
    } catch (error: any) {
      console.error('Weather chat error:', error);
      res.status(500).json({ error: 'Failed to process chat request' });
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

      // Check cache first
      const cacheKey = this.getCacheKey('summary', locations.sort());
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        res.json({ summary: cachedResponse });
        return;
      }

      // Fetch weather data for all locations
      const weatherPromises = locations.map((loc: string) => 
        this.getWeatherData(loc)
      );
      const weatherResults = await Promise.all(weatherPromises);

      // Build weather summary from successful results
      let weatherSummary = '';
      let successfulResults = 0;

      weatherResults.forEach((data, index) => {
        if (data) {
          weatherSummary += `${locations[index]}: ${data.main.temp}°C, ${data.weather[0].description}. `;
          successfulResults++;
        }
      });

      if (!weatherSummary) {
        res.status(400).json({ 
          error: 'No weather data available for provided locations'
        });
        return;
      }

      const prompt = `Create a concise, engaging daily weather summary for these locations: ${weatherSummary}

Please:
- Highlight interesting patterns or contrasts
- Provide brief insights about the overall weather picture
- Keep it informative but engaging
- Limit to 150 words`;

      try {
        const summary = await this.callGemini(prompt, 300);
        this.setCachedResponse(cacheKey, summary);
        res.json({ summary });
      } catch (aiError) {
        // Fallback to simple summary
        const temps = weatherResults.filter(w => w).map(w => w!.main.temp);
        const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
        const fallbackSummary = `Weather Summary: Average temperature across ${successfulResults} locations is ${avgTemp.toFixed(1)}°C. ${weatherSummary}`;
        res.json({ summary: fallbackSummary });
      }
    } catch (error: any) {
      console.error('Weather summary error:', error);
      res.status(500).json({ error: 'Failed to generate weather summary' });
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

      // Check cache first
      const cacheKey = this.getCacheKey('suggestions', { currentLocations, interests });
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        res.json({ suggestions: cachedResponse });
        return;
      }

      const prompt = `You are a travel and weather advisor. The user currently tracks weather for: ${currentLocations?.join(', ') || 'no locations yet'}.

Their interests are: ${interests}

Please suggest exactly 5 interesting locations around the world that would be perfect for someone with these interests. For each location, provide:
1. The city/country name
2. Why it matches their interests
3. What makes the weather/climate special there

Format as a numbered list. Be specific and helpful.`;

      try {
        const suggestions = await this.callGemini(prompt, 400);
        this.setCachedResponse(cacheKey, suggestions);
        res.json({ suggestions });
      } catch (aiError) {
        // Fallback suggestions
        const fallbackSuggestions = `Based on your interests in ${interests}, here are 5 recommended locations:

1. Barcelona, Spain - Great climate for outdoor activities
2. Vancouver, Canada - Perfect for nature lovers  
3. Sydney, Australia - Ideal for beach and city experiences
4. Tokyo, Japan - Fascinating weather patterns and seasons
5. Reykjavik, Iceland - Unique Arctic weather phenomena`;
        
        res.json({ suggestions: fallbackSuggestions });
      }
    } catch (error: any) {
      console.error('Location suggestions error:', error);
      res.status(500).json({ error: 'Failed to get location suggestions' });
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

      // Check cache first
      const cacheKey = this.getCacheKey('trivia', location);
      console.log(`Cache Key: ${cacheKey}`)
      const cachedResponse = this.getCachedResponse(cacheKey);
      console.log(`Cached Response: ${cachedResponse}`)
      if (cachedResponse) {
        res.json({ trivia: cachedResponse });
        return;
      }

      const weatherData = await this.getWeatherData(location);
      
      if (!weatherData) {
        res.status(400).json({ 
          error: `Unable to fetch weather data for ${location}`
        });
        return;
      }

      const prompt = `Generate an interesting weather fact or trivia about ${location}. Current weather: ${weatherData.main.temp}°C, ${weatherData.weather[0].description}.

Please provide a fascinating, educational weather fact that could be about:
- Historical weather events in this location
- Unique climate features of this area
- Interesting meteorological phenomena 
- Record temperatures or weather events
- How geography affects weather there

Make it engaging and surprising! Keep it to 2-3 sentences.`;

      try {
        const trivia = await this.callGemini(prompt, 200);
        this.setCachedResponse(cacheKey, trivia);
        res.json({ trivia, weather: weatherData });
      } catch (aiError) {
        // Fallback trivia
        const fallbackTrivia = `${location} is currently experiencing ${weatherData.weather[0].description} at ${weatherData.main.temp}°C. Did you know that weather patterns can vary significantly even within the same city due to local geography and urban heat effects?`;
        res.json({ trivia: fallbackTrivia, weather: weatherData });
      }
    } catch (error: any) {
      console.error('Weather trivia error:', error);
      res.status(500).json({ error: 'Failed to generate weather trivia' });
    }
  }

  // Debug endpoint for Gemini API
  public async testGeminiAPI(req: Request, res: Response): Promise<void> {
    try {
      console.log('Testing Gemini API...');
      console.log('API Key exists:', !!process.env.GOOGLE_API_KEY);
      
      const testResponse = await this.callGemini('Say hello in a friendly way!', 50);
      res.json({ success: true, response: testResponse });
    } catch (error: any) {
      res.json({ 
        success: false, 
        error: error.message,
        details: error.response?.data 
      });
    }
  }
}

export default new GeminiAIController();