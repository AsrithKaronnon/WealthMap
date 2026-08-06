import { GoogleGenerativeAI } from "@google/generative-ai";
import { logErrorToSupabase } from './logger';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export interface ParsedTransaction {
  merchant: string;
  amount: number;
  isIncome: boolean;
  categoryName?: string;
  date?: string;
}

export const isGeminiConfigured = () => {
  return !!apiKey && apiKey.length > 0;
};

const getGenAI = () => {
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is missing");
  return new GoogleGenerativeAI(apiKey);
};

let cachedModelName: string | null = null;

const getBestModel = async (requiresVision: boolean): Promise<string> => {
  if (cachedModelName) return cachedModelName;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];
      const modelNames = models.map((m: any) => m.name.replace('models/', ''));
      console.log("Available Gemini Models:", modelNames);

      let best = 'gemini-2.5-flash';
      if (modelNames.includes('gemini-3.6-flash')) best = 'gemini-3.6-flash';
      else if (modelNames.includes('gemini-3.5-flash')) best = 'gemini-3.5-flash';
      else if (modelNames.includes('gemini-2.5-flash')) best = 'gemini-2.5-flash';
      else if (modelNames.includes('gemini-2.0-flash')) best = 'gemini-2.0-flash';
      else if (modelNames.includes('gemini-1.5-flash')) best = 'gemini-1.5-flash';
      else if (modelNames.includes('gemini-1.5-flash-latest')) best = 'gemini-1.5-flash-latest';
      else if (modelNames.includes('gemini-2.0-flash-exp')) best = 'gemini-2.0-flash-exp';
      else if (requiresVision) {
        if (modelNames.includes('gemini-pro-vision')) best = 'gemini-pro-vision';
        else best = modelNames.find((m: string) => m.includes('vision') || m.includes('3.6') || m.includes('3.5') || m.includes('2.5') || m.includes('2.0') || m.includes('1.5')) || 'gemini-2.5-flash';
      } else {
        best = modelNames.find((m: string) => m.includes('pro') || m.includes('flash')) || 'gemini-2.5-flash';
      }

      cachedModelName = best;
      return best;
    }
  } catch (err) {
    console.warn("Could not fetch model list", err);
  }
  return requiresVision ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
};

export const clearModelCache = () => {
  cachedModelName = null;
};

export const parseTextTransaction = async (
  text: string, 
  availableCategories: string[]
): Promise<ParsedTransaction> => {
  const genAI = getGenAI();
  const modelName = await getBestModel(false);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
    You are a financial parsing assistant. Extract transaction details from the following user input: "${text}"

    Available Categories (Pick the closest one, or leave null if none fit well):
    ${availableCategories.join(", ")}

    Return ONLY a raw JSON object with the following schema, no markdown, no code blocks:
    {
      "merchant": "Name of the place or person",
      "amount": numeric_value,
      "isIncome": boolean,
      "categoryName": "One of the available categories, exactly as written",
      "date": "YYYY-MM-DD" (only if a specific date was mentioned, else null)
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textRes = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(textRes) as ParsedTransaction;
    } catch (parseErr: any) {
      logErrorToSupabase(parseErr, { notes: 'Gemini JSON Parse Error. Raw output: ' + textRes });
      throw new Error("AI returned invalid data format: " + textRes.slice(0, 50));
    }
  } catch (err: any) {
    console.error("Gemini Parse Error:", err);
    // Clear cache on 404 or model errors to force re-selection
    if (err.status === 404 || err.message?.includes('not found') || err.message?.includes('no longer available')) {
      clearModelCache();
    }
    logErrorToSupabase(err, { notes: 'Gemini API Error in parseTextTransaction' });
    throw new Error("Failed to parse text via AI: " + (err.message || 'Unknown error'));
  }
};

export const parseReceiptImage = async (
  base64Data: string,
  mimeType: string,
  availableCategories: string[]
): Promise<ParsedTransaction> => {
  const genAI = getGenAI();
  const modelName = await getBestModel(true);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `
    You are a financial receipt parsing assistant. Look at the attached receipt image and extract the key details.

    Available Categories (Pick the closest one, or leave null if none fit well):
    ${availableCategories.join(", ")}

    Return ONLY a raw JSON object with the following schema, no markdown, no code blocks:
    {
      "merchant": "Name of the merchant/store",
      "amount": Total final amount paid (numeric value),
      "isIncome": false,
      "categoryName": "One of the available categories, exactly as written",
      "date": "YYYY-MM-DD" (date on the receipt, else null)
    }
  `;

  // Remove the data URI prefix if it exists (e.g. data:image/jpeg;base64,)
  const base64Clean = base64Data.split(',')[1] || base64Data;

  const imagePart = {
    inlineData: {
      data: base64Clean,
      mimeType
    },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const textRes = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(textRes) as ParsedTransaction;
    } catch (parseErr: any) {
      logErrorToSupabase(parseErr, { notes: 'Gemini Receipt JSON Parse Error. Raw output: ' + textRes });
      throw new Error("AI returned invalid data format: " + textRes.slice(0, 50));
    }
  } catch (err: any) {
    console.error("Gemini Receipt Parse Error:", err);
    // Clear cache on 404 or model errors to force re-selection
    if (err.status === 404 || err.message?.includes('not found') || err.message?.includes('no longer available')) {
      clearModelCache();
    }
    logErrorToSupabase(err, { notes: 'Gemini API Error in parseReceiptImage' });
    throw new Error("Failed to extract data from receipt: " + (err.message || 'Unknown error'));
  }
};
