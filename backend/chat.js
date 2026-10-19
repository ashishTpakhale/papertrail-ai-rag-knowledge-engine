import * as fs from 'fs';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import dotenv from "dotenv";

dotenv.config();

async function runRAGPipeline() {
  // 1. Ingest & Load documents into Vector Store
  const rawContent = fs.readFileSync("company_policy.txt", "utf-8");
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 100 });
  const docs = await splitter.createDocuments([rawContent]);
  
  const embeddings = new GoogleGenerativeAIEmbeddings({ model: "gemini-embedding-001" });
  const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
  
  const retriever = vectorStore.asRetriever({ searchType: "similarity", k: 2 });

  // 2. Initialize the Gemini LLM Chat Model
  // FIX: Updated to the production flagship model 'gemini-2.5-flash'
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash", 
    temperature: 0,            // Ensures strictly factual evaluation of the context
  });

  // 3. Define the System Prompt
  const prompt = ChatPromptTemplate.fromTemplate(`
You are a strict corporate compliance assistant. Answer the user's question using ONLY the provided context. If you do not know the answer based on the context, state that you do not have that information.

Context:
{context}

Question: {question}

Answer:`);

  const formatDocs = (docs) => docs.map(doc => doc.pageContent).join("\n\n");

  // 4. Construct the LCEL Sequence Chain
  const ragChain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs), 
      question: new RunnablePassthrough(), 
    },
    prompt, 
    llm,    
    new StringOutputParser(), 
  ]);

  // 5. Fire off the execution!
  const userQuery = "What exact command should the SRE run during a memory leak?";
  console.log(`User Question: "${userQuery}"\n`);
  console.log("Processing through complete RAG pipeline...");

  const response = await ragChain.invoke(userQuery);

  console.log("\n--- AI Response ---");
  console.log(response);
}

runRAGPipeline().catch(console.error);