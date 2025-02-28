const express = require('express');
const router = express.Router();
const geminiController = require('../../controllers/geminiController');
const auth = require('../../middlewares/auth');

// @route   POST api/gemini/message
// @desc    Send message to Gemini and get response
// @access  Private
router.post('/message', auth, geminiController.sendMessage);

// @route   GET api/gemini/conversations
// @desc    Get all user conversations
// @access  Private
router.get('/conversations', auth, geminiController.getConversations);

// @route   GET api/gemini/conversations/:id
// @desc    Get conversation by ID
// @access  Private
router.get('/conversations/:id', auth, geminiController.getConversation);

// @route   DELETE api/gemini/conversations/:id
// @desc    Delete conversation
// @access  Private
router.delete('/conversations/:id', auth, geminiController.deleteConversation);

module.exports = router;