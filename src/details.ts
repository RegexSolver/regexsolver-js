export class Cardinality {
    constructor(
        public type: 'Infinite' | 'BigInteger' | 'Integer',
        public value?: number
    ) { }

    isInfinite(): boolean {
        return this.type == 'Infinite';
    }

    toString(): string {
        if (this.type == 'Integer') {
            return this.type + '(' + this.value + ')';
        } else {
            return this.type;
        }
    }
}

export class Length {
    constructor(
        public minimum: number,
        public maximum?: number
    ) { }

    toString(): string {
        return "Length[minimum=" + this.minimum + ", maximum=" + this.maximum + "]";
    }
}

export class Details {
    constructor(
        public cardinality: Cardinality,
        public length: Length,
        public empty: boolean,
        public total: boolean
    ) { }

    toString(): string {
        return "Details[cardinality=" + this.cardinality + ", length=" + this.length + ", empty=" + this.empty + ", total=" + this.total + "]";
    }
}