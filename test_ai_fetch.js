import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

async function testAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing from environment");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log("Starting AI generation with Google Search...");
    const prompt = `
      Search for the top 30 earners in the "Fortnite Mobile Series" or Fortnite Android tournaments for the years 2025 and 2026.
      Combine earnings from Fortnite Tracker, Esportsearnings, and other competitive sources.
      
      Return a JSON list of players with:
      rank (int), name (string), earningsUSD (number), countryCode (string, ISO like US, GB, EU), 
      lastActiveTournament (string), lastActiveDate (ISO date string).
    `;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            players: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rank: { type: Type.NUMBER },
                  name: { type: Type.STRING },
                  earningsUSD: { type: Type.NUMBER },
                  countryCode: { type: Type.STRING },
                  lastActiveTournament: { type: Type.STRING },
                  lastActiveDate: { type: Type.STRING }
                },
                required: ["rank", "name", "earningsUSD", "countryCode"]
              }
            }
          }
        }
      }
    });

    console.log("Success! Result:");
    console.log(result.text);
  } catch (error) {
    console.error("AI Generation Failed:");
    console.error(error);
  }
}

testAI();
