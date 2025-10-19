export class Cardinality {
    constructor(
        public type: 'infinite' | 'bigInteger' | 'integer',
        public value?: number
    ) { }

    isInfinite(): boolean {
        return this.type == 'infinite';
    }

    toString(): string {
        const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : s;
        if (this.type == 'integer') {
            return cap1(this.type) + '(' + this.value + ')';
        } else {
            return cap1(this.type);
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