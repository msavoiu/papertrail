const express = require('express');
const router = express.Router();
const { getExampleData } = require('../controllers/exampleController');
const verifyToken = require('../middleware/authMiddleware'); // optional

// GET route
router.get('/get/birth-certificate/:userId', verifyToken, (req, res) => {
    
});

module.exports = router;
