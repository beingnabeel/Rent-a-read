import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { 
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from '../controllers/ebookCategory.js';
import advancedResults from '../middleware/advancedResults.js';
import eBookCategory from '../models/ebookCategorySchema.js';
import { uploadMiddleware } from '../middleware/uploadMiddleware.js';


const router = express.Router();

router.route('/').post(uploadMiddleware, createCategory);

router.route('/').get(advancedResults(eBookCategory), getAllCategories);

router.route('/:id').get(getCategoryById);

router.route('/:id').put(uploadMiddleware, updateCategory);

router.route('/:id').delete(deleteCategory);

export default router;