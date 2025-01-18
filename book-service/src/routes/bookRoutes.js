const express = require("express");
const bookController = require("../controllers/bookController");

const router = express.Router();

router.patch("/:id/quantities", bookController.updateBookQuantities);

module.exports = router;
