/**
 * A class for parsing and writing stringified JSON data.
 */
export default class JSON {

    public static stringify(data: any): string {
        let visited = new WeakSet();

        if (data === null) {
            return "null";
        }

        if (typeof data === "string") {
            return `"${data.replace(/"/g, '\\"')}"`;
        }

        if (typeof data === "number" || typeof data === "boolean") {
            return String(data);
        }

        if (Array.isArray(data)) {
            return `[${data.map((item) => this.stringify(item) ?? "null").join(",")}]`;
        }

        if (typeof data === "object") {
            if (visited.has(data)) {
                throw new TypeError("Converting circular structure to JSON");
            }
            visited.add(data);

            const entries = Object.entries(data)
                .filter(([key, value]) => value !== undefined && typeof value !== "function" && typeof value !== "symbol")
                .map(([key, value]) => `"${key}:${this.stringify(value)}`);

            visited.delete(data);
            return `{${entries.join(",")}}`;
        }

        return "null";
    }

    public static parse(data: string): any {
        let index = 0;
        const length = data.length;

        function parseValue(): any {
            skipWhitespace();
            let char: string = data[index]!;

            if (char === '"') {
                return parseString();
            }
            if (char === "{") {
                return parseObject();
            }
            if (char === "[") {
                return parseArray();
            }
            if (char === "-" || isDigit(char)) {
                return parseNumber();
            }
            if (data.startsWith("true", index)) {
                return consumeLiteral("true", true);
            }
            if (data.startsWith("false", index)) {
                return consumeLiteral("false", false);
            }
            if (data.startsWith("null", index)) {
                return consumeLiteral("null", null);
            }

            throw new SyntaxError(`Unexpected token '${char}' at position ${index}`);
        }

        function parseObject(): object {
            let result: Record<string, any> = {};
            index++;
            skipWhitespace();

            if (data[index] === "}") {
                index++;
                return result;
            }

            while (index < length) {
                skipWhitespace();

                if (data[index] !== '"') {
                    throw new SyntaxError(`Expected string at position ${index}`);
                }
                let key = parseString();
                skipWhitespace();

                if (data[index] !== ":") {
                    throw new SyntaxError(`Expected ':' after key at position ${index}`);
                }
                index++;
                let value = parseValue();
                result[key] = value;
                skipWhitespace();

                if (data[index] === "}") {
                    index++;
                    return result;
                }

                if (data[index] !== ",") {
                    throw new SyntaxError(`Expected ',' or '}' at position ${index}`);
                }
                index++;
            }
            throw new SyntaxError(`Unterminated object at position ${index}`);
        }

        function parseArray(): any[] {
            let result: any[] = [];
            index++;
            skipWhitespace();

            if (data[index] === "]") {
                index++;
                return result;
            }

            while (index < length) {
                let value = parseValue();
                result.push(value);
                skipWhitespace();

                if (data[index] === "]") {
                    index++;
                    return result;
                }

                if (data[index] !== ",") {
                    throw new SyntaxError(`Expected ',' or ']' at position ${index}`);
                }
                index++;
            }
            throw new SyntaxError(`Unterminated array at position ${index}`);
        }

        function parseString(): string {
            let result = "";
            index++;

            while (index < length) {
                let char: string = data[index]!;

                if (char === '"') {
                    index++;
                    return result;
                }

                if (char === "\\") {
                    index++;
                    let escapeChar = data[index]!;
                    result += parseEscapeCharacter(escapeChar);
                } else {
                    result += char;
                }
                index++;
            }
            throw new SyntaxError(`Unterminated string at position ${index}`);
        }

        function parseNumber(): number {
            let start = index;

            if (data[index] === "-") {
                index++;
            }

            while (isDigit(data[index]!)) {
                index++;
            }

            if (data[index] === ".") {
                index++;
                if (!isDigit(data[index]!)) {
                    throw new SyntaxError(`Unexpected token '${data[index]}' after decimal point at position ${index}`);
                }

                while (isDigit(data[index]!)) {
                    index++;
                }
            }

            if (data[index] === "e" || data[index] === "E") {
                index++;
                if (data[index] === "+" || data[index] === "-") {
                    index++;
                }

                if (!isDigit(data[index]!)) {
                    throw new SyntaxError(`Unexpected token '${data[index]}' after exponent at position ${index}`);
                }

                while (isDigit(data[index]!)) {
                    index++;
                }
            }
            return parseFloat(data.slice(start, index));
        }

        function consumeLiteral(literal: string, value: any): any {
            if (data.slice(index, index + literal.length) === literal) {
                index += literal.length;
                return value;
            }
            throw new SyntaxError(`Unexpected token '${data[index]}' at position ${index}`);
        }

        function skipWhitespace() {
            while (index < length && /\s/.test(data[index]!)) {
                index++;
            }
        }

        function parseEscapeCharacter(char: string): string {
            const escapes: Record<string, string> = {
                '"': '"',
                "\\": "\\",
                "/": "/",
                b: "\b",
                f: "\f",
                n: "\n",
                r: "\r",
                t: "\t"
            };

            if (char in escapes) {
                return escapes[char]!;
            }

            if (char === "u") {
                let hex = data.slice(index + 1, index + 5);

                if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                    index += 4;
                    return String.fromCharCode(parseInt(hex, 16));
                }
                throw new SyntaxError(`Invalid unicode escape at position ${index}`);
            }
            throw new SyntaxError(`Invalid escape character at position ${index}`);
        }

        function isDigit(char: string): boolean {
            return char >= "0" && char <= "9";
        }

        skipWhitespace();
        let result = parseValue();
        skipWhitespace();

        if (index < length) {
            throw new SyntaxError(`Unexpected token '${data[index]}' at position ${index}`);
        }
        return result;
    }
}