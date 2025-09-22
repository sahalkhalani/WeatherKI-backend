import { Router } from 'express';
import weatherController from '../controllers/weatherController';
import aiWeatherController from '../controllers/aiWeatherController'
import geminiAIController from '../controllers/geminiAiController'

const router = Router();


// GET /api/weather/:location - Get weather data for a specific location
router.get('/:location', (req, res) => weatherController.getWeatherData(req, res));

// POST /api/weather/clear - Clear weather cache
router.post('/cache/clear', (req, res) => weatherController.clearCache(req, res));

// GET /api/weather/cache/stats - Get cache statistics
router.get('/cache/stats', (req, res) => weatherController.getCacheStats(req, res));


// // NEW AI-powered routes
// router.post('/ai/chat', (req, res) => aiWeatherController.handleWeatherChat(req, res));
// router.post('/ai/summary', (req, res) => aiWeatherController.generateWeatherSummary(req, res));
// router.post('/ai/suggestions', (req, res) => aiWeatherController.getLocationSuggestions(req, res));
// router.post('/ai/trivia', (req, res) => aiWeatherController.generateWeatherTrivia(req, res));

// Update the routes to use geminiAIController instead of aiWeatherController
router.post('/ai/chat', (req, res) => geminiAIController.handleWeatherChat(req, res));
router.post('/ai/summary', (req, res) => geminiAIController.generateWeatherSummary(req, res));
router.post('/ai/suggestions', (req, res) => geminiAIController.getLocationSuggestions(req, res));
router.post('/ai/trivia', (req, res) => geminiAIController.generateWeatherTrivia(req, res));
router.get('/test-gemini', (req, res) => geminiAIController.testGeminiAPI(req, res));

// Debug endpoint to test weather API
router.get('/debug/:location', (req, res) => aiWeatherController.testWeatherAPI(req, res));


export default router;