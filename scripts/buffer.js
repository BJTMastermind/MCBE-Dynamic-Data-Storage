import { ItemStack, world } from "@minecraft/server";
// import { encodeUTF8, decodeUTF8 } from "./encoding.js";

/**
 * A class for parsing and writing binary data to and from a multi-shulker box based buffer within a Minecraft world.
 */
export default class Buffer {
    static #MAX_SIZE = 48*48*27;
    #offset = 0;
    #dimension; // Currently unused

    constructor(dimension) {
        if (dimension === undefined) {
            console.error("Dimension must be specified.");
            return;
        }

        if (dimension in ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
            this.#dimension = dimension;
        }

        // Check if data storage area has been initialized, if not, initialize it.
        let checkDimension = world.getDimension("minecraft:overworld");
        let checkBlock = checkDimension.getBlock({x:0, y:-64, z:0});

        if (checkBlock.typeId != "minecraft:air" && checkBlock.typeId != "minecraft:light_gray_shulker_box") {
            checkDimension.runCommand("tickingarea add 0 -64 0 47 -64 47 \"dynamic-data-storage-area\" true");
            checkDimension.runCommand("fill 0 -64 0 47 -64 47 air");
            checkDimension.runCommand("fill 0 -63 0 47 -63 47 bedrock");
        }
    }

    /**
     * The maximum size supported by the buffer.
     *
     * @returns 62,208
     */
    static get MAX_SIZE() {
        return Buffer.#MAX_SIZE;
    }

    /**
     * Clears all of the buffers of data.
     */
    clear() {
        world.getDimension("minecraft:overworld").runCommand("fill 0 -64 0 47 -64 47 air");
        this.#offset = 0;
    }

    /**
     * Returns the current offset of the buffer.
     *
     * @returns The offset of the buffer.
     */
    getOffset() {
        return this.#offset;
    }

    /**
     * Returns the current offset of the buffer as a xyz location.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @returns The offset of the buffer in the form of `[x, z, slot]`.
     */
    getOffsetLocation(offset = this.#offset) {
        let blockOffset = Math.floor(offset / 27);

        let blockX = Math.floor(blockOffset / 48);
        let blockZ = blockOffset % 48;

        let blockSlot = offset % 27;

        return [blockX, blockZ, blockSlot];
    }

    /**
     * Changes the buffers reading position to the specified offset.
     *
     * @param {*} offset
     */
    setOffset(offset) {
        if (offset < 0 && offset > MAX_SIZE) {
            console.error("Invalid offset. Must be between 0 and " + MAX_SIZE);
            return;
        }
        this.#offset = offset;
    }

    /**
     * Reads a boolean from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @returns The boolean read from the shulker box.
     */
    readBoolean(offset = this.#offset) {
        if (arguments.length > 0) {
            this.#offset = offset;
        }

        let value = this.#read(offset);
        this.#offset += 1;
        return value == 1;
    }

    /**
     * Reads a byte from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @param {*} twosComplement Whether the value should be read as a twos-complement value.
     * @returns The byte read from the shulker box.
     */
    readByte({ offset = this.#offset, twosComplement = false } = {}) {
        if (arguments.length > 0 && "offset" in (arguments[0] || {})) {
            this.#offset = offset;
        }

        let value = this.#read(offset);
        this.#offset += 1;
        return twosComplement ? this.#twosComplement(value, 8) : value;
    }

    /**
     * Reads a short from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @param {*} twosComplement Whether the value should be read as a twos-complement value.
     * @returns The short read from the shulker box.
     */
    readShort({ offset = this.#offset, twosComplement = false } = {}) {
        if (arguments.length > 0 && "offset" in (arguments[0] || {})) {
            this.#offset = offset;
        }

        let value = ((this.#read(offset) & 0xFF) << 8) | (this.#read(offset + 1) & 0xFF);
        this.#offset += 2;
        return twosComplement ? this.#twosComplement(value, 16) : value;
    }

    /**
     * Reads a integer from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @param {*} twosComplement Whether the value should be read as a twos-complement value.
     * @returns The integer read from the shulker box.
     */
    readInt({ offset = this.#offset, twosComplement = false } = {}) {
        if (arguments.length > 0 && "offset" in (arguments[0] || {})) {
            this.#offset = offset;
        }

        let value = ((this.#read(offset) & 0xFF) << 24) | ((this.#read(offset + 1) & 0xFF) << 16) | ((this.#read(offset + 2) & 0xFF) << 8) | (this.#read(offset + 3) & 0xFF);
        this.#offset += 4;
        return twosComplement ? this.#twosComplement(value, 32) : value;
    }

    /**
     * Reads a long from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @param {*} twosComplement Whether the value should be read as a twos-complement value.
     * @returns The long read from the shulker box.
     */
    readLong({ offset = this.#offset, twosComplement = false } = {}) {
        if (arguments.length > 0 && "offset" in (arguments[0] || {})) {
            this.#offset = offset;
        }

        let value = ((this.#read(offset) & 0xFF) << 56) | ((this.#read(offset + 1) & 0xFF) << 48) | ((this.#read(offset + 2) & 0xFF) << 40) | ((this.#read(offset + 3) & 0xFF) << 32) | ((this.#read(offset + 4) & 0xFF) << 24) | ((this.#read(offset + 5) & 0xFF) << 16) | ((this.#read(offset + 6) & 0xFF) << 8) | (this.#read(offset + 7) & 0xFF);
        this.#offset += 8;
        return twosComplement ? this.#twosComplement(value, 64) : value;
    }

    /**
     * Reads a float from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @returns The float read from the shulker box.
     */
    readFloat(offset = this.#offset) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);

        view.setUint8(0, this.#read(offset));
        view.setUint8(1, this.#read(offset + 1));
        view.setUint8(2, this.#read(offset + 2));
        view.setUint8(3, this.#read(offset + 3));

        this.#offset += 4;
        return view.getFloat32(0, false);
    }

    /**
     * Reads a double from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @returns The double read from the shulker box.
     */
    readDouble(offset = this.#offset) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);

        view.setUint8(0, this.#read(offset));
        view.setUint8(1, this.#read(offset + 1));
        view.setUint8(2, this.#read(offset + 2));
        view.setUint8(3, this.#read(offset + 3));
        view.setUint8(4, this.#read(offset + 4));
        view.setUint8(5, this.#read(offset + 5));
        view.setUint8(6, this.#read(offset + 6));
        view.setUint8(7, this.#read(offset + 7));

        this.#offset += 8;
        return view.getFloat64(0, false);
    }

    /**
     * Reads a string from the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to read from.
     * @param {*} length The length of the string to read.
     * @returns The string read from the shulker box.
     */
    // readString(offset = this.#offset, length) {
    //     if (arguments.length > 1) {
    //         this.#offset = offset;
    //     }

    //     let strBytes = [];
    //     for (let i = 0; i < length; i++) {
    //         strBytes.push(this.#read(offset + i));
    //     }

    //     let value = decodeUTF8(strBytes);

    //     this.#offset += length + value.length;
    //     return value;
    // }

    /**
     * Writes a boolean to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The boolean to write to the shulker box.
     */
    writeBoolean({offset = this.#offset, value} = {}) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        this.#write({offset, value: (value & 0xFF) ? 1 : 0});
        this.#offset += 1;
    }

    /**
     * Writes a byte to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The byte to write to the shulker box.
     */
    writeByte({offset = this.#offset, value} = {}) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        let byte = (value & 0xFF);
        this.#write({offset, value: byte});
        this.#offset += 1;
    }

    /**
     * Writes a short to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The short to write to the shulker box.
     */
    writeShort({offset = this.#offset, value} = {}) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        for (let i = 0; i < 2; i++) {
            let byte = ((value >> ((1 - i) * 8)) & 0xFF);
            this.#write({offset: (offset + i), value: byte});
        }
        this.#offset += 2;
    }

    /**
     * Writes a integer to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The integer to write to the shulker box.
     */
    writeInt({offset = this.#offset, value} = {}) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        for (let i = 0; i < 4; i++) {
            let byte = ((value >> ((3 - i) * 8)) & 0xFF);
            this.#write({offset: (offset + i), value: byte});
        }
        this.#offset += 4;
    }

    /**
     * Writes a long to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The long to write to the shulker box.
     */
    writeLong({offset = this.#offset, value} = {}) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        for (let i = 0; i < 8; i++) {
            let byte = ((value >> ((7 - i) * 8)) & 0xFF);
            this.#write({offset: (offset + i), value: byte});
        }
        this.#offset += 8;
    }

    /**
     * Writes a float to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The float to write to the shulker box.
     */
    writeFloat({offset = this.#offset, value} = {}) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);

        view.setFloat32(0, value, false);
        let bytes = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            this.#write({offset: (offset + i), value: bytes[i]});
        }
        this.#offset += 4;
    }

    /**
     * Writes a double to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The double to write to the shulker box.
     */
    writeDouble({offset = this.#offset, value} = {}) {
        if (arguments.length > 1) {
            this.#offset = offset;
        }

        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);

        view.setFloat64(0, value, false);
        let bytes = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            this.#write({offset: (offset + i), value: bytes[i]});
        }
        this.#offset += 8;
    }

    /**
     * Writes a string to the shulker box at the specified offset.
     *
     * @param {*} offset The offset of the shulker box to write to.
     * @param {*} value The string to write to the shulker box.
     */
    // writeString(offset = this.#offset, value) {
    //     if (arguments.length > 1) {
    //         this.#offset = offset;
    //     }

    //     let length = value.length * 2;
    //     this.writeShort({offset}, length);

    //     let bytes = encodeUTF8(value);
    //     offset += 2;

    //     for (let i = 0; i < length; i++) {
    //         this.#write(offset + i, bytes[i]);
    //     }
    //     this.#offset += length;
    // }

    #read(offset = this.#offset) {
        let [blockX, blockZ, blockSlot] = this.getOffsetLocation(offset);

        let dataBlock = world.getDimension("overworld").getBlock({x:blockX, y:-64, z:blockZ});

        if (dataBlock.typeId != "minecraft:light_gray_shulker_box") {
            console.warn("Offset out of bounds. Nothing to read at: " + offset);
            return null;
        }

        let dataSlot = dataBlock.getComponent("inventory").container.getItem(blockSlot);

        switch (dataSlot.typeId) {
            case "minecraft:tinted_glass":
                return 0;
            case "minecraft:white_stained_glass":
                return dataSlot.amount;
            case "minecraft:light_gray_stained_glass":
                return dataSlot.amount + 64;
            case "minecraft:gray_stained_glass":
                return dataSlot.amount + 128;
            case "minecraft:black_stained_glass":
                return dataSlot.amount + 192;
        }
    }

    #write({offset = this.#offset, value} = {}) {
        let [blockX, blockZ, blockSlot] = this.getOffsetLocation(offset);

        let dataBlock = world.getDimension("minecraft:overworld").getBlock({x:blockX, y:-64, z:blockZ});

        if (dataBlock.typeId != "minecraft:light_gray_shulker_box") {
            world.getDimension("minecraft:overworld").runCommand(`structure load "dynamic_data_storage/empty_upside_down_shulker_box" ${blockX} -64 ${blockZ}`);
        }

        let itemStack;
        if (value == 0) {
            itemStack = new ItemStack("minecraft:tinted_glass", 1);
        } else if (value >= 1 && value <= 64) {
            itemStack = new ItemStack("minecraft:white_stained_glass", value);
        } else if (value >= 65 && value <= 128) {
            itemStack = new ItemStack("minecraft:light_gray_stained_glass", value - 64);
        } else if (value >= 129 && value <= 192) {
            itemStack = new ItemStack("minecraft:gray_stained_glass", value - 128);
        } else if (value >= 193 && value <= 255) {
            itemStack = new ItemStack("minecraft:black_stained_glass", value - 192);
        }

        dataBlock.getComponent("inventory").container.setItem(blockSlot, itemStack);
    }

    #twosComplement(value, bitCount) {
        let mask = 2 ** bitCount;

        if (value & (mask >> 1)) {
            return value - mask;
        }
        return value;
    }
}
