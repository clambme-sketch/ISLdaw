
import { GoogleGenAI } from "@google/genai";

export const generateSongIdeas = async (genre: string, mood: string, existingLyrics?: string): Promise<string> => {
  if (!process.env.API_KEY) {
    return "Error: API_KEY not found in environment.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let prompt = `Act as a professional songwriter and music producer. 
    I need creative ideas for a ${mood} ${genre} song.
    
    Please provide:
    1. A catchy song title.
    2. A structure (Intro, Verse, Chorus, etc.).
    3. 4 lines of lyrics for the chorus.
    
    Keep it concise and inspiring.`;

    if (existingLyrics) {
      prompt += `\n\nHere are some existing lyrics or themes I have: "${existingLyrics}". Incorporate or expand on these.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate ideas. Please check your API key or connection.";
  }
};

export const analyzeAudioStructure = async (base64Audio: string): Promise<string[]> => {
  if (!process.env.API_KEY) {
     return ['Drums', 'Bass', 'Vocals', 'Other']; 
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Extract actual base64 data if it contains the data URL prefix
    const data = base64Audio.includes('base64,') ? base64Audio.split('base64,')[1] : base64Audio;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/mp3', 
              data: data
            }
          },
          {
            text: "List the musical instruments detected in this audio track. Return only a comma-separated list (e.g. Drums, Bass, Guitar, Vocals)."
          }
        ]
      }
    });

    const text = response.text || "";
    return text.split(',').map(t => t.trim()).filter(t => t.length > 0);
  } catch (error) {
    console.error("Gemini Audio Analysis Error:", error);
    return ['Drums', 'Bass', 'Vocals'];
  }
};
