import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { 
    createEbook,
    getAllEbooks,
    getEbookById,
    updateEbook,
    deleteEbook,
} from '../controllers/ebookpdf.js';
import advancedResults from '../middleware/advancedResults.js';
import eBookLibrary from '../models/ebookpdfSchema.js';
import Language from '../models/languageSchema.js';  // Adjust the path as needed
import { uploadMiddleware } from '../middleware/uploadMiddleware.js';


const router = express.Router();

router.route('/').post(uploadMiddleware, createEbook);

router.route('/').get(advancedResults(eBookLibrary, { path: "CategoryId languageId"}), getAllEbooks);

router.route('/:id').get(getEbookById);

router.route('/:id').put(uploadMiddleware, updateEbook);

router.route('/:id').delete(deleteEbook);

export default router;