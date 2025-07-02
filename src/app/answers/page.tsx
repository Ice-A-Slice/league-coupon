import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserPredictionsTable from '@/components/answers/UserPredictionsTable';
import CurrentAnswersTable from '@/components/answers/CurrentAnswersTable';
import { logger } from '@/utils/logger';

// Types for the data we'll fetch
interface UserPrediction {
  user_id: string;
  username?: string;
  league_winner?: string;
  best_goal_difference?: string;
  top_scorer?: string;
  last_place?: string;
}

interface CurrentAnswer {
  question_type: string;
  question_label: string;
  current_answer: string;
  points_value: number;
}

interface TransparencyData {
  userPredictions: UserPrediction[];
  currentAnswers: CurrentAnswer[];
  season_id: number;
}

async function getTransparencyData(): Promise<TransparencyData | null> {
  const loggerContext = { page: '/answers', function: 'getTransparencyData' };
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/season-answers`, {
      method: 'GET',
      cache: 'no-store', // Ensure we get fresh data
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: TransparencyData = await response.json();
    
    logger.info({ 
      ...loggerContext, 
      userPredictions: data.userPredictions.length, 
      currentAnswers: data.currentAnswers.length,
      seasonId: data.season_id 
    }, 'Successfully fetched transparency data from API.');
    
    return data;
  } catch (error) {
    logger.error(
      { ...loggerContext, error: error instanceof Error ? error.message : String(error) },
      'Failed to fetch transparency data from API'
    );
    return null;
  }
}

/**
 * Answers Page - Shows transparency data for season predictions
 * 
 * Displays two tabs:
 * 1. User Predictions - All user season predictions
 * 2. Current Leaders - Current correct answers (with multiple answers support)
 */
export default async function AnswersPage() {
  const transparencyData = await getTransparencyData();

  if (!transparencyData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Season Answers</h1>
        <p className="text-red-500">Failed to load answers data. Please try again later.</p>
      </div>
    );
  }

  const { userPredictions, currentAnswers } = transparencyData;
  const hasUserPredictions = userPredictions && userPredictions.length > 0;
  const hasCurrentAnswers = currentAnswers && currentAnswers.length > 0;

  if (!hasUserPredictions && !hasCurrentAnswers) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Season Answers</h1>
        <p className="text-gray-600">No transparency data available at this time.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Season Answers</h1>
      <p className="text-gray-600 mb-6">
        View everyone&apos;s season predictions and current correct answers for transparency.
      </p>
      
      <Tabs defaultValue="predictions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="predictions">User Answers</TabsTrigger>
          <TabsTrigger value="current">Correct Answers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="predictions">
          <UserPredictionsTable data={userPredictions} />
        </TabsContent>
        
        <TabsContent value="current">
          <CurrentAnswersTable data={currentAnswers} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 