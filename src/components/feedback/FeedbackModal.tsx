'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface FeedbackModalProps {
  children?: React.ReactNode;
}

export function FeedbackModal({ children }: FeedbackModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          userEmail: user?.email || null,
          userName: user?.user_metadata?.full_name || user?.user_metadata?.name || null,
          currentPage: window.location.pathname,
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setMessage('');
        // Auto-close after 2 seconds
        setTimeout(() => {
          setIsOpen(false);
          setIsSubmitted(false);
        }, 2000);
      } else {
        throw new Error('Failed to send feedback');
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
      alert('Failed to send feedback. Please try again or contact us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setMessage('');
    setIsSubmitted(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="outline"
            size="sm"
            className="fixed bottom-20 md:bottom-6 right-6 z-40 shadow-lg hover:shadow-xl transition-all duration-200 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            aria-label="Send feedback to administrators"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Feedback</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Send Feedback
            </DialogTitle>
          </div>
          <DialogDescription>
            Share your thoughts, suggestions, or report issues. Your feedback helps us improve the application!
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-8 text-center">
            <div className="mb-4">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Thank you!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Your feedback has been sent to the administrators. We appreciate your input!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="feedback-message"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Your message
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your thoughts, suggestions, or report any issues..."
                className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 cursor-text"
                required
                disabled={isSubmitting}
                maxLength={1000}
              />
              <div className="mt-1 text-right">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {message.length}/1000
                </span>
              </div>
            </div>

            {user && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
                <p className="text-gray-600 dark:text-gray-300">
                  <strong>Sending as:</strong> {user.user_metadata?.full_name || user.user_metadata?.name || user.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  From page: {typeof window !== 'undefined' ? window.location.pathname : '/'}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}