import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface PlantAnalysis {
  plantName: string;
  isHealthy: boolean;
  diseaseName?: string;
  severity?: "Low" | "Moderate" | "High";
  symptoms?: string[];
  treatment?: string;
  careTips?: string[];
  confidence: number;
}

export async function analyzePlantImage(base64Image: string): Promise<PlantAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            text: "You are an expert botanist and plant pathologist. Analyze this plant image. Identify the plant and check for any diseases. If diseased, provide the name, severity, symptoms, and treatment. If healthy, provide general care tips. Return the result in JSON format.",
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plantName: { type: Type.STRING },
          isHealthy: { type: Type.BOOLEAN },
          diseaseName: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ["Low", "Moderate", "High"] },
          symptoms: { type: Type.ARRAY, items: { type: Type.STRING } },
          treatment: { type: Type.STRING },
          careTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.NUMBER },
        },
        required: ["plantName", "isHealthy", "confidence"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function chatWithDoctor(history: { role: "user" | "model", parts: { text: string }[] }[], message: string) {
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are a friendly and knowledgeable Plant Doctor. You help users understand their plant's health and provide actionable care advice based on previous analysis. Keep answers concise and helpful.",
    },
    history,
  });

  const result = await chat.sendMessage({ message });
  return result.text;
}
