import { Request, Response } from 'express';
import Widget, { IWidget } from '../models/Widget';
import { errorMessages, successMessages } from '../helpers/message.helper';

export class WidgetController {
  async getAllWidgets(req: Request, res: Response): Promise<void> {
    try {
      const widgets: IWidget[] = await Widget.find()
        .sort({ createdAt: -1 })
        .lean();

      res.json(widgets);
    } catch (error) {
      console.error('Error fetching widgets:', error);
      res.status(500).json({
        error: errorMessages.FailedToFetchWidgetsError,
        message: errorMessages.FailedToFetchWidgetsMessage,
      });
    }
  }

  async createWidget(req: Request, res: Response): Promise<void> {
    try {
      const { location } = req.body;

      if (!location || typeof location !== 'string' || location.trim().length === 0) {
        res.status(400).json({
          error: errorMessages.InvalidInput,
          message: errorMessages.LocationRequired,
        });
        return;
      }

      const trimmedLocation = location.trim();

      const existingWidget = await Widget.findOne({ 
        location: { $regex: new RegExp(`^${trimmedLocation}$`, 'i') } 
      });

      if (existingWidget) {
        res.status(409).json({
          error: errorMessages.WidgetAlreadyExistsError,
          message: errorMessages.WidgetAlreadyExistsMessage(trimmedLocation),
        });
        return;
      }

      const widget: IWidget = new Widget({
        location: trimmedLocation,
      });

      const savedWidget = await widget.save();
      
      res.status(201).json(savedWidget);
    } catch (error) {
      console.error('Error creating widget:', error);
      
      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({
          error: 'Validation error',
          message: error.message,
        });
      } else {
        res.status(500).json({
          error: errorMessages.FailedToCreateWidgetError,
          message: errorMessages.FailedToCreateWidgetMessage,
        });
      }
    }
  }

  async deleteWidget(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        res.status(400).json({
          error: errorMessages.InvalidWidgetIDError,
          message: errorMessages.InvaildWidgetIDMessage,
        });
        return;
      }

      const deletedWidget = await Widget.findByIdAndDelete(id);

      if (!deletedWidget) {
        res.status(404).json({
          error: errorMessages.WidgetNotFoundError,
          message: errorMessages.WidgetNotFoundMessage(id),
        });
        return;
      }

      res.json({
        message: successMessages.WidgetDeleted,
        deletedWidget,
      });
    } catch (error) {
      console.error('Error deleting widget:', error);
      res.status(500).json({
        error: errorMessages.FailedToDeleteWidgetError,
        message: errorMessages.FailedToDeleteWidgetMessage,
      });
    }
  }

  async getWidgetById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        res.status(400).json({
          error: errorMessages.InvalidWidgetIDError,
          message: errorMessages.InvaildWidgetIDMessage,
        });
        return;
      }

      const widget = await Widget.findById(id);

      if (!widget) {
        res.status(404).json({
          error: errorMessages.WidgetNotFoundError,
          message: errorMessages.WidgetNotFoundMessage(id),
        });
        return;
      }

      res.json(widget);
    } catch (error) {
      console.error('Error fetching widget:', error);
      res.status(500).json({
        error: errorMessages.FailedToFetchWidgetError,
        message: errorMessages.FailedToFetchWidgetMessage,
      });
    }
  }
}

export default new WidgetController();