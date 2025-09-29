/**
 * Unit tests for optimistic statistics updates
 * Tests the instant update functionality for quotes
 */

// Mock DOM environment
global.document = {
    getElementById: jest.fn(),
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    querySelector: jest.fn(),
    createElement: jest.fn(() => ({
        classList: { add: jest.fn(), remove: jest.fn() },
        innerHTML: '',
        textContent: ''
    }))
};

global.window = {
    __statsQuoteEventsBound: false
};

// Mock console for cleaner test output
global.console = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

// Import modules after setting up mocks
const StatisticsService = require('../../mini-app/js/services/StatisticsService.js');

describe('Optimistic Statistics Updates', () => {
    let mockState;
    let mockApi;
    let statsService;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock state management
        mockState = {
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
            setLoading: jest.fn(),
            getCurrentUserId: jest.fn(() => 'test-user-123')
        };

        // Mock API service
        mockApi = {
            getStats: jest.fn(),
            getQuotes: jest.fn(),
            getActivityPercent: jest.fn()
        };

        // Create StatisticsService instance
        statsService = new StatisticsService({ api: mockApi, state: mockState });
    });

    describe('Optimistic calculation helpers', () => {
        test('should calculate weekly quotes correctly using ISO weeks', () => {
            // Create quotes within current ISO week and outside
            const now = new Date();
            
            // Get Monday of current ISO week
            const dayOfWeek = now.getDay() || 7; // Sunday = 7
            const mondayOffset = dayOfWeek === 7 ? 1 : (1 - dayOfWeek);
            const monday = new Date(now);
            monday.setDate(now.getDate() + mondayOffset);
            monday.setHours(12, 0, 0, 0); // Noon on Monday
            
            const tuesday = new Date(monday);
            tuesday.setDate(monday.getDate() + 1);
            tuesday.setHours(12, 0, 0, 0); // Noon on Tuesday
            
            const lastWeek = new Date(monday);
            lastWeek.setDate(monday.getDate() - 7); // One week before
            lastWeek.setHours(12, 0, 0, 0);
            
            const testQuotes = [
                { id: 1, text: 'Quote 1', author: 'Author A', createdAt: monday }, // This week
                { id: 2, text: 'Quote 2', author: 'Author A', createdAt: tuesday }, // This week
                { id: 3, text: 'Quote 3', author: 'Author B', createdAt: lastWeek }, // Last week
            ];

            const result = statsService._calculateOptimisticStats(testQuotes);

            expect(result.totalQuotes).toBe(3);
            expect(result.weeklyQuotes).toBe(2); // Only quotes from current ISO week
            expect(result.favoriteAuthor).toBe('Author A'); // 2 quotes vs 1
        });

        test('should handle empty quotes array', () => {
            const result = statsService._calculateOptimisticStats([]);

            expect(result.totalQuotes).toBe(0);
            expect(result.weeklyQuotes).toBe(0);
            expect(result.favoriteAuthor).toBe('—');
        });
    });

    describe('Event handling with optimistic updates', () => {
        test('should update optimistically first, then call silent refresh', async () => {
            // Setup mock quotes
            const testQuotes = [
                { id: 1, text: 'Quote 1', author: 'Author A', createdAt: new Date() }
            ];
            
            mockState.get.mockImplementation((path) => {
                if (path === 'quotes.items') return testQuotes;
                if (path === 'stats') return { totalQuotes: 0, weeklyQuotes: 0 };
                if (path === 'diaryStats') return { totalQuotes: 0, weeklyQuotes: 0 };
                return null;
            });

            // Mock the API calls to prevent actual network requests
            mockApi.getStats.mockResolvedValue({ totalQuotes: 1, currentStreak: 1 });
            mockApi.getQuotes.mockResolvedValue({ quotes: testQuotes });
            mockApi.getActivityPercent.mockResolvedValue(50);

            // Spy on private methods
            const optimisticUpdateSpy = jest.spyOn(statsService, '_updateOptimisticStats');

            // Trigger quote added event
            await statsService.onQuoteAdded({ type: 'added', quote: testQuotes[0] });

            // Verify optimistic update was called first
            expect(optimisticUpdateSpy).toHaveBeenCalled();
            
            // Verify state was updated with optimistic stats
            expect(mockState.set).toHaveBeenCalledWith('stats', expect.objectContaining({
                totalQuotes: 1,
                weeklyQuotes: 1,
                thisWeek: 1, // Should be mirrored
                loading: false
            }));

            expect(mockState.set).toHaveBeenCalledWith('diaryStats', expect.objectContaining({
                totalQuotes: 1,
                weeklyQuotes: 1,
                loading: false
            }));
        });

        test('should mirror weeklyQuotes to thisWeek for UI compatibility', () => {
            const testQuotes = [
                { id: 1, text: 'Quote 1', author: 'Author A', createdAt: new Date() }
            ];
            
            mockState.get.mockImplementation((path) => {
                if (path === 'quotes.items') return testQuotes;
                if (path === 'stats') return {};
                if (path === 'diaryStats') return {};
                return null;
            });

            statsService._updateOptimisticStats();

            // Check that both weeklyQuotes and thisWeek are set
            const statsCall = mockState.set.mock.calls.find(call => call[0] === 'stats');
            expect(statsCall[1]).toEqual(expect.objectContaining({
                weeklyQuotes: 1,
                thisWeek: 1 // Should be mirrored
            }));
        });
    });

    describe('State event dispatching', () => {
        test('should dispatch events when updating optimistic stats', () => {
            const testQuotes = [
                { id: 1, text: 'Quote 1', author: 'Author A', createdAt: new Date() }
            ];
            
            mockState.get.mockImplementation((path) => {
                if (path === 'quotes.items') return testQuotes;
                if (path === 'stats') return {};
                if (path === 'diaryStats') return {};
                return null;
            });

            statsService._updateOptimisticStats();

            // Verify events were dispatched
            expect(global.document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'stats:updated'
                })
            );

            expect(global.document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'diary-stats:updated'
                })
            );
        });
    });
});