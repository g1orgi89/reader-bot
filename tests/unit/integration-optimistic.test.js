/**
 * Integration test for the complete optimistic statistics flow
 * Simulates browser environment and tests the entire chain
 */

// Mock browser environment
global.navigator = { onLine: true };
global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
};

global.window = {
    __statsQuoteEventsBound: false,
    location: {
        hostname: 'localhost',
        href: 'http://localhost:3000',
        pathname: '/'
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    CustomEvent: class MockCustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    }
};

global.document = {
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    querySelector: jest.fn(),
    getElementById: jest.fn(),
    createElement: jest.fn(() => ({
        classList: { add: jest.fn(), remove: jest.fn() },
        innerHTML: '',
        style: {}
    }))
};

// Mock console
global.console = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('Complete Optimistic Statistics Flow Integration', () => {
    let AppState;
    let StatisticsService;
    let state;
    let statsService;
    let mockApi;

    beforeAll(() => {
        // Import modules after setting up environment
        AppState = require('../../mini-app/js/core/State.js');
        StatisticsService = require('../../mini-app/js/services/StatisticsService.js');
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        
        // Create state instance
        state = new AppState();
        await state.init();

        // Mock API service
        mockApi = {
            getStats: jest.fn().mockResolvedValue({
                stats: { totalQuotes: 5, currentStreak: 3, weeklyQuotes: 2 }
            }),
            getQuotes: jest.fn().mockResolvedValue({
                quotes: [
                    { id: 1, text: 'Quote 1', author: 'Author A', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
                    { id: 2, text: 'Quote 2', author: 'Author A', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }
                ]
            }),
            getActivityPercent: jest.fn().mockResolvedValue(75)
        };

        // Create StatisticsService instance  
        statsService = new StatisticsService({ api: mockApi, state });

        // Setup initial quotes in state
        state.setQuotes([
            { id: 1, text: 'Quote 1', author: 'Author A', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
            { id: 2, text: 'Quote 2', author: 'Author A', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }
        ], 2);
    });

    describe('End-to-end optimistic update flow', () => {
        test('should handle complete add quote flow with instant UI update', async () => {
            const newQuote = { 
                id: 3, 
                text: 'New optimistic quote', 
                author: 'Author B', 
                createdAt: new Date() 
            };

            // Simulate adding a quote through State
            state.addQuote(newQuote);

            // Verify quotes:changed event was dispatched
            expect(document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'quotes:changed',
                    detail: { type: 'added', quote: newQuote }
                })
            );

            // Verify quote is in state
            expect(state.get('quotes.items')).toHaveLength(3);
            expect(state.get('quotes.lastAdded')).toBe(newQuote);

            // Simulate the StatisticsService receiving the event
            await statsService.onQuoteAdded({ quote: newQuote });

            // Check that optimistic stats were updated
            const currentStats = state.get('stats');
            expect(currentStats.totalQuotes).toBe(3); // Updated optimistically
            expect(currentStats.weeklyQuotes).toBe(3); // 2 existing + 1 new (all within week)
            expect(currentStats.thisWeek).toBe(3); // Mirrored
            expect(currentStats.favoriteAuthor).toBe('Author A'); // Still most frequent
            expect(currentStats.loading).toBe(false); // No loading state

            // Verify events were dispatched for UI updates
            expect(document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'stats:updated'
                })
            );

            expect(document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'diary-stats:updated'
                })
            );

            // Verify API was called for silent sync
            expect(mockApi.getStats).toHaveBeenCalled();
            expect(mockApi.getQuotes).toHaveBeenCalled();
        });

        test('should handle edit quote flow changing favorite author', async () => {
            // Add more quotes for Author B to make them favorite
            const moreQuotes = [
                { id: 3, text: 'Quote 3', author: 'Author B', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
                { id: 4, text: 'Quote 4', author: 'Author B', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
            ];
            
            moreQuotes.forEach(quote => state.addQuote(quote));
            jest.clearAllMocks(); // Clear add events

            // Edit quote to change author (should affect favorite author calculation)
            const updates = { author: 'Author B' };
            state.updateQuote(1, updates);

            // Verify edit event was dispatched
            expect(document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'quotes:changed',
                    detail: { type: 'edited', quoteId: 1, updates }
                })
            );

            // Simulate StatisticsService handling the edit
            await statsService.onQuoteEdited({ quoteId: 1, updates });

            // Check that favorite author changed optimistically
            const currentStats = state.get('stats');
            expect(currentStats.favoriteAuthor).toBe('Author B'); // Now has 3 quotes vs Author A's 1
        });

        test('should handle delete quote flow reducing counts', async () => {
            const initialCount = state.get('quotes.items').length;
            
            // Delete a quote
            state.removeQuote(1);

            // Verify delete event was dispatched
            expect(document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'quotes:changed',
                    detail: { type: 'deleted', quoteId: 1 }
                })
            );

            // Verify quote was removed from state
            expect(state.get('quotes.items')).toHaveLength(initialCount - 1);

            // Simulate StatisticsService handling the deletion
            await statsService.onQuoteDeleted({ quoteId: 1 });

            // Check that counts were reduced optimistically
            const currentStats = state.get('stats');
            expect(currentStats.totalQuotes).toBe(initialCount - 1);
            expect(currentStats.loading).toBe(false);
        });
    });

    describe('Silent refresh functionality', () => {
        test('should perform silent refresh without loading states', async () => {
            // Set initial stats
            state.set('stats', { totalQuotes: 2, weeklyQuotes: 1, loading: false });

            // Perform silent refresh
            await statsService.refreshMainStatsSilent();

            // Verify no loading state was set during refresh
            const currentStats = state.get('stats');
            expect(currentStats.loading).toBe(false);
            
            // Verify stats were updated with API data but merged with existing
            expect(currentStats.totalQuotes).toBeDefined();
            expect(currentStats.weeklyQuotes).toBeDefined();
            expect(currentStats.thisWeek).toBe(currentStats.weeklyQuotes); // Mirrored

            // Verify event was dispatched
            expect(document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'stats:updated'
                })
            );
        });

        test('should handle warmup initial stats', async () => {
            // Clear any existing stats
            state.set('stats', {});
            state.set('diaryStats', {});

            // Perform warmup
            await statsService.warmupInitialStats();

            // Verify both main and diary stats were loaded
            expect(mockApi.getStats).toHaveBeenCalled();
            expect(mockApi.getActivityPercent).toHaveBeenCalled();

            // Verify stats are populated
            const mainStats = state.get('stats');
            const diaryStats = state.get('diaryStats');
            
            expect(mainStats).toBeDefined();
            expect(diaryStats).toBeDefined();
            expect(mainStats.loading).toBe(false);
            expect(diaryStats.loading).toBe(false);
        });
    });

    describe('UI compatibility', () => {
        test('should mirror weeklyQuotes to thisWeek for UI compatibility', async () => {
            await statsService.refreshMainStatsSilent();

            const stats = state.get('stats');
            expect(stats.weeklyQuotes).toBeDefined();
            expect(stats.thisWeek).toBe(stats.weeklyQuotes);
        });

        test('should preserve favoriteAuthor in both main and diary stats', async () => {
            await statsService.refreshMainStatsSilent();
            await statsService.refreshDiaryStatsSilent();

            const mainStats = state.get('stats');
            const diaryStats = state.get('diaryStats');
            
            expect(mainStats.favoriteAuthor).toBeDefined();
            expect(diaryStats.favoriteAuthor).toBeDefined();
        });
    });
});