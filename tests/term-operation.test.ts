import { RegexSolver } from '../src';
import { Term } from '../src';
import { promises as fs } from 'fs';
import * as nock from 'nock';


describe('term operations', () => {
    beforeAll(() => {
        RegexSolver.initialize("TOKEN");
    });

    it('error response correctly handled', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_error.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/compute/intersection')
            .reply(200, response);

        const term1 = Term.regex("abc");
        const term2 = Term.regex("de");

        try {
            await term1.intersection(term2);
        } catch (error) {
            expect(error.message).toEqual("The API returned the following error: A random error.");
        }
    });
});