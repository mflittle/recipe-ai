// src/components/ui/ImageUpload.tsx
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Upload } from "lucide-react";

interface ImageUploadProps {
  onImageProcessed: (ingredients: string[], suggestedIngredients: string[]) => void;
  onError: (error: string, detectedObject?: { label: string; confidence: number }) => void;
}

export function ImageUpload({ onImageProcessed, onError }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  // In handleSubmit method of ImageUpload component
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;
  
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);
  
    try {
      console.log('Making API request to /api/detect-ingredients');
      const response = await fetch('/api/detect-ingredients', {
        method: 'POST',
        body: formData,
      });
  
      const data = await response.json();
      console.log('API Response:', JSON.stringify(data, null, 2));
  
      if (data.error) {
        onError(data.error, data.detectedObject);
      } else if (data.isFood) {
        // Call parent component with both ingredients and suggestions
        onImageProcessed(
          data.ingredients || [],
          data.suggestedIngredients || []
        );
        // Set any success message if provided
        if (data.message) {
          setError(data.message);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      onError('Failed to process image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
          <label htmlFor="image-upload" className="w-full">
            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-400 transition-colors">
              <Upload className="h-8 w-8 text-gray-500" />
              <p className="text-sm text-gray-600">
                {selectedFile ? selectedFile.name : 'Click to upload a photo of your fridge contents'}
              </p>
            </div>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
          
          {isUploading && (
            <p className="text-sm text-gray-600">Processing image...</p>
          )}
          
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          
          {selectedFile && !isUploading && (
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Process Image
            </button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}