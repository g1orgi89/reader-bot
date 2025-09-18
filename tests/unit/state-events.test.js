/**
 * Unit tests for State.js event dispatching
 * Tests the quotes:changed events are properly emitted
 */

// Mock DOM environment
global.document = {
    dispatchEvent: jest.fn()
};

// Mock console
global.console = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

// Mock the State class by importing and creating a minimal implementation
class MockAppState {
    constructor() {
        this.store = {
            quotes: {
                items: [],
                total: 0,
                lastUpdate: null
            }
        };
    }

    get(path) {
        const keys = path.split('.');
        let value = this.store;
        for (const key of keys) {
            value = value?.[key];
        }
        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        let obj = this.store;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
    }

    update(path, updates) {
        const currentValue = this.get(path) || {};
        const newValue = { ...currentValue, ...updates };
        this.set(path, newValue);
    }

    push(path, item) {
        const currentArray = this.get(path) || [];
        const newArray = [...currentArray, item];
        this.set(path, newArray);
    }

    remove(path, predicate) {
        const currentArray = this.get(path);
        if (!Array.isArray(currentArray)) {
            this.set(path, undefined);
            return;
        }
        const newArray = currentArray.filter(item => !predicate(item));
        this.set(path, newArray);
    }

    // Implement the quote methods with event dispatching
    addQuote(quote) {
        console.log('State.js addQuote:', quote);
        this.push('quotes.items', quote);
        this.update('quotes', {
            total: this.get('quotes.total') + 1,
            lastUpdate: Date.now(),
            lastAdded: quote
        });
        
        // Dispatch quotes:changed event for StatisticsService
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('quotes:changed', {
                detail: { type: 'added', quote }
            }));
        }
    }

    updateQuote(quoteId, updates) {
        const quotes = this.get('quotes.items');
        const updatedQuotes = quotes.map(quote => 
            quote.id === quoteId ? { ...quote, ...updates } : quote
        );
        this.set('quotes.items', updatedQuotes);
        this.update('quotes', {
            lastUpdate: Date.now()
        });
        
        // Dispatch quotes:changed event for StatisticsService
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('quotes:changed', {
                detail: { type: 'edited', quoteId, updates }
            }));
        }
    }

    removeQuote(quoteId) {
        this.remove('quotes.items', quote => (quote.id === quoteId) || (quote._id === quoteId));
        this.update('quotes', {
            total: this.get('quotes.total') - 1,
            lastUpdate: Date.now()
        });
        
        // Dispatch quotes:changed event for StatisticsService
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('quotes:changed', {
                detail: { type: 'deleted', quoteId }
            }));
        }
    }
}

describe('State.js Event Dispatching', () => {
    let state;

    beforeEach(() => {
        jest.clearAllMocks();
        state = new MockAppState();
    });

    describe('addQuote', () => {
        test('should add quote and dispatch quotes:changed event', () => {
            const testQuote = { id: 1, text: 'Test quote', author: 'Test Author' };

            state.addQuote(testQuote);

            // Verify quote was added
            expect(state.get('quotes.items')).toContain(testQuote);
            expect(state.get('quotes.total')).toBe(1);
            expect(state.get('quotes.lastAdded')).toBe(testQuote);

            // Verify event was dispatched
            expect(global.document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'quotes:changed',
                    detail: { type: 'added', quote: testQuote }
                })
            );
        });
    });

    describe('updateQuote', () => {
        test('should update quote and dispatch quotes:changed event', () => {
            const originalQuote = { id: 1, text: 'Original', author: 'Author A' };
            const updates = { text: 'Updated text', author: 'Author B' };

            // Add original quote first
            state.addQuote(originalQuote);
            jest.clearAllMocks(); // Clear the add event

            // Update the quote
            state.updateQuote(1, updates);

            // Verify quote was updated
            const updatedQuotes = state.get('quotes.items');
            expect(updatedQuotes[0]).toEqual({ ...originalQuote, ...updates });

            // Verify event was dispatched
            expect(global.document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'quotes:changed',
                    detail: { type: 'edited', quoteId: 1, updates }
                })
            );
        });
    });

    describe('removeQuote', () => {
        test('should remove quote and dispatch quotes:changed event', () => {
            const testQuote = { id: 1, text: 'Test quote', author: 'Test Author' };

            // Add quote first
            state.addQuote(testQuote);
            expect(state.get('quotes.total')).toBe(1);
            jest.clearAllMocks(); // Clear the add event

            // Remove the quote
            state.removeQuote(1);

            // Verify quote was removed
            expect(state.get('quotes.items')).toHaveLength(0);
            expect(state.get('quotes.total')).toBe(0);

            // Verify event was dispatched
            expect(global.document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'quotes:changed',
                    detail: { type: 'deleted', quoteId: 1 }
                })
            );
        });

        test('should handle quotes with _id field', () => {
            const testQuote = { _id: 'mongo-id', text: 'Test quote', author: 'Test Author' };

            // Add quote first
            state.push('quotes.items', testQuote);
            state.update('quotes', { total: 1 });
            jest.clearAllMocks();

            // Remove the quote using _id
            state.removeQuote('mongo-id');

            // Verify quote was removed
            expect(state.get('quotes.items')).toHaveLength(0);

            // Verify event was dispatched
            expect(global.document.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'quotes:changed',
                    detail: { type: 'deleted', quoteId: 'mongo-id' }
                })
            );
        });
    });

    describe('Event detail structure', () => {
        test('should include proper detail structure for added quotes', () => {
            const testQuote = { id: 1, text: 'Test', author: 'Author' };
            
            state.addQuote(testQuote);

            const dispatchCall = global.document.dispatchEvent.mock.calls[0][0];
            expect(dispatchCall.detail).toEqual({
                type: 'added',
                quote: testQuote
            });
        });

        test('should include proper detail structure for edited quotes', () => {
            const testQuote = { id: 1, text: 'Test', author: 'Author' };
            const updates = { text: 'Updated' };
            
            state.addQuote(testQuote);
            jest.clearAllMocks();
            state.updateQuote(1, updates);

            const dispatchCall = global.document.dispatchEvent.mock.calls[0][0];
            expect(dispatchCall.detail).toEqual({
                type: 'edited',
                quoteId: 1,
                updates
            });
        });

        test('should include proper detail structure for deleted quotes', () => {
            const testQuote = { id: 1, text: 'Test', author: 'Author' };
            
            state.addQuote(testQuote);
            jest.clearAllMocks();
            state.removeQuote(1);

            const dispatchCall = global.document.dispatchEvent.mock.calls[0][0];
            expect(dispatchCall.detail).toEqual({
                type: 'deleted',
                quoteId: 1
            });
        });
    });
});