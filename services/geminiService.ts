import { GoogleGenAI } from "@google/genai";

// Safe initialization
const getAI = () => {
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateBattleDescription = async (enemyName: string, level: number): Promise<string> => {
  const ai = getAI();
  if (!ai) return `Um ${enemyName} de nível ${level} aparece ameaçadoramente!`;

  try {
    const model = ai.models;
    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Descreva uma entrada dramática e curta (máximo 2 frases) para um monstro de RPG chamado "${enemyName}" de nível ${level} em uma masmorra escura. Responda em Português.`,
    });
    return response.text || `Um ${enemyName} selvagem apareceu!`;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `Um ${enemyName} surge das sombras!`;
  }
};

export const generateVictorySpeech = async (enemyName: string): Promise<string> => {
    const ai = getAI();
    if (!ai) return `Você derrotou o ${enemyName}!`;
  
    try {
      const model = ai.models;
      const response = await model.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Gere uma frase curta de vitória épica (máximo 1 frase) após derrotar um ${enemyName}. Responda em Português.`,
      });
      return response.text || `O ${enemyName} caiu perante sua força!`;
    } catch (error) {
      return `O inimigo foi derrotado!`;
    }
  };
