"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const documents_1 = require("./documents");
const notes_1 = require("./notes");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: "us-east-1" });
router.post("/chat", auth_1.validateJwt, auth_1.requireMultiTenancy, async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query content is required." });
    }
    try {
        // 1. Generate Query Vector Embedding via AWS Titan Embeddings
        const titanPayload = {
            inputText: query,
        };
        const bedrockTitanCommand = new client_bedrock_runtime_1.InvokeModelCommand({
            modelId: "amazon.titan-embed-text-v2:0",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(titanPayload),
        });
        const titanResponse = await bedrockClient.send(bedrockTitanCommand);
        const titanResult = JSON.parse(new TextDecoder().decode(titanResponse.body));
        const queryVector = titanResult.embedding;
        // 2. Query MongoDB Atlas using native $vectorSearch matching tenant criteria
        let searchResults = [];
        try {
            searchResults = await documents_1.DocumentModel.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 10,
                        limit: 3,
                    },
                },
                // Strict Security Isolation check for multi-tenant isolation
                {
                    $match: {
                        auth0UserId: req.auth0UserId,
                    },
                },
            ]);
        }
        catch (vectorSearchErr) {
            console.warn("Atlas Vector Search failed or is unconfigured for documents, falling back to loading latest documents:", vectorSearchErr.message);
            // Fallback: Retrieve the latest 5 documents for the user as context
            searchResults = await documents_1.DocumentModel.find({
                auth0UserId: req.auth0UserId
            })
                .sort({ createdAt: -1 })
                .limit(5);
        }
        // 3. Query notes using $vectorSearch or fallback
        let noteSearchResults = [];
        try {
            noteSearchResults = await notes_1.NoteModel.aggregate([
                {
                    $vectorSearch: {
                        index: "notes_vector_index",
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 10,
                        limit: 3,
                    },
                },
                {
                    $match: {
                        auth0UserId: req.auth0UserId,
                    },
                },
            ]);
        }
        catch (vectorSearchErr) {
            console.warn("Atlas Vector Search failed or is unconfigured for notes, falling back to loading latest notes:", vectorSearchErr.message);
            // Fallback: Retrieve the latest 5 notes for the user as context
            noteSearchResults = await notes_1.NoteModel.find({
                auth0UserId: req.auth0UserId
            })
                .sort({ updatedAt: -1 })
                .limit(5);
        }
        // Format matches as context for RAG prompt
        const docContextText = searchResults
            .map((doc) => `[Document File: ${doc.originalName}, Category: ${doc.category}] OCR content: ${doc.rawOcrText}`)
            .join("\n\n");
        const noteContextText = noteSearchResults
            .map((note) => `[Note Title: ${note.title}] Content: ${note.rawText}`)
            .join("\n\n");
        const contextText = [docContextText, noteContextText].filter(Boolean).join("\n\n");
        // 4. Prompt Bedrock Claude to synthesize a highly accessible, clear, direct response
        const promptMessage = `
You are the voice assistant for the Family Vault digital locker.
Your user is an elderly family member. Keep sentences simple, friendly, large-font readable, and highly precise.
Provide a conversational, easy-to-understand answer based on the secure context documents and notes provided below.
If the information is not found in the context, tell the user politely and offer to record a note instead.

If the user is asking to show, retrieve, or download a specific file (e.g., "give me the file", "show the document", "return only files", "give me this only files"), do not explain or summarize the document content. Instead, respond ONLY with a short message: "Here is your requested document:" and let the system attach the download link. Do not write any other text.

[Context Documents and Notes]:
${contextText || "No matching secure documents or notes found."}

[User Query]:
${query}

Answer:
`;
        const converseCommand = new client_bedrock_runtime_1.ConverseCommand({
            modelId: "amazon.nova-micro-v1:0",
            messages: [
                {
                    role: "user",
                    content: [{ text: promptMessage }]
                }
            ],
            inferenceConfig: {
                maxTokens: 500,
                temperature: 0.7
            }
        });
        const converseResponse = await bedrockClient.send(converseCommand);
        const assistantAnswer = converseResponse.output?.message?.content?.[0]?.text || "";
        return res.status(200).json({
            answer: assistantAnswer,
            sources: [
                ...searchResults.map((d) => ({
                    originalName: d.originalName,
                    category: d.category,
                    id: d._id,
                    type: "document"
                })),
                ...noteSearchResults.map((n) => ({
                    originalName: n.title,
                    category: "Note",
                    id: n._id,
                    type: "note"
                }))
            ]
        });
    }
    catch (err) {
        console.error("AI Assistant error:", err);
        return res.status(200).json({
            answer: `I had trouble connecting to the AI helper (Error: ${err.message || err}). Please check your AWS settings.`,
            sources: []
        });
    }
});
exports.default = router;
