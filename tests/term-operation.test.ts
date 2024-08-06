import { RegexSolver } from '../src';
import { Term } from '../src';
import { promises as fs } from 'fs';
import * as nock from 'nock';


describe('term operations', () => {
    beforeAll(() => {
        RegexSolver.initialize("TOKEN");
    });

    it('get details', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_getDetails.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/analyze/details')
            .reply(200, response);

        const term = Term.regex("(abc|de)");
        const details = await term.getDetails();

        expect(details.toString()).toEqual("Details[cardinality=Integer(2), length=Length[minimum=2, maximum=3], empty=false, total=false]");
    });

    it('generate strings', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_generateStrings.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/generate/strings')
            .reply(200, response);

        const term = Term.regex("(abc|de){2}");
        const strings = await term.generateStrings(10);

        expect(strings.length).toEqual(4);
    });

    it('intersection', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_intersection.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/compute/intersection')
            .reply(200, response);

        const term1 = Term.regex("(abc|de){2}");
        const term2 = Term.regex("de.*");
        const term3 = Term.regex(".*abc");

        const result = await term1.intersection(term2, term3);

        expect(result.toString()).toEqual("regex=deabc");
    });

    it('union', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_union.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/compute/union')
            .reply(200, response);

        const term1 = Term.regex("abc");
        const term2 = Term.regex("de");
        const term3 = Term.regex("fghi");

        const result = await term1.union(term2, term3);

        expect(result.toString()).toEqual("regex=(abc|de|fghi)");
    });

    it('subtraction', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_subtraction.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/compute/subtraction')
            .reply(200, response);

        const term1 = Term.regex("(abc|de)");
        const term2 = Term.regex("de");

        const result = await term1.subtraction(term2);

        expect(result.toString()).toEqual("regex=abc");
    });

    it('is equivalent to', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_isEquivalentTo.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/analyze/equivalence')
            .reply(200, response);

        const term1 = Term.regex("(abc|de)");
        const term2 = Term.fair("rgmsW[1g2LvP=Gr&V>sLc#w-!No&(oq@Sf>X).?lI3{uh{80qWEH[#0.pHq@B-9o[LpP-a#fYI+");

        const result = await term1.isEquivalentTo(term2);

        expect(result).toBe(false);
    });

    it('is subset of', async () => {
        const response = JSON.parse(await fs.readFile("tests/assets/response_isSubsetOf.json", 'utf-8'));
        nock('https://api.regexsolver.com/api/')
            .post('/analyze/subset')
            .reply(200, response);

        const term1 = Term.regex("de");
        const term2 = Term.regex("(abc|de)");

        const result = await term1.isSubsetOf(term2);

        expect(result).toBe(true);
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