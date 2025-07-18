# 1X2 Betting Coupon Component

This project contains a reusable React component for displaying a 1X2 betting coupon, built with Next.js, TypeScript, and Tailwind CSS.

## Component: BettingCoupon

Located in `src/components/BettingCoupon`.

### Usage

Import the component and necessary types:

```typescript
import BettingCoupon from '@/components/BettingCoupon';
import { Match, Selections } from '@/components/BettingCoupon/types';
```

Render the component with required props:

```tsx
const MyPage = () => {
  const matchesData: Match[] = [
    { id: 1, homeTeam: "Team A", awayTeam: "Team B" },
    // ... more matches
  ];

  const handleSelectionChange = (currentSelections: Selections) => {
    console.log('Current selections:', currentSelections);
  };

  return (
    <BettingCoupon 
      matches={matchesData} 
      onSelectionChange={handleSelectionChange}
      // Optional: Provide initial selections
      // initialSelections={{ '1': 'X' }}
    />
  );
}
```

### Props

-   `matches` (required): `Match[]`
    -   An array of match objects.
    -   `Match` interface: `{ id: string | number; homeTeam: string; awayTeam: string; }`
-   `initialSelections` (optional): `Selections`
    -   An object mapping match IDs (as strings) to their initially selected outcome (`'1'`, `'X'`, `'2'`).
    -   Example: `{ '1': '1', '3': 'X' }`
-   `onSelectionChange` (optional): `(selections: Selections) => void`
    -   A callback function triggered whenever a selection is made, changed, or cleared.
    -   Receives the current selections object as an argument.

### Demo

A basic demo is available on the home page (`/`). Run the development server to view it:

```bash
npm run dev
```

---

## Core Concepts

### Dynamic Betting Rounds

A key concept in this application is the dynamic handling of betting rounds. While the underlying football data API provides static rounds (e.g., "Regular Season - 34"), user betting and scoring operate on dynamically generated **Betting Rounds** (stored in the `betting_rounds` table).

**Problem:** Fixtures for a single betting coupon presented to the user might span multiple official API rounds due to scheduling (e.g., midweek games). Relying solely on static API rounds for locking bets and scoring leads to a disjointed user experience.

**Solution:**

1.  **Dynamic Generation:** The `getCurrentBettingRoundFixtures` logic identifies the next group of fixtures based on time gaps (e.g., within 72 hours), potentially combining fixtures from different API rounds (resulting in names like "Round 34/35").
2.  **Persistence:** When a user submits bets for such a group, a record is created in the `betting_rounds` table to represent this specific instance. This record stores the dynamic name, the associated `competition_id`, and lifecycle status (`open`, `closed`, `scoring`, `scored`).
3.  **Fixture Linking:** The `betting_round_fixtures` join table explicitly links each `betting_rounds` instance to the specific `fixtures` it contained.
4.  **Bet Linking:** User submissions (`user_bets` table) reference the `betting_rounds.id` via the `betting_round_id` foreign key, *not* the static API `rounds.id`.
5.  **Scoring Context:** This `betting_rounds` instance becomes the unit for scoring calculations, round completion detection, and standings updates, ensuring consistency with the user's betting experience.

---

## Original Next.js README Content:

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
