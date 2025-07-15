# Hall of Fame API Documentation

The Hall of Fame API provides endpoints for managing and retrieving season winners and related statistics for the League Coupon system. The API is split into public endpoints (for displaying Hall of Fame data) and admin endpoints (for managing entries).

## Table of Contents

1. [Authentication](#authentication)
2. [Public Endpoints](#public-endpoints)
3. [Admin Endpoints](#admin-endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Integration Examples](#integration-examples)
7. [Database Schema](#database-schema)

## Authentication

### Public Endpoints
Public endpoints require no authentication and are accessible to all users.

### Admin Endpoints
Admin endpoints require authentication using the `CRON_SECRET` environment variable. There are two ways to authenticate:

1. **Bearer Token**: Include in the `Authorization` header
   ```
   Authorization: Bearer YOUR_CRON_SECRET
   ```

2. **Custom Header**: Include as a custom header
   ```
   X-Cron-Secret: YOUR_CRON_SECRET
   ```

## Public Endpoints

### 1. Get Hall of Fame Entries

Retrieves paginated list of all season winners.

```http
GET /api/hall-of-fame
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Number of results per page (max: 100) |
| `offset` | number | 0 | Number of results to skip |
| `sort` | string | 'newest' | Sort order: 'newest', 'oldest', 'points_desc', 'points_asc' |
| `competition_id` | number | - | Filter by specific competition/league |

#### Response Format

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "season_id": 1,
      "user_id": "user-uuid",
      "league_id": 39,
      "total_points": 150,
      "game_points": 120,
      "dynamic_points": 30,
      "created_at": "2023-01-01T00:00:00Z",
      "season": {
        "id": 1,
        "name": "Premier League 2022/23",
        "api_season_year": 2022,
        "start_date": "2022-08-01",
        "end_date": "2023-05-31",
        "completed_at": "2023-05-31T23:59:59Z",
        "winner_determined_at": "2023-06-01T00:00:00Z",
        "competition": {
          "id": 39,
          "name": "Premier League",
          "country_name": "England",
          "logo_url": "https://example.com/logo.png"
        }
      },
      "profile": {
        "id": "user-uuid",
        "full_name": "John Doe",
        "avatar_url": "https://example.com/avatar.jpg",
        "updated_at": "2023-01-01T00:00:00Z"
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "total": 50,
    "count": 20
  },
  "metadata": {
    "requestId": "req-uuid",
    "timestamp": "2024-01-01T00:00:00Z",
    "processingTime": 45
  }
}
```

#### Example Request

```bash
curl "https://your-domain.com/api/hall-of-fame?limit=10&sort=points_desc&competition_id=39"
```

### 2. Get Season Winner

Retrieves the Hall of Fame winner for a specific season.

```http
GET /api/hall-of-fame/season/{id}
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Season ID |

#### Response Format

```json
{
  "success": true,
  "data": {
    "id": 1,
    "season_id": 1,
    "user_id": "user-uuid",
    "league_id": 39,
    "total_points": 150,
    "game_points": 120,
    "dynamic_points": 30,
    "created_at": "2023-01-01T00:00:00Z",
    "season": {
      "id": 1,
      "name": "Premier League 2022/23",
      "api_season_year": 2022,
      "start_date": "2022-08-01",
      "end_date": "2023-05-31",
      "completed_at": "2023-05-31T23:59:59Z",
      "winner_determined_at": "2023-06-01T00:00:00Z",
      "competition": {
        "id": 39,
        "name": "Premier League",
        "country_name": "England",
        "logo_url": "https://example.com/logo.png"
      }
    },
    "profile": {
      "id": "user-uuid",
      "full_name": "John Doe",
      "avatar_url": "https://example.com/avatar.jpg",
      "updated_at": "2023-01-01T00:00:00Z"
    }
  },
  "metadata": {
    "requestId": "req-uuid",
    "timestamp": "2024-01-01T00:00:00Z",
    "processingTime": 25
  }
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid season ID |
| 404 | Season winner not found |
| 500 | Internal server error |

#### Example Request

```bash
curl "https://your-domain.com/api/hall-of-fame/season/1"
```

### 3. Get Hall of Fame Statistics

Retrieves aggregated statistics and leaderboards.

```http
GET /api/hall-of-fame/stats
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Number of players to return (max: 100) |
| `sort` | string | 'wins_desc' | Sort order: 'wins_desc', 'wins_asc', 'points_desc', 'points_asc', 'recent' |
| `competition_id` | number | - | Filter by specific competition/league |
| `include_seasons` | boolean | false | Include detailed season information for each player |

#### Response Format

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "user": {
          "id": "user-uuid",
          "full_name": "John Doe",
          "avatar_url": "https://example.com/avatar.jpg",
          "updated_at": "2023-01-01T00:00:00Z"
        },
        "total_wins": 3,
        "total_points": 450,
        "average_points": 150,
        "best_points": 160,
        "worst_points": 140,
        "first_win_date": "2022-06-01T00:00:00Z",
        "latest_win_date": "2024-06-01T00:00:00Z",
        "seasons_won": [
          {
            "season_id": 1,
            "season_name": "Premier League 2022/23",
            "season_year": 2022,
            "completed_at": "2023-05-31T23:59:59Z",
            "competition": {
              "id": 39,
              "name": "Premier League",
              "country_name": "England",
              "logo_url": "https://example.com/logo.png"
            },
            "points": 150
          }
        ]
      }
    ],
    "overall_stats": {
      "total_players": 25,
      "total_seasons_completed": 48,
      "total_points_awarded": 7200,
      "average_points_per_season": 150,
      "top_player": {
        "user": {
          "id": "user-uuid",
          "full_name": "John Doe"
        },
        "total_wins": 3,
        "total_points": 450
      }
    }
  },
  "query_info": {
    "sort": "wins_desc",
    "competition_id": null,
    "include_seasons": false,
    "limit": 50,
    "total_records": 25,
    "request_time_ms": 78
  }
}
```

#### Example Request

```bash
curl "https://your-domain.com/api/hall-of-fame/stats?limit=20&sort=wins_desc&include_seasons=true"
```

## Admin Endpoints

### 1. Manual Season Completion

Manually triggers season completion and winner determination.

```http
POST /api/admin/season-complete
```

#### Authentication Required
Include `CRON_SECRET` in headers as described in [Authentication](#authentication).

#### Request Body

```json
{
  "season_id": 1,
  "force": false,
  "skip_winner_determination": false
}
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `season_id` | number | required | The ID of the season to complete |
| `force` | boolean | false | Force completion even if criteria not met |
| `skip_winner_determination` | boolean | false | Complete season but skip winner determination |

#### Response Format

```json
{
  "success": true,
  "data": {
    "season": {
      "id": 1,
      "name": "Premier League 2022/23",
      "api_season_year": 2022,
      "competition": {
        "id": 39,
        "name": "Premier League",
        "country_name": "England"
      }
    },
    "completion_result": {
      "season_id": 1,
      "completed": true,
      "forced": false,
      "completed_at": "2024-01-01T00:00:00Z"
    },
    "winner_determination_result": {
      "seasonId": 1,
      "winnerId": "user-uuid",
      "winnerDetails": {
        "totalPoints": 150,
        "gamePoints": 120,
        "dynamicPoints": 30
      }
    },
    "skipped_winner_determination": false,
    "forced": false
  },
  "processing_info": {
    "request_id": "req-uuid",
    "processing_time_ms": 1250,
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### Example Request

```bash
curl -X POST "https://your-domain.com/api/admin/season-complete" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"season_id": 1, "force": false}'
```

### 2. Hall of Fame Management

Manage Hall of Fame entries (view, create, update, delete).

#### Get All Entries (Admin View)

```http
GET /api/admin/hall-of-fame
```

##### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Number of results per page (max: 200) |
| `offset` | number | 0 | Number of results to skip |
| `competition_id` | number | - | Filter by competition |
| `season_id` | number | - | Filter by season |
| `user_id` | string | - | Filter by user |
| `sort` | string | 'newest' | Sort order |
| `include_inactive` | boolean | false | Include soft-deleted entries |

#### Create Entry

```http
POST /api/admin/hall-of-fame
```

##### Request Body

```json
{
  "season_id": 1,
  "user_id": "user-uuid",
  "total_points": 150,
  "game_points": 120,
  "dynamic_points": 30,
  "override_existing": false
}
```

##### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `season_id` | number | Required. Season ID |
| `user_id` | string | Required. User UUID |
| `total_points` | number | Required. Total points scored |
| `game_points` | number | Optional. Points from games |
| `dynamic_points` | number | Optional. Dynamic/bonus points |
| `override_existing` | boolean | Whether to override existing winner |

#### Delete Entry

```http
DELETE /api/admin/hall-of-fame
```

##### Request Body

```json
{
  "winner_id": 1
}
```

OR

```json
{
  "season_id": 1
}
```

##### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `winner_id` | number | ID of winner entry to delete |
| `season_id` | number | Delete winner for this season |
| `soft_delete` | boolean | Whether to soft delete (not implemented) |

#### Example Requests

```bash
# Get all Hall of Fame entries (admin view)
curl "https://your-domain.com/api/admin/hall-of-fame?limit=100" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Create new Hall of Fame entry
curl -X POST "https://your-domain.com/api/admin/hall-of-fame" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "season_id": 1,
    "user_id": "user-uuid",
    "total_points": 150,
    "game_points": 120,
    "dynamic_points": 30
  }'

# Delete Hall of Fame entry
curl -X DELETE "https://your-domain.com/api/admin/hall-of-fame" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"winner_id": 1}'
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information (optional)"
}
```

### Common HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid authentication |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

## Rate Limiting

- Public endpoints: No rate limiting (cached responses)
- Admin endpoints: No specific rate limiting (protected by authentication)

### Caching

Public endpoints include caching headers:
- Hall of Fame listings: 3 minutes cache
- Season-specific data: 5 minutes cache  
- Statistics: 3 minutes cache

## Integration Examples

### Frontend Components

#### React Hook for Hall of Fame Data

```typescript
import { useState, useEffect } from 'react';

interface HallOfFameEntry {
  id: number;
  season: {
    name: string;
    api_season_year: number;
    competition: {
      name: string;
      country_name: string;
      logo_url: string;
    };
  };
  profile: {
    full_name: string;
    avatar_url: string;
  };
  total_points: number;
  created_at: string;
}

interface HallOfFameResponse {
  data: HallOfFameEntry[];
  pagination: {
    total: number;
    count: number;
    offset: number;
    limit: number;
  };
}

export function useHallOfFame(params: {
  limit?: number;
  offset?: number;
  sort?: string;
  competitionId?: number;
} = {}) {
  const [data, setData] = useState<HallOfFameResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHallOfFame = async () => {
      try {
        setLoading(true);
        const searchParams = new URLSearchParams();
        
        if (params.limit) searchParams.append('limit', params.limit.toString());
        if (params.offset) searchParams.append('offset', params.offset.toString());
        if (params.sort) searchParams.append('sort', params.sort);
        if (params.competitionId) searchParams.append('competition_id', params.competitionId.toString());

        const response = await fetch(`/api/hall-of-fame?${searchParams}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch Hall of Fame data');
        }

        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHallOfFame();
  }, [params.limit, params.offset, params.sort, params.competitionId]);

  return { data, loading, error };
}
```

#### Hall of Fame Component

```tsx
import React from 'react';
import { useHallOfFame } from './useHallOfFame';

export function HallOfFameList() {
  const { data, loading, error } = useHallOfFame({
    limit: 20,
    sort: 'newest'
  });

  if (loading) return <div>Loading Hall of Fame...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data || data.data.length === 0) return <div>No Hall of Fame entries found.</div>;

  return (
    <div className="hall-of-fame">
      <h2>Hall of Fame</h2>
      <div className="entries">
        {data.data.map((entry) => (
          <div key={entry.id} className="hall-of-fame-entry">
            <div className="winner-info">
              <img 
                src={entry.profile.avatar_url} 
                alt={entry.profile.full_name}
                className="avatar"
              />
              <div>
                <h3>{entry.profile.full_name}</h3>
                <p>{entry.total_points} points</p>
              </div>
            </div>
            <div className="season-info">
              <img 
                src={entry.season.competition.logo_url} 
                alt={entry.season.competition.name}
                className="league-logo"
              />
              <div>
                <h4>{entry.season.name}</h4>
                <p>{entry.season.competition.name}</p>
                <p>{entry.season.competition.country_name}</p>
              </div>
            </div>
            <div className="date">
              {new Date(entry.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
      
      {data.pagination.total > data.pagination.count && (
        <div className="pagination">
          <p>
            Showing {data.pagination.count} of {data.pagination.total} entries
          </p>
          {/* Add pagination controls here */}
        </div>
      )}
    </div>
  );
}
```

### Backend Integration

#### Admin Season Completion Script

```typescript
// scripts/complete-season.ts
import fetch from 'node-fetch';

async function completeSeasonManually(seasonId: number, force = false) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/season-complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      season_id: seasonId,
      force,
      skip_winner_determination: false
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to complete season: ${result.error}`);
  }

  console.log('Season completion result:', result);
  return result;
}

// Usage
completeSeasonManually(1, false)
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
```

## Database Schema

The Hall of Fame API relies on the following database tables:

### `season_winners`
- `id`: Primary key
- `season_id`: Foreign key to seasons table
- `user_id`: Foreign key to profiles table  
- `league_id`: Foreign key to competitions table
- `total_points`: Total points scored
- `game_points`: Points from games
- `dynamic_points`: Dynamic/bonus points
- `created_at`: When the record was created

### Related Tables
- `seasons`: Season information and completion status
- `profiles`: User profile information
- `competitions`: League/competition details

## Testing

Comprehensive test suites are available for all endpoints:

- `src/app/api/hall-of-fame/route.test.ts`
- `src/app/api/hall-of-fame/season/[id]/route.test.ts`
- `src/app/api/hall-of-fame/stats/route.test.ts`
- `src/app/api/admin/hall-of-fame/route.test.ts`
- `src/app/api/admin/season-complete/route.test.ts`

Run tests with:
```bash
npm test api/hall-of-fame
```

## Security Considerations

1. **Admin Authentication**: All admin endpoints require `CRON_SECRET` authentication
2. **Input Validation**: All inputs are validated for type and range
3. **SQL Injection Prevention**: Using Supabase parameterized queries
4. **Rate Limiting**: Consider implementing rate limiting for public endpoints in production
5. **CORS**: Configure appropriate CORS settings for your domain

## Performance Considerations

1. **Caching**: Public endpoints include cache headers
2. **Pagination**: All list endpoints support pagination to limit response size
3. **Database Indexing**: Ensure proper indexes on `season_winners` table:
   - `season_id`
   - `user_id`
   - `league_id`
   - `created_at`
4. **Query Optimization**: Complex aggregation queries in stats endpoint may need optimization for large datasets

## Support

For issues or questions about the Hall of Fame API:

1. Check the test files for usage examples
2. Review error responses for debugging information
3. Monitor application logs for detailed error information
4. Ensure proper database schema and indexes are in place 