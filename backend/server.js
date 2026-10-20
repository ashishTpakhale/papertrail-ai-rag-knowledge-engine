import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Configure Multer to retain uploaded files in server memory as binary buffers
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 2. Initialize the official Supabase API client wrapper for LangChain vector uploads
const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 3. Initialize Database Connection Pool (for direct PostgreSQL management if needed)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// 4. Initialize Gemini Core AI Models
const embeddings = new GoogleGenerativeAIEmbeddings({ model: "gemini-embedding-001" });
const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash", temperature: 0 });

// 5. Construct the LangChain Supabase integration manager using our official client
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabaseClient,
  tableName: "documents",
  queryName: "match_documents",
});

/**
 *  ENDPOINT 1: DYNAMIC MULTIPART PDF UPLOAD AND SEEDING
 * Accepts file upload, extracts text chunks via WebPDFLoader, embeds them, and persists to Supabase.
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded. Please send a PDF using form-data key 'file'" });
    }

    console.log(`Received binary PDF upload: ${req.file.originalname}`);

    // Convert raw memory buffer into a standard Web Blob structure
    const blob = new Blob([req.file.buffer], { type: "application/pdf" });
    const loader = new WebPDFLoader(blob);
    
    // Load pages into explicit LangChain Document fragments
    const rawDocs = await loader.load();
    console.log(`Successfully parsed ${rawDocs.length} pages via native WebPDFLoader.`);

    // Slicing text cleanly into structural chunks
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 600, chunkOverlap: 120 });
    const splitDocs = await splitter.splitDocuments(rawDocs);
    
    // Explicitly map structural file metadata headers to every row entry
    const finalizedDocs = splitDocs.map(doc => {
      doc.metadata = {
        ...doc.metadata,
        source: req.file.originalname
      };
      return doc;
    });

    console.log(`Generated ${finalizedDocs.length} semantic vectors. Syncing to Supabase via pgvector...`);

    // Bulk upload matching vectors and document mappings over HTTPS gateway
    await SupabaseVectorStore.fromDocuments(finalizedDocs, embeddings, {
      client: supabaseClient,
      tableName: "documents",
    });

    return res.status(200).json({
      success: true,
      message: "PDF Ingestion Engine successfully synchronized data with Supabase.",
      filename: req.file.originalname,
      chunks_created: finalizedDocs.length,
      pages_parsed: rawDocs.length
    });

  } catch (error) {
    console.error("Ingestion Pipeline Failure:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ENDPOINT 2: CHAT & CONTEXTUAL RETRIEVAL
 * Vector search query processing endpoint matching criteria back to context arrays.
 */
app.post('/api/chat', async (req, res) => {
  const { question , currentFilename} = req.body;
  if (!question) return res.status(400).json({ error: "Question parameter is required" });
  if (!currentFilename) {
    return res.json({ 
      answer: "Please upload a technical PDF specifications file into the Knowledge Core drop-zone on the left before running search sequences.",
      citations: [] 
    });
  }

  try {
    // 2. Define search configuration parameters
    const searchOptions = {
      searchType: "similarity",
      k: 3,
    };

    // 3. Dynamic filter: If a filename is passed, restrict the vector space strictly to it
    if (currentFilename) {
      searchOptions.filter = { source: currentFilename };
    }
    const retriever = vectorStore.asRetriever(searchOptions);
    
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are an expert full-stack knowledge assistant and technical consultant. Your goal is to analyze, summarize, or answer questions about the provided document context.

      Guidelines:
      1. Base your insights, answers, and summaries directly on the provided Technical Context Blocks.
      2. If the user asks for a summary, synthesize the context into a clean, professional overview.
      3. If the user asks for improvements, critiques, or suggestions, analyze the context data and use your technical expertise to provide constructive recommendations.
      4. If a question asks for explicit facts that are completely missing from the document, state clearly that the document information is insufficient. Do not invent entirely fabricated facts.

      Technical Context Blocks:
      {context}

      User Question: {question}

      Formatted Technical Answer:
    `);

    const formatDocs = (docs) => docs.map(doc => doc.pageContent).join("\n\n");

    const ragChain = RunnableSequence.from([
      {
        context: retriever.pipe(formatDocs),
        question: new RunnablePassthrough(),
      },
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    // Fetch documents to parse context citations out to the UI layout
    const sourceDocuments = await retriever.invoke(question);
    const aiAnswer = await ragChain.invoke(question);

    return res.status(200).json({
      answer: aiAnswer,
      citations: sourceDocuments.map(doc => ({
        snippet: doc.pageContent,
        source: doc.metadata.source_file || "Unknown Document"
      }))
    });

  } catch (error) {
    console.error("Retrieval Engine Failure:", error);
    if (error.status === 429 || error.message?.includes('429')) {
      return res.status(200).json({ // Return 200 so the frontend parses the clean message state safely
        answer: "**API Quota Reached:** This engine's global Gemini free-tier daily usage limit (20 requests/day) has been reached. Please wait a bit or test with an updated API token wrapper.",
        citations: []
      });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'rag-backend'
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`AI RAG Production API Layer listening on http://localhost:${PORT}`));