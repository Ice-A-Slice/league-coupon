# AI-Generated Email System PRD

## Overview
Add an automated email system to the existing Next.js betting app that sends personalized, AI-generated emails to users. The system will send post-round summaries and pre-round reminders to enhance user engagement and provide valuable insights about Premier League results and internal league standings.

## Core Features

### 1. Post-Round Summary Emails
- **Purpose**: Inform users about Premier League results and current league standings
- **Content**: 
  - Premier League match results from the completed round
  - Internal league standings with user's current position
  - Top performers from the round
  - User's personal performance highlights
  - Position changes in the leaderboard
- **Timing**: Sent automatically when a round ends (using existing round completion logic)
- **Tone**: Friendly, engaging, personalized using LLaMA model

### 2. Pre-Round Reminder Emails
- **Purpose**: Encourage users to submit predictions before deadline
- **Content**:
  - Upcoming Premier League fixtures
  - Deadline countdown
  - User's current league position
  - Motivational messaging to maintain engagement
- **Timing**: Sent 24 hours before new round starts
- **Tone**: Encouraging, urgent but friendly

### 3. Email Template System
- **Technology**: JSX-based templates using @react-email
- **Design**: Mobile-friendly, consistent with app branding
- **Personalization**: User name, position, performance data
- **Templates**: SummaryEmail.tsx and ReminderEmail.tsx

## User Experience

### Target Users
- All registered users (50 initially, designed for scale)
- MVP: Automatic enrollment, no opt-out initially
- Future: Email preferences system

### User Journey
1. User completes round predictions
2. Round ends → Automatic summary email sent
3. 24 hours before next round → Reminder email sent
4. User receives personalized, AI-generated content
5. User engages with app based on email prompts

## Technical Architecture

### System Components
- **API Routes**: `/api/send-summary` and `/api/send-reminder`
- **Email Service**: Resend with JSX templates
- **AI Service**: LLaMA model for content generation
- **Data Sources**: 
  - API-Football for match results and fixtures
  - Existing internal leaderboard data
  - User profiles and prediction data
- **Scheduling**: Vercel Scheduler for automated triggers

### Data Models
- Leverage existing user and prediction data
- Round completion detection (existing logic)
- Email tracking and delivery status
- Error logging and alerting

### Helper Modules
- `lib/llama.ts` - AI content generation
- `lib/resend.ts` - Email sending utilities
- `lib/apiFootball.ts` - Match data fetching
- `lib/emailScheduler.ts` - Timing and trigger logic

## Development Roadmap

### Phase 1: Core Email Infrastructure (MVP)
- Set up Resend integration
- Create basic JSX email templates
- Implement `/api/send-summary` route
- Implement `/api/send-reminder` route
- Basic error handling and logging

### Phase 2: AI Content Generation
- Integrate LLaMA model for content generation
- Develop prompts for summary and reminder emails
- Implement personalization logic
- Test AI-generated content quality

### Phase 3: Automation & Scheduling
- Set up Vercel Scheduler triggers
- Implement round completion detection
- Create 24-hour reminder scheduling
- Add email delivery tracking

### Phase 4: Testing & Refinement
- Implement test account system
- Create email preview functionality
- Add comprehensive error handling
- Set up monitoring and alerting

### Phase 5: Production Deployment
- Deploy to production environment
- Monitor initial email sends
- Gather user feedback
- Performance optimization

## Logical Dependency Chain

### Foundation First
1. **Email Infrastructure** - Must work before AI content
2. **Basic Templates** - Structure before dynamic content
3. **API Routes** - Core functionality before automation
4. **Data Integration** - Access to existing data systems

### AI Integration
5. **LLaMA Setup** - After basic email system works
6. **Content Generation** - After AI model is configured
7. **Personalization** - After content generation is stable

### Automation Layer
8. **Scheduling Logic** - After manual sending works
9. **Vercel Scheduler** - After scheduling logic is tested
10. **Monitoring** - After automation is deployed

## Risks and Mitigations

### Technical Challenges
- **AI Model Integration**: Start with simpler prompts, iterate to complexity
- **Email Deliverability**: Use Resend's best practices, monitor bounce rates
- **API Dependencies**: Implement fallback content for API failures

### MVP Approach
- **Start Simple**: Basic templates with minimal AI, add sophistication gradually
- **Validate Core Flow**: Manual triggers before full automation
- **Iterative Content**: Improve AI prompts based on initial results

### Resource Constraints
- **Incremental Development**: Each phase delivers working functionality
- **Existing Infrastructure**: Leverage current data and round logic
- **Focused Scope**: Email system only, no major app changes

## Success Metrics
- Email delivery rate > 95%
- Open rate > 40%
- Click-through rate > 15%
- User engagement increase post-email
- Zero critical email failures

## Technical Specifications

### Environment Variables
- `RESEND_API_KEY`
- `LLAMA_API_KEY` 
- `FOOTBALL_API_KEY` (existing)
- `EMAIL_TEST_MODE` (for development)

### API Endpoints
- `POST /api/send-summary` - Trigger summary email
- `POST /api/send-reminder` - Trigger reminder email
- `GET /api/email-preview` - Preview email content (development)

### Email Templates
- Mobile-responsive design
- Consistent branding with app
- Proper fallbacks for email clients
- Accessibility considerations

## Appendix

### Integration Points
- Existing user management system
- Current round management logic
- Established Premier League data fetching
- Existing leaderboard calculations

### Future Enhancements
- User email preferences
- Email frequency controls
- Advanced personalization
- A/B testing for content optimization
- Email analytics dashboard 