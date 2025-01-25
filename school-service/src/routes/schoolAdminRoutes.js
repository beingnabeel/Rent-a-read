const express = require('express');
const schoolAdminController = require('../controllers/schoolAdminController');

const router = express.Router();

router.get('/profiles/:schoolId', schoolAdminController.getAllUserProfilesBySchool);
router.get('/documents/:schoolId', schoolAdminController.getAllUserDocumentsBySchool);

module.exports = router;
