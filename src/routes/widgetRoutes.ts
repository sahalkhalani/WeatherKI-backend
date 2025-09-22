import { Router } from 'express';
import widgetController from '../controllers/widgetController';

const router = Router();

// GET /api/widgets - Get all widgets
router.get('/', widgetController.getAllWidgets);

// POST /api/widgets - Create new widget
router.post('/', widgetController.createWidget);

// GET /api/widgets/:id - Get widget by ID
router.get('/:id', widgetController.getWidgetById);

// DELETE /api/widgets/:id - Delete widget
router.delete('/:id', widgetController.deleteWidget);

export default router;