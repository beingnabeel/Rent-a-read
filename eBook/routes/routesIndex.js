import categoryRoutes from './ebookCategory.js';
import ebookPdfRoutes from './ebookpdf.js';
import {APP_CONFIG} from '../utils/constant.js';

// Function to mount all routes
export function mountRoutes(app) {
  app.use(APP_CONFIG.API_PREFIX_CATEGORY, categoryRoutes);
  app.use(APP_CONFIG.API_PREFIX_PDF, ebookPdfRoutes)
}