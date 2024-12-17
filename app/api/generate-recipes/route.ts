import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { ingredients } = await req.json();

    const prompt = `Generate 2 possible recipes using most of these ingredients: ${ingredients.join(', ')}. 
    For each recipe, include:
    1. Recipe name
    2. Complete list of required ingredients (including quantities)
    3. Step-by-step instructions
    4. List any ingredients that weren't in the original list (missing ingredients)

    Return the response as a JSON array with 2 recipes, each containing:
    {
      "name": "Recipe Name",
      "ingredients": ["formatted ingredient list with quantities"],
      "instructions": ["step 1", "step 2", ...],
      "missingIngredients": ["ingredient 1", "ingredient 2", ...]
    }`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4o-mini",  // Changed to base GPT-4 model
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from OpenAI API');
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }

    if (!parsedContent.recipes || !Array.isArray(parsedContent.recipes)) {
      console.error('Unexpected response structure:', parsedContent);
      throw new Error('Invalid response structure from OpenAI');
    }

    return NextResponse.json({ recipes: parsedContent.recipes });

  } catch (error) {
    console.error('Recipe generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate recipes' },
      { status: 500 }
    );
  }
}