/**
 * Unit test for feedback handlers registration
 * Tests that handlers are properly registered without requiring a full MongoDB setup
 */

describe('Feedback Handlers Registration', () => {
  let bot;
  let commandHandlers;
  let hearsHandlers;
  let actionHandlers;

  beforeEach(() => {
    // Mock bot instance
    commandHandlers = {};
    hearsHandlers = [];
    actionHandlers = [];

    bot = {
      command: jest.fn((cmd, handler) => {
        commandHandlers[cmd] = handler;
      }),
      hears: jest.fn((pattern, handler) => {
        hearsHandlers.push({ pattern, handler });
      }),
      action: jest.fn((pattern, handler) => {
        actionHandlers.push({ pattern, handler });
      }),
      on: jest.fn()
    };
  });

  it('should register /feedback command handler', () => {
    const { registerFeedbackHandlers } = require('../server/services/telegram/feedbackHandlers');
    
    registerFeedbackHandlers(bot);

    expect(bot.command).toHaveBeenCalledWith('feedback', expect.any(Function));
    expect(commandHandlers['feedback']).toBeDefined();
  });

  it('should register feedback text trigger (feedback/отзыв)', () => {
    const { registerFeedbackHandlers } = require('../server/services/telegram/feedbackHandlers');
    
    registerFeedbackHandlers(bot);

    expect(bot.hears).toHaveBeenCalled();
    expect(hearsHandlers.length).toBeGreaterThan(0);
    
    // Check if the pattern matches 'feedback' and 'отзыв'
    const feedbackHears = hearsHandlers.find(h => h.pattern instanceof RegExp);
    expect(feedbackHears).toBeDefined();
    expect(feedbackHears.pattern.test('feedback')).toBe(true);
    expect(feedbackHears.pattern.test('FEEDBACK')).toBe(true);
    expect(feedbackHears.pattern.test('отзыв')).toBe(true);
    expect(feedbackHears.pattern.test('ОТЗЫВ')).toBe(true);
    expect(feedbackHears.pattern.test('Feedback')).toBe(true);
  });

  it('should register callback action for fb:rate: pattern', () => {
    const { registerFeedbackHandlers } = require('../server/services/telegram/feedbackHandlers');
    
    registerFeedbackHandlers(bot);

    expect(bot.action).toHaveBeenCalled();
    expect(actionHandlers.length).toBeGreaterThan(0);
    
    // Check if the pattern matches fb:rate:<digit>
    const rateAction = actionHandlers.find(h => h.pattern instanceof RegExp);
    expect(rateAction).toBeDefined();
    expect(rateAction.pattern.test('fb:rate:1')).toBe(true);
    expect(rateAction.pattern.test('fb:rate:2')).toBe(true);
    expect(rateAction.pattern.test('fb:rate:3')).toBe(true);
    expect(rateAction.pattern.test('fb:rate:4')).toBe(true);
    expect(rateAction.pattern.test('fb:rate:5')).toBe(true);
    // Note: The regex accepts any digit, validation happens in the handler
    expect(rateAction.pattern.test('fb:rate:invalid')).toBe(false);
    expect(rateAction.pattern.test('different:pattern')).toBe(false);
  });

  it('should not crash when bot is null', () => {
    const { registerFeedbackHandlers } = require('../server/services/telegram/feedbackHandlers');
    
    expect(() => {
      registerFeedbackHandlers(null);
    }).not.toThrow();
  });

  it('should register text handler for feedback comments', () => {
    const { registerFeedbackHandlers } = require('../server/services/telegram/feedbackHandlers');
    
    registerFeedbackHandlers(bot);

    expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
  });
});
