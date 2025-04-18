// Import jest-dom's custom assertions
require('@testing-library/jest-dom');

// Mock ResizeObserver which is not available in the jsdom environment
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observations = [];
  }
  observe(target) {
    this.observations.push(target);
  }
  unobserve(target) {
    this.observations = this.observations.filter(el => el !== target);
  }
  disconnect() {
    this.observations = [];
  }
};

// Mock for scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Add any global setup needed for your tests here 