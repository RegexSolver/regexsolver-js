import {Term} from '../src/index';

describe('term serialization', () => {
    function assertSerialization(term: Term) {
        const serialized = term.serialize()
        const deserialized = Term.deserialize(serialized)

        expect(deserialized).toEqual(term);
    }

    it('serialize and deserialize term correctly', () => {
        assertSerialization(Term.regex(".*"));
        assertSerialization(Term.regex(""));

        assertSerialization(Term.fair("rgmsW[1g2LvP=Gr&V>sLc#w-!No&(opHq@B-9o[LpP-a#fYI+"));
        assertSerialization(Term.fair(""));
    });
});