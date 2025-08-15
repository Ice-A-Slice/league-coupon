import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserPredictionsSkeleton from '@/components/answers/UserPredictionsSkeleton';
import CurrentAnswersSkeleton from '@/components/answers/CurrentAnswersSkeleton';

export default function Loading() {
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
          <UserPredictionsSkeleton />
        </TabsContent>
        
        <TabsContent value="current">
          <CurrentAnswersSkeleton />
        </TabsContent>
      </Tabs>
    </div>
  );
}