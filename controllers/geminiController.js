const { GoogleGenerativeAI } = require('@google/generative-ai');
const Conversation = require('../models/Conversation');

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Send message to Gemini and store in conversation
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, message } = req.body;
        const userId = req.user.id;

        let conversation;

        // Find existing conversation or create new one
        if (conversationId) {
            conversation = await Conversation.findOne({
                _id: conversationId,
                userId
            });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }
        } else {
            // Create new conversation with initial title based on first message
            const title = message.length > 30
                ? `${message.substring(0, 30)}...`
                : message;

            conversation = new Conversation({
                userId,
                title,
                messages: []
            });
        }

        // Add user message to conversation
        conversation.messages.push({
            role: 'user',
            content: message
        });

        // Format conversation history for Gemini
        const chatHistory = conversation.messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        // Start or continue chat with Gemini
        const chat = model.startChat({
            history: chatHistory.slice(0, -1), // Exclude the latest message
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            }
        });

        // Send the latest message to Gemini
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        // Add Gemini's response to conversation
        conversation.messages.push({
            role: 'assistant',
            content: responseText
        });

        // Update conversation title if it's a new conversation
        if (!conversationId && conversation.messages.length <= 2) {
            // Generate a title from the first exchange using Gemini
            const titleChat = model.startChat();
            const titlePrompt = `Generate a very short title (4-5 words max) for a conversation that starts with this exchange - User: "${message}" Assistant: "${responseText.substring(0, 100)}..."`;
            const titleResult = await titleChat.sendMessage(titlePrompt);
            conversation.title = titleResult.response.text().replace(/"/g, '').trim();
        }

        await conversation.save();

        res.status(200).json({
            success: true,
            conversationId: conversation._id,
            message: {
                role: 'assistant',
                content: responseText
            },
            title: conversation.title
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get all conversations for user
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const conversations = await Conversation.find({ userId })
            .select('_id title createdAt updatedAt')
            .sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            count: conversations.length,
            conversations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Get a single conversation
exports.getConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.id;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            userId
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        res.status(200).json({
            success: true,
            conversation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Delete a conversation
exports.deleteConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.params.id;

        const conversation = await Conversation.findOneAndDelete({
            _id: conversationId,
            userId
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Conversation deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};