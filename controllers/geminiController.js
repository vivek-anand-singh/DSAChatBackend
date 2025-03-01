const { GoogleGenerativeAI } = require('@google/generative-ai');
const Conversation = require('../models/Conversation');

// Initialize Gemini API with the correct model name
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Send message to Gemini and store in conversation
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, message } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required and must be a non-empty string'
            });
        }

        let conversation;
        
        // Find existing conversation or prepare to create new one
        if (conversationId) {
            conversation = await Conversation.findOne({ _id: conversationId, userId });
            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    message: 'Conversation not found'
                });
            }
        }

        // Add user message to conversation messages array
        const userMessage = { role: 'user', content: message };
        
        // Make API call to Gemini
        try {
            // Add system prompt to clarify AI's role
            const systemPrompt = "You are a helpful assistant who provides guidance and intuition rather than sharing code directly. Even if users request code, focus on explaining concepts and approaches instead. You are a simple chatbot designed to have normal conversations and provide helpful guidance.";
            
            // Create chat context with system prompt
            const chat = model.startChat({
                history: conversation ? conversation.messages.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.content }]
                })) : [],
                generationConfig: {
                    maxOutputTokens: 1024,
                }
            });
            
            // Generate the response with proper context
            const enhancedMessage = "Remember: do not share any code in your response, only concepts and guidance. " + message;
            const result = await chat.sendMessage(enhancedMessage);
            const response = await result.response;
            const text = response.text();
            
            // Add assistant message
            const assistantMessage = { role: 'assistant', content: text };
            
            // Create or update conversation
            if (!conversation) {
                // Create new conversation
                // Generate a title from the first message
                const title = message.length > 30 
                    ? message.substring(0, 30) + '...' 
                    : message;
                
                conversation = new Conversation({
                    userId,
                    title,
                    messages: [userMessage, assistantMessage],
                    updatedAt: Date.now()
                });
            } else {
                // Update existing conversation
                conversation.messages.push(userMessage, assistantMessage);
                conversation.updatedAt = Date.now();
            }
            
            // Save to database
            await conversation.save();

            // Send response back to client
            return res.json({
                success: true,
                message: assistantMessage,
                conversation: conversation
            });

        } catch (geminiError) {
            console.error('Gemini API Error:', geminiError);
            return res.status(500).json({
                success: false,
                message: 'Error generating response from AI',
                error: geminiError.message
            });
        }

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while processing message',
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