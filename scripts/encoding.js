export function encodeUTF8(str) {
    const utf8 = [];
    // for (let i = 0; i < str.length; i++) {
    //     let charCode = str.charCodeAt(i);
    //     if (charCode < 0x80) {
    //         utf8.push(charCode); // 1-byte sequence
    //     } else if (charCode < 0x800) {
    //         utf8.push(0xC0 | (charCode >> 6), 0x80 | (charCode & 0x3F)); // 2-byte sequence
    //     } else if (charCode < 0x10000) {
    //         utf8.push(
    //             0xE0 | (charCode >> 12),
    //             0x80 | ((charCode >> 6) & 0x3F),
    //             0x80 | (charCode & 0x3F)
    //         ); // 3-byte sequence
    //     } else {
    //         utf8.push(
    //             0xF0 | (charCode >> 18),
    //             0x80 | ((charCode >> 12) & 0x3F),
    //             0x80 | ((charCode >> 6) & 0x3F),
    //             0x80 | (charCode & 0x3F)
    //         ); // 4-byte sequence
    //     }
    // }
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        utf8.push(char >> 8);
        utf8.push(char & 0xFF);
    }
    return utf8;
}

export function decodeUTF8(data) {
    let str = "";
    //     i;

    // for (i = 0; i < data.length; i++) {
    //     var value = data[i];

    //     if (value < 0x80) {
    //         str += String.fromCharCode(value);
    //     } else if (value > 0xBF && value < 0xE0) {
    //         str += String.fromCharCode((value & 0x1F) << 6 | data[i + 1] & 0x3F);
    //         i += 1;
    //     } else if (value > 0xDF && value < 0xF0) {
    //         str += String.fromCharCode((value & 0x0F) << 12 | (data[i + 1] & 0x3F) << 6 | data[i + 2] & 0x3F);
    //         i += 2;
    //     } else {
    //         // surrogate pair
    //         var charCode = ((value & 0x07) << 18 | (data[i + 1] & 0x3F) << 12 | (data[i + 2] & 0x3F) << 6 | data[i + 3] & 0x3F) - 0x010000;

    //         str += String.fromCharCode(charCode >> 10 | 0xD800, charCode & 0x03FF | 0xDC00);
    //         i += 3;
    //     }
    // }

    for (let i = 0; i < data.length; i += 2) {
        str += String.fromCharCode((data[i] << 8) | data[i + 1]);
        console.warn("string = "+str);
    }

    return str;
}
