import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RegexSolverClient } from '../src/RegexSolverClient';
import { Term } from '../src/models/Term';
import * as Exceptions from '../src/exceptions';

describe('RegexSolverClient', () => {
    let mock: any;
    let client: RegexSolverClient;

    beforeEach(() => {
        mock = new MockAdapter(axios);
        client = new RegexSolverClient({ apiToken: 'test-token' });
    });

    afterEach(() => {
        mock.restore();
    });

    test('getCardinality should work', async () => {
        mock.onPost('/analyze/cardinality').reply(200, {
            success: true,
            data: { type: 'integer', value: 26 }
        });

        const term = Term.regex('[a-z]');
        const cardinality = await client.getCardinality(term);
        
        expect(cardinality.isInteger()).toBe(true);
        expect(cardinality.value).toBe(26);
        expect(term.cardinality).toBe(cardinality);
    });

    test('getLength should work', async () => {
        mock.onPost('/analyze/length').reply(200, {
            success: true,
            data: { type: 'length', min: 1, max: 4 }
        });

        const term = Term.regex('(abc)?d');
        const length = await client.getLength(term);
        
        expect(length.min).toBe(1);
        expect(length.max).toBe(4);
        expect(term.length).toBe(length);
    });

    test('error mapping should work for 400 Bad Request', async () => {
        mock.onPost('/analyze/cardinality').reply(400, {
            success: false,
            error: 'Invalid JSON body',
            errorCode: 'InvalidJson'
        });

        const term = Term.regex('[a-z]');
        await expect(client.getCardinality(term)).rejects.toThrow(Exceptions.InvalidJson);
    });

    test('rate limit with retry-after should work and block concurrent requests', async () => {
        // First call 429
        mock.onPost('/analyze/cardinality').replyOnce(429, {
            success: false,
            error: 'Too many requests',
            errorCode: 'RateLimitExceeded'
        }, { 'retry-after': '0.1' });

        // Second call 200
        mock.onPost('/analyze/cardinality').reply(200, {
            success: true,
            data: { type: 'integer', value: 26 }
        });

        const start = Date.now();
        const term = Term.regex('[a-z]');
        
        // Parallel calls
        const p1 = client.getCardinality(term);
        const p2 = client.getCardinality(term);
        
        const [c1, c2] = await Promise.all([p1, p2]);
        const duration = Date.now() - start;

        expect(c1.value).toBe(26);
        expect(c2.value).toBe(26);
        expect(duration).toBeGreaterThanOrEqual(100);
    });

    test('error mapping for 401 Unauthorized - Invalid Token', async () => {
        mock.onPost('/analyze/cardinality').reply(401, {
            success: false,
            error: 'Invalid token',
            errorCode: 'InvalidToken'
        });

        await expect(client.getCardinality(Term.regex('abc'))).rejects.toThrow(Exceptions.InvalidToken);
    });

    test('error mapping for 403 Forbidden - Quota Exceeded', async () => {
        mock.onPost('/analyze/cardinality').reply(403, {
            success: false,
            error: 'Quota exceeded',
            errorCode: 'QuotaExceeded'
        });

        await expect(client.getCardinality(Term.regex('abc'))).rejects.toThrow(Exceptions.QuotaExceeded);
    });

    test('error mapping for 500 Internal Server Error', async () => {
        mock.onPost('/analyze/cardinality').reply(500, {
            success: false,
            error: 'Internal server error'
        });

        await expect(client.getCardinality(Term.regex('abc'))).rejects.toThrow(Exceptions.InternalServerError);
    });

    test('isEmpty should work', async () => {
        mock.onPost('/analyze/empty').reply(200, {
            success: true,
            data: { value: true }
        });

        const term = Term.regex('[]');
        const emptyValue = await client.isEmpty(term);
        expect(emptyValue).toBe(true);
        expect(term.empty).toBe(true);
    });

    test('intersection should work', async () => {
        mock.onPost('/compute/intersection').reply(200, {
            success: true,
            data: { type: 'regex', value: 'a' }
        });

        const t1 = Term.regex('a');
        const t2 = Term.regex('ab');
        const result = await client.intersection([t1, t2]);
        expect(result.value).toBe('a');
    });
});
