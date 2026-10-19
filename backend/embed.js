import * as fs from 'fs';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

async function runEmbeddings() {
  console.log("Reading raw knowledge file...");
  const rawContent = fs.readFileSync("company_policy.txt", "utf-8");
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 150,
    chunkOverlap: 30,
  });
  const chunks = await splitter.splitText(rawContent);
  console.log(`Loaded ${chunks.length} text chunks.`);

  // FIX: Swapped to the current active stable model
  const embeddingsModel = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001", 
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  });

  console.log("Sending Chunk #1 to Gemini API to generate mathematical vectors...");
  const singleVector = await embeddingsModel.embedQuery(chunks[0]);

  console.log("\n--- Vector Generation Successful! ---");
  console.log(`Vector Array Length (Dimensions): ${singleVector.length}`);
  console.log(`Sample coordinates (First 5 values):`, singleVector.slice(0, 5));
  console.log("...");
}

runEmbeddings().catch(console.error);