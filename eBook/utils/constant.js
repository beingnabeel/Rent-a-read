// STATUS_CODES
export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

// CATEGORY_ERRORS
export const CATEGORY_ERRORS = {
  CATEGORY_EXISTS: 'Category already exists.',
  CATEGORY_CREATED: 'Category created successfully.',
  CATEGORY_NOT_FOUND: 'Category not found.',
  CATEGORY_UPDATED: 'Category updated successfully.',
  CATEGORY_DELETED: 'Category deleted successfully.',
  CATEGORIES_FETCH_ERROR: 'Error fetching categories.',
  CATEGORY_CREATE_ERROR: 'Error creating category.',
  CATEGORY_UPDATE_ERROR: 'Error updating category.',
  CATEGORY_DELETE_ERROR: 'Error deleting category.',
  NO_CATEGORIES_FOUND: 'No categories found.',
  NO_FILE_FOUND: 'No file uploaded.',
};

// EBOOK_ERRORS
export const EBOOK_ERRORS = {
  NO_FILES_FOUND: 'Thumbnail and/or PDF files are missing.',
  EBOOK_CREATED: 'eBook pdf created successfully.',
  EBOOK_UPDATED: 'eBook pdf updated successfully.',
  EBOOK_DELETED: 'eBook pdf soft-deleted successfully.',
  EBOOK_NOT_FOUND: 'eBook pdf not found.',
  EBOOKS_FETCH_ERROR: 'Error fetching eBooks pdf.',
  EBOOK_FETCH_ERROR: 'Error fetching eBook pdf by ID.',
  EBOOK_UPDATE_ERROR: 'Error updating eBook pdf.',
  EBOOK_DELETE_ERROR: 'Error deleting eBook pdf.',
};
 
// Other application-wide constants
export const APP_CONFIG = {
  API_PREFIX_CATEGORY: '/api/category',
  API_PREFIX_PDF: '/api/pdf/'
}