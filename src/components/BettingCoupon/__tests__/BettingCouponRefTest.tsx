import React, { useRef, useState } from 'react';
import BettingCoupon, { BettingCouponRef } from '../BettingCoupon';
import type { Match } from '../types';

// Sample matches for testing
const testMatches: Match[] = [
  { id: '1', homeTeam: 'Team A', awayTeam: 'Team B' },
  { id: '2', homeTeam: 'Team C', awayTeam: 'Team D' },
  { id: '3', homeTeam: 'Team E', awayTeam: 'Team F' }
];

/**
 * Test component that demonstrates using the BettingCoupon validation via ref
 */
const BettingCouponRefTest: React.FC = () => {
  // Create ref for the BettingCoupon component
  const bettingCouponRef = useRef<BettingCouponRef>(null);
  
  // State to track validation results
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors?: Record<string, string>;
  }>({ isValid: true });
  
  // Function to trigger validation
  const handleValidate = () => {
    if (bettingCouponRef.current) {
      const result = bettingCouponRef.current.validate();
      setValidationResult(result);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">BettingCoupon Ref Test</h1>
      
      {/* Render the BettingCoupon component with ref */}
      <BettingCoupon
        ref={bettingCouponRef}
        matches={testMatches}
      />
      
      {/* Validation control buttons */}
      <div className="mt-4">
        <button 
          onClick={handleValidate}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Validate Selections
        </button>
      </div>
      
      {/* Display validation results */}
      <div className="mt-4 p-4 border rounded">
        <h2 className="font-semibold">Validation Results:</h2>
        <p>Valid: {validationResult.isValid ? 'Yes' : 'No'}</p>
        
        {validationResult.errors && Object.keys(validationResult.errors).length > 0 && (
          <div className="mt-2">
            <h3 className="font-semibold">Errors:</h3>
            <ul className="list-disc pl-5">
              {Object.entries(validationResult.errors).map(([key, error]) => (
                <li key={key}>
                  <span className="font-medium">{key}:</span> {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default BettingCouponRefTest; 