import { ApiError, RegexSolver, ResponseFormat, Term } from '../src/index';

describe('integration test', () => {
    beforeAll(() => {
        require('dotenv').config();
        RegexSolver.initialize();
    });

    // Analyze

    it('analyze cardinality', async () => {
        const term = Term.regex('[0-4]');
        const c = await term.getCardinality();
        expect(c.toString()).toEqual('Integer(5)');
    });

    it('analyze details', async () => {
        const term = Term.regex('(abc|de)');
        const details = await term.getDetails();
        expect(details.toString()).toEqual(
            'Details[cardinality=Integer(2), length=Length[minimum=2, maximum=3], empty=false, total=false]'
        );
    });

    it('analyze details infinite', async () => {
        const term = Term.regex('.*');
        const details = await term.getDetails();
        expect(details.toString()).toEqual(
            'Details[cardinality=Infinite, length=Length[minimum=0, maximum=null], empty=false, total=true]'
        );
    });

    it('analyze details empty', async () => {
        const term = Term.regex('[]');
        const details = await term.getDetails();
        expect(details.toString()).toEqual(
            'Details[cardinality=Integer(0), length=Length[minimum=null, maximum=null], empty=true, total=false]'
        );
    });

    it('analyze dot', async () => {
        const term = Term.regex('(abc|de)');
        const dot = await term.getDot();
        expect(dot.startsWith('digraph ')).toBe(true);
    });

    it('analyze empty string', async () => {
        const term = Term.regex('');
        const result = await term.isEmptyString();
        expect(result).toBe(true);
    });

    it('analyze empty', async () => {
        const term = Term.regex('[]');
        const result = await term.isEmpty();
        expect(result).toBe(true);
    });

    it('analyze total', async () => {
        const term = Term.regex('.*');
        const result = await term.isTotal();
        expect(result).toBe(true);
    });

    it('analyze equivalent', async () => {
        const term1 = Term.regex('(abc|de)');
        const term2 = Term.fair('<uw$8AJYkaU].HFn1kT[tx*-VAZ8usSKXcEKZ[wx:F8vYuR-b?tFFk1eM2RXs9yuu5dakz7r/{!AW9/(hK0]knHS&Q]!@K=ahmGr1Dbjb5(XE1UT%Ab@8rXvYop}$');
        const result = await term1.equivalent(term2);
        expect(result).toBe(false);
    });

    it('analyze length empty', async () => {
        const term = Term.regex('[]');
        const length = await term.getLength();
        expect(length.toString()).toEqual('Length[minimum=null, maximum=null]');
    });

    it('analyze length', async () => {
        const term = Term.regex('(abc)?');
        const length = await term.getLength();
        expect(length.toString()).toEqual('Length[minimum=0, maximum=3]');
    });

    it('analyze pattern', async () => {
        const term = Term.regex('abc.*');
        const pattern = await term.getPattern();
        expect(pattern).toEqual('abc.*');
    });

    it('analyze subset', async () => {
        const term1 = Term.regex('de');
        const term2 = Term.regex('(abc|de)');
        const result = await term1.subset(term2);
        expect(result).toBe(true);
    });

    // Compute

    it('compute concat', async () => {
        const term1 = Term.regex('abc');
        const term2 = Term.regex('de');
        const result = await term1.concat(term2, { responseFormat: ResponseFormat.REGEX });
        expect(result.toString()).toEqual('regex=abcde');
    });

    it('compute difference', async () => {
        const term1 = Term.regex('(abc|de)');
        const term2 = Term.regex('de');
        const result = await term1.difference(term2, { responseFormat: ResponseFormat.REGEX });
        expect(result.toString()).toEqual('regex=abc');
    });

    it('compute intersection', async () => {
        const term1 = Term.regex('(abc|de){2}');
        const term2 = Term.regex('de.*');
        const term3 = Term.regex('.*abc');
        const result = await term1.intersection(term2, term3, { responseFormat: ResponseFormat.REGEX });
        expect(result.toString()).toEqual('regex=deabc');
    });

    it('compute repeat', async () => {
        const term = Term.regex('abc');
        const result = await term.repeat(3, 5, { responseFormat: ResponseFormat.REGEX });
        expect(result.toString()).toEqual('regex=(abc){3,5}');
    });

    it('compute union', async () => {
        const term1 = Term.regex('abc');
        const term2 = Term.regex('de');
        const term3 = Term.regex('fghi');
        const result = await term1.union(term2, term3, { responseFormat: ResponseFormat.REGEX });
        expect(result.toString()).toEqual('regex=(abc|de|fghi)');
    });

    // Generate

    it('generate strings', async () => {
        const term = Term.regex('(abc|de){2}');
        const strings = await term.generateStrings(10);
        expect(strings.length).toEqual(4);
    });

    // README examples

    it('readme quickstart', () => {
        const term1 = Term.regex("(abc|de|fg){2,}");
        const term2 = Term.regex("de.*");
        const term3 = Term.regex(".*abc");

        const term4 = Term.regex(".+(abc|de).+");

        term1.intersection(term2, term3)
            .then(result => result.difference(term4))
            .then(result => result.getPattern())
            .then(result => expect(result).toEqual('de(fg)*abc')); // de(fg)*abc
    });

    it('readme response format', () => {
        const term = Term.regex('abcde');

        term.union(Term.regex('de'), { responseFormat: ResponseFormat.REGEX }).then(result => {
            expect(result.toString()).toEqual('regex=(abc)?de');
        });

        term.intersection(Term.regex('de.*'), { responseFormat: ResponseFormat.FAIR }).then(result => {
            expect(result.toString().startsWith("fair=")).toBeTruthy();
        });
    });
});