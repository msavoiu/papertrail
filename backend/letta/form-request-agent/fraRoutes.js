import express from 'express';
import dotenv from 'dotenv';
import { Letta, LettaClient } from '@letta-ai/letta-client';

// SETUP ------------------------------------------------------------------

const router = express.Router();
dotenv.config();

const client = new LettaClient({
    token: process.env.LETTA_FRA_API_KEY,
});

// ROUTES ------------------------------------------------------------------

router.post('/letta/post/document-request', async (req, res) => {
    try {
        const { message } = req.body;

        // 1. Fetch user data from firebase
        // Using token? from frontend?

        // 2. Format data for Letta

        // 3. Call Letta API with user data
        const response = await client.agents.messages.create(
            process.env.LETTA_FRA_AGENT_ID,
            { message }
        );

        // 4. Return response
        return res.status(200).json({
            message: "Letta API request successful",
            data: response
        });
        // https://docs.letta.com/guides/agents/json-mode#quick-comparison

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ message: "Letta API request error"});
    }
});
