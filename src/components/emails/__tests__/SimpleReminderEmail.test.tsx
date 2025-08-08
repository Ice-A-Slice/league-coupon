import React from 'react';
import { render, screen } from '@testing-library/react';
import { SimpleReminderEmail } from '@/components/emails/SimpleReminderEmail';

describe('SimpleReminderEmail', () => {
  const defaultProps = {
    roundName: 'Round 5',
    submittedUsers: ['John Doe', 'Jane Smith', 'Bob Johnson'],
    gameLeaderInitials: 'PC',
    appUrl: 'https://example.com'
  };

  describe('Rendering', () => {
    test('renders without crashing', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
    });

    test('displays correct round name', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      expect(screen.getAllByText(/Round 5/)[0]).toBeInTheDocument();
    });

    test('displays greeting', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      expect(screen.getByText('Dear friends,')).toBeInTheDocument();
    });

    test('displays game leader initials', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      expect(screen.getByText(/PC/)).toBeInTheDocument();
    });
  });

  describe('Submitted Users List', () => {
    test('displays all submitted users when list is short', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    test('handles empty submitted users list', () => {
      render(<SimpleReminderEmail {...defaultProps} submittedUsers={[]} />);
      expect(screen.getByText('No one has submitted yet.')).toBeInTheDocument();
    });

    test('formats single user correctly', () => {
      render(<SimpleReminderEmail {...defaultProps} submittedUsers={['John Doe']} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    test('formats two users with "and"', () => {
      render(<SimpleReminderEmail {...defaultProps} submittedUsers={['John Doe', 'Jane Smith']} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    test('formats many users as paragraph when more than 15', () => {
      const manyUsers = Array.from({ length: 20 }, (_, i) => `User ${i + 1}`);
      render(<SimpleReminderEmail {...defaultProps} submittedUsers={manyUsers} />);
      // Should format as a paragraph with commas and "and" for the last user
      expect(screen.getByText(/User 1, User 2/)).toBeInTheDocument();
      expect(screen.getByText(/and User 20/)).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    test('displays reminder message', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      expect(screen.getByText(/This is a friendly reminder to submit your bets/)).toBeInTheDocument();
    });

    test('displays submission status message', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      expect(screen.getByText(/So far we've received the bets from:/)).toBeInTheDocument();
    });

    test('displays sign off with best regards', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      expect(screen.getByText(/Best regards,/)).toBeInTheDocument();
    });
  });

  describe('Link', () => {
    test('includes submit link when appUrl is provided', () => {
      render(<SimpleReminderEmail {...defaultProps} />);
      const link = screen.getByText('Submit your bets here');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://example.com');
    });

    test('handles missing appUrl gracefully', () => {
      const { container } = render(<SimpleReminderEmail {...defaultProps} appUrl={undefined} />);
      expect(container.textContent).not.toContain('Submit your bets here');
    });
  });

  describe('Preview', () => {
    test('generates appropriate preview text', () => {
      const { container } = render(<SimpleReminderEmail {...defaultProps} />);
      // The preview text is in a data-skip-in-text div
      expect(container.textContent).toContain('Reminder to submit your bets for Round 5');
    });
  });
});