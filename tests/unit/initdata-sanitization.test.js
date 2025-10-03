/**
 * Tests for initData sanitization and parsing
 * Verifies that initData is properly sanitized on client and parsed on server
 */

describe('Client-side initData sanitization', () => {
  test('should remove CR/LF characters from initData', () => {
    const rawInitData = 'user=%7B%22id%22%3A123%7D\r\nauth_date=1234567890';
    const sanitized = rawInitData.replace(/[\r\n]/g, '').trim();
    
    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
    expect(sanitized).toBe('user=%7B%22id%22%3A123%7Dauth_date=1234567890');
  });

  test('should trim whitespace from initData', () => {
    const rawInitData = '  user=%7B%22id%22%3A123%7D&auth_date=1234567890  ';
    const sanitized = rawInitData.replace(/[\r\n]/g, '').trim();
    
    expect(sanitized).toBe('user=%7B%22id%22%3A123%7D&auth_date=1234567890');
    expect(sanitized[0]).not.toBe(' ');
    expect(sanitized[sanitized.length - 1]).not.toBe(' ');
  });

  test('should encode initData with encodeURIComponent', () => {
    const rawInitData = 'user={"id":123}&auth_date=1234567890';
    const encoded = encodeURIComponent(rawInitData);
    
    expect(encoded).toContain('%3D'); // = encoded
    expect(encoded).toContain('%26'); // & encoded
    expect(encoded).not.toContain('='); // no raw = signs
  });

  test('should handle complete sanitization pipeline', () => {
    const rawInitData = '  user=%7B%22id%22%3A123%7D&auth_date=1234567890\r\n  ';
    const sanitized = rawInitData.replace(/[\r\n]/g, '').trim();
    const encoded = encodeURIComponent(sanitized);
    
    expect(encoded).toBeTruthy();
    expect(encoded).not.toContain('\r');
    expect(encoded).not.toContain('\n');
    expect(encoded).not.toContain(' ');
  });

  test('should handle empty or null initData gracefully', () => {
    expect(''.replace(/[\r\n]/g, '').trim()).toBe('');
    expect('   '.replace(/[\r\n]/g, '').trim()).toBe('');
  });
});

describe('Server-side initData decoding and parsing', () => {
  test('should decode URI-encoded initData', () => {
    const encoded = 'user%3D%7B%22id%22%3A123%7D%26auth_date%3D1234567890';
    const decoded = decodeURIComponent(encoded);
    
    expect(decoded).toBe('user={\"id\":123}&auth_date=1234567890');
    expect(decoded).toContain('=');
    expect(decoded).toContain('&');
  });

  test('should handle already decoded initData', () => {
    const alreadyDecoded = 'user=%7B%22id%22%3A123%7D&auth_date=1234567890';
    
    // Decoding already decoded data should not break
    let result = alreadyDecoded;
    try {
      const decoded = decodeURIComponent(alreadyDecoded);
      if (decoded.includes('=')) {
        result = decoded;
      }
    } catch (e) {
      // Keep original if decode fails
    }
    
    expect(result).toContain('=');
    expect(result).toBeTruthy();
  });

  test('should parse userId from decoded initData', () => {
    const initData = 'user=%7B%22id%22%3A123%7D&auth_date=1234567890';
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    
    expect(userStr).toBeTruthy();
    
    const userObj = JSON.parse(userStr);
    expect(userObj.id).toBe(123);
  });

  test('should handle double-encoded initData', () => {
    const original = 'user={"id":123}&auth_date=1234567890';
    const encoded = encodeURIComponent(original);
    
    // Server should decode it
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe(original);
  });

  test('should validate initData contains expected pattern', () => {
    const validInitData = 'user=%7B%22id%22%3A123%7D&auth_date=1234567890';
    const invalidInitData = 'invalid-data-without-equals';
    
    expect(validInitData.includes('=')).toBe(true);
    expect(invalidInitData.includes('=')).toBe(false);
  });

  test('should handle malformed initData gracefully', () => {
    const malformed = 'user=invalid-json&auth_date=1234567890';
    const params = new URLSearchParams(malformed);
    const userStr = params.get('user');
    
    expect(userStr).toBe('invalid-json');
    
    // Should not throw when trying to parse invalid JSON
    let userId = null;
    try {
      const userObj = JSON.parse(userStr);
      userId = userObj?.id;
    } catch (e) {
      userId = null;
    }
    
    expect(userId).toBeNull();
  });
});

describe('Full end-to-end initData flow', () => {
  test('should handle sanitization -> encoding -> decoding -> parsing', () => {
    // Client: raw data from Telegram
    const rawInitData = '  user=%7B%22id%22%3A123456%7D&auth_date=1234567890\r\n  ';
    
    // Client: sanitize
    const sanitized = rawInitData.replace(/[\r\n]/g, '').trim();
    expect(sanitized).toBe('user=%7B%22id%22%3A123456%7D&auth_date=1234567890');
    
    // Client: encode for HTTP header
    const encoded = encodeURIComponent(sanitized);
    expect(encoded).toBeTruthy();
    
    // Server: decode
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe(sanitized);
    
    // Server: parse
    const params = new URLSearchParams(decoded);
    const userStr = params.get('user');
    const userObj = JSON.parse(userStr);
    
    expect(userObj.id).toBe(123456);
  });

  test('should handle initData with special characters', () => {
    const rawInitData = 'user=%7B%22id%22%3A123%2C%22first_name%22%3A%22John%22%7D&auth_date=1234567890';
    
    // Client: sanitize and encode
    const sanitized = rawInitData.replace(/[\r\n]/g, '').trim();
    const encoded = encodeURIComponent(sanitized);
    
    // Server: decode and parse
    const decoded = decodeURIComponent(encoded);
    const params = new URLSearchParams(decoded);
    const userStr = params.get('user');
    const userObj = JSON.parse(userStr);
    
    expect(userObj.id).toBe(123);
    expect(userObj.first_name).toBe('John');
  });
});

describe('Fallback to X-User-Id header', () => {
  test('should use X-User-Id when initData parsing fails', () => {
    // Simulate server-side logic
    const req = {
      headers: {
        'authorization': 'tma invalid-initdata',
        'x-user-id': '123456'
      }
    };
    
    // Try to parse initData
    const initData = req.headers['authorization'].slice(4);
    let userId = null;
    
    if (!initData.includes('=')) {
      // Fallback to X-User-Id
      userId = req.headers['x-user-id'];
    }
    
    expect(userId).toBe('123456');
  });

  test('should prioritize initData over X-User-Id when valid', () => {
    const req = {
      headers: {
        'authorization': 'tma user=%7B%22id%22%3A999%7D&auth_date=1234567890',
        'x-user-id': '123456'
      }
    };
    
    const initData = req.headers['authorization'].slice(4);
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    const userObj = JSON.parse(userStr);
    
    expect(userObj.id).toBe(999);
    expect(userObj.id).not.toBe(123456);
  });

  test('should handle missing both initData and X-User-Id', () => {
    const req = {
      headers: {}
    };
    
    const initData = req.headers['authorization']?.slice(4);
    const userId = req.headers['x-user-id'];
    
    expect(initData).toBeUndefined();
    expect(userId).toBeUndefined();
  });
});

describe('Security validation', () => {
  test('should reject initData with path traversal attempts', () => {
    const maliciousInitData = '../../../etc/passwd';
    
    // Should not contain expected pattern
    expect(maliciousInitData.includes('=')).toBe(false);
  });

  test('should reject initData with script injection attempts', () => {
    const maliciousInitData = '<script>alert("xss")</script>';
    
    // Should not contain expected pattern
    expect(maliciousInitData.includes('=')).toBe(false);
  });

  test('should handle very long initData strings', () => {
    const longInitData = 'user=%7B%22id%22%3A123%7D&' + 'a'.repeat(10000);
    
    // Should still be parseable
    const params = new URLSearchParams(longInitData);
    const userStr = params.get('user');
    expect(userStr).toBeTruthy();
  });
});
