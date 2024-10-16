import { CharSets } from "./charsets.js"

/**
 * A class for encoding and decoding strings to and from byte arrays.
 */
export default class Encoder {
    #charSet

    /**
     * @param {CharSets} charSet
     */
    constructor(charSet = CharSets.UTF8) {
        if (Object.values(CharSets).includes(charSet)) {
            this.#charSet = charSet;
        } else {
            throw new Error(`"${charSet}" Is not a vaild CharSet.`);
        }
    }

    /**
     * Returns the current CharSet of this Encoder.
     *
     * @returns {CharSets} The charSet
     */
    getCharSet() {
        return this.#charSet;
    }

    /**
     * Encodes a string to a byte array in the selected CharSet.
     *
     * @param {string} string
     * @returns {number[]} The encoded string as a byte array.
     */
    encode(string, littleEndian = false) {
        switch (this.#charSet) {
            case "utf8":
                return encodeUTF8(string);
            case "utf16":
                return encodeUTF16(string, littleEndian);
        }
    }

    /**
     * Decodes a byte array to a string in the selected CharSet.
     *
     * @param {number[]} bytes
     * @returns {string} The decoded byte array as a string.
     */
    decode(bytes, littleEndian = false) {
        switch (this.#charSet) {
            case "utf8":
                return decodeUTF8(bytes);
            case "utf16":
                return decodeUTF16(bytes, littleEndian);
        }
    }
}

////////////////////////////////////////
////////// Encoding Functions //////////
////////////////////////////////////////

/**
 * @param {string} str
 * @returns {number[]}
 */
function encodeUTF8(str) {
    /** @type {number[]} */
    let bytes = [];

    for (let i = 0; i < str.length; i++) {
        /** @type {number} */
        let codePoint = /** @type {number} */ (str.codePointAt(i));

        // Skip surrogate pairs
        if (codePoint > 0xFFFF) {
            i++;
        }

        // 1 byte character
        if (codePoint <= 0x7F) {
            bytes.push(codePoint);
            continue;
        }

        // 2 byte character
        if (codePoint <= 0x7FF) {
            bytes.push(0xC0 | (codePoint >> 6));
            bytes.push(0x80 | (codePoint & 0x3F));
            continue;
        }

        // 3 byte character
        if (codePoint <= 0xFFFF) {
            bytes.push(0xE0 | (codePoint >> 12));
            bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
            bytes.push(0x80 | (codePoint & 0x3F));
            continue;
        }

        // 4 byte character
        bytes.push(0xF0 | (codePoint >> 18));
        bytes.push(0x80 | ((codePoint >> 12) & 0x3F));
        bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
        bytes.push(0x80 | (codePoint & 0x3F));
    }

    // Add prefixed 2 byte length
    /** @type {number[]} */
    let result = concatArray(numberToBytes(bytes.length, 2), bytes);

    return result;
}

/**
 * @param {string} str
 * @param {boolean} littleEndian
 * @returns {number[]}
 */
function encodeUTF16(str, littleEndian = false) {
    /** @type {number[]} */
    let bytes = [];

    for (let i = 0; i < str.length; i++) {
        /** @type {number} */
        let codePoint = /** @type {number} */ (str.codePointAt(i));

        if (codePoint > 0xFFFF) {
            codePoint -= 0x10000;
            /** @type {number} */
            let highSurrogate;
            /** @type {number} */
            let lowSurrogate;

            if (littleEndian) {
                highSurrogate = (codePoint >> 10) | 0xD800;
                lowSurrogate = (codePoint & 0x3FF) | 0xDC00;
            } else {
                highSurrogate = 0xD800 | (codePoint >> 10);
                lowSurrogate = 0xDC00 | (codePoint & 0x3FF);
            }

            if (littleEndian) {
                bytes.push(highSurrogate & 0xFF, highSurrogate >> 8);
                bytes.push(lowSurrogate & 0xFF, lowSurrogate >> 8);
            } else {
                bytes.push(highSurrogate >> 8, highSurrogate & 0xFF);
                bytes.push(lowSurrogate >> 8, lowSurrogate & 0xFF);
            }
            continue;
        }

        if (littleEndian) {
            bytes.push(codePoint & 0xFF, codePoint >> 8);
        } else {
            bytes.push(codePoint >> 8, codePoint & 0xFF);
        }
    }

    // Add prefixed 2 byte length
    /** @type {number[]} */
    let result = concatArray(numberToBytes(bytes.length, 2, littleEndian), bytes);

    return result;
}

////////////////////////////////////////
////////// Decoding Functions //////////
////////////////////////////////////////

/**
 * @param {number[]} bytes
 * @returns {string}
 */
function decodeUTF8(bytes) {
    /** @type {string} */
    let str = "";

    for (let i = 0; i < bytes.length; i++) {
        /** @type {number} */
        let byte = /** @type {number} */ (bytes[i]);

        // 1 byte character
        if (byte <= 0x7F) {
            str += String.fromCodePoint(byte);
            continue;
        }

        // 2 byte character
        if ((byte & 0xE0) === 0xC0) {
            /** @type {number} */
            let byte1 = byte & 0x1F;
            /** @type {number} */
            let byte2 = /** @type {number} */ (bytes[++i]);
            /** @type {number} */
            let codePoint = (byte1 << 6) | byte2;

            str += String.fromCodePoint(codePoint);
            continue;
        }

        // 3 byte character
        if ((byte & 0xF0) === 0xE0) {
            /** @type {number} */
            let byte1 = byte & 0x0F;
            /** @type {number} */
            let byte2 = /** @type {number} */ (bytes[++i]);
            /** @type {number} */
            let byte3 = /** @type {number} */ (bytes[++i]);
            /** @type {number} */
            let codePoint = (byte1 << 12) | (byte2 << 6) | byte3;

            str += String.fromCodePoint(codePoint);
            continue;
        }

        // 4 byte character
        if ((byte & 0xF8) === 0xF0) {
            /** @type {number} */
            let byte1 = byte & 0x07;
            /** @type {number} */
            let byte2 = /** @type {number} */ (bytes[++i]);
            /** @type {number} */
            let byte3 = /** @type {number} */ (bytes[++i]);
            /** @type {number} */
            let byte4 = /** @type {number} */ (bytes[++i]);
            /** @type {number} */
            let codePoint = (byte1 << 18) | (byte2 << 12) | (byte3 << 6) | byte4;

            str += String.fromCodePoint(codePoint);
            continue;
        }
    }

    return str;
}

/**
 * @param {number[]} bytes
 * @param {boolean} littleEndian
 * @returns {string}
 */
function decodeUTF16(bytes, littleEndian = false) {
    /** @type {string} */
    let str = "";

    for (let i = 0; i < bytes.length; i += 2) {
        /** @type {number} */
        let value = littleEndian
            ? /** @type {number} */ (bytes[i]) | (/** @type {number} */ (bytes[i + 1]) << 8)
            : (/** @type {number} */ (bytes[i]) << 8) | /** @type {number} */ (bytes[i + 1]);

        if (value >= 0xD800 && value <= 0xDFFF) {
            /** @type {number} */
            let highSurrogate = value;
            i += 2;

            /** @type {number} */
            let lowSurrogate = littleEndian
                ? /** @type {number} */ (bytes[i + 1]) | (/** @type {number} */ (bytes[i]) << 8)
                : (/** @type {number} */ (bytes[i]) << 8) | /** @type {number} */ (bytes[i + 1]);

                /** @type {number} */
            let codePoint = littleEndian
                ? 0x10000 + (lowSurrogate & 0xDC00) | ((highSurrogate & 0xD800) << 10)
                : 0x10000 + ((highSurrogate & 0xD800) << 10) | (lowSurrogate & 0xDC00);

            str += String.fromCodePoint(codePoint);
            continue;
        }

        str += String.fromCodePoint(value);
    }

    return str;
}

//////////////////////////////////////
////////// Helper Functions //////////
//////////////////////////////////////

/**
 * @param {number} value
 * @param {number} byteCount
 * @param {boolean} littleEndian
 * @returns {number[]}
 */
function numberToBytes(value, byteCount, littleEndian = false) {
    /** @type {number[]} */
    let result = [];
    for (let i = 0; i < byteCount; i++) {
        let byte = littleEndian
            ? ((value >> (i * 8)) & 0xFF)
            : ((value >> ((byteCount - 1 - i) * 8)) & 0xFF);

        result.push(byte);
    }
    return result;
}

/**
 * @template T
 * @param {T[]} array1
 * @param {T[]} array2
 * @returns {T[]}
 */
function concatArray(array1, array2) {
    /** @type {T[]} */
    let result = [];
    for (let i = 0; i < (array1.length + array2.length); i++) {
        result.push(i < array1.length ? /** @type {T} */ (array1[i]) : /** @type {T} */ (array2[i - array1.length]));
    }
    return result;
}
