import { NextResponse } from 'next/server';
import * as tf from '@tensorflow/tfjs';

export async function GET() {
  try {
    // Test TensorFlow.js
    const tfVersion = tf.version.tfjs;
    
    // Test OpenAI configuration
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    return NextResponse.json({
      status: 'healthy',
      versions: {
        tensorflow: tfVersion,
      },
      configuration: {
        openai: hasOpenAI ? 'configured' : 'missing',
      }
    });
  } catch (err) {
    // Type guard to handle unknown error type
    const error = err as Error;
    return NextResponse.json({
      status: 'error',
      error: error?.message || 'An unknown error occurred'
    }, { status: 500 });
  }
}