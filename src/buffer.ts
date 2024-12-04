import { Block, BlockPermutation, BlockVolume, DimensionTypes, ItemStack, world } from "@minecraft/server";
import Encoder from "./utils/encoder.ts";
import { CharSets } from "./utils/charsets.ts";

/**
 * A class for parsing and writing binary data to and from a multi-barrel based buffer within a Minecraft world.
 */
export default class Buffer {
    public static readonly MAX_SIZE: number = 16*16*27;

    private offset: number = 0;
    private dimensionMinY: number = -64;
    private dimension: string;

    public constructor(dimension: string = "minecraft:overworld") {
        if (!(DimensionTypes.getAll().includes(DimensionTypes.get(dimension)!))) {
            throw new Error(`"${dimension}" is not a valid dimension.`);
        }

        if (dimension == "minecraft:the_end") {
            throw new Error(`"${dimension}" is not a supported dimension.`);
        }

        this.dimensionMinY = world.getDimension(dimension).heightRange.min;

        this.dimension = dimension;

        // Check if data storage area has been initialized, if not, initialize it.
        let checkDimension = world.getDimension(this.dimension);

        let checkBlock: Block = checkDimension.getBlock({x:0, y:this.dimensionMinY, z:0})!;

        if (checkBlock != undefined && checkBlock.typeId != "minecraft:air" && checkBlock.typeId != "minecraft:barrel") {
            checkDimension.runCommand(`tickingarea add 0 ${this.dimensionMinY} 0 15 ${this.dimensionMinY} 15 \"dynamic-data-storage-area\" true`);
            checkDimension.fillBlocks(new BlockVolume({x:0, y:this.dimensionMinY, z:0}, {x:15, y:this.dimensionMinY, z:15}), "minecraft:air");
            checkDimension.fillBlocks(new BlockVolume({x:0, y:this.dimensionMinY + 1, z:0}, {x:15, y:this.dimensionMinY + 1, z:15}), "minecraft:bedrock");
        }
    }

    /**
     * Call if you used a 1.x version of the library to migrate the buffers data to the new system. (Currently will override existing data in the now unused area)
     */
    public migrate() {
        // Collect data from 1.x buffer into a list.
        let data = [];
        for (let i = 0; i < this.getUsedBytes(48*48*27, 48); i++) {
            data.push(this.read(i, 48));
        }

        // Wipe all data from 1.x buffer.
        world.getDimension(this.dimension).fillBlocks(new BlockVolume({x:16, y:this.dimensionMinY, z:0}, {x:47, y:this.dimensionMinY, z:47}), "minecraft:bedrock");
        world.getDimension(this.dimension).fillBlocks(new BlockVolume({x:0, y:this.dimensionMinY, z:16}, {x:15, y:this.dimensionMinY, z:47}), "minecraft:bedrock");
        this.clear();

        // TODO: Write data to new 2.0 buffer.

        console.warn("Buffer migration complete.");
    }

    /**
     * Clears all of the buffers data and resets the current offset to 0.
     */
    public clear() {
        world.getDimension(this.dimension).fillBlocks(new BlockVolume({x:0, y:this.dimensionMinY, z:0}, {x:15, y:this.dimensionMinY, z:15}), "minecraft:air");
        this.offset = 0;
    }

    /**
     * Returns the dimension the buffer was created for.
     *
     * @returns The dimension the buffer was created for.
     */
    public getDimension(): string {
        return this.dimension;
    }

    /**
     * Returns the current offset of the buffer.
     *
     * @returns The offset of the buffer.
     */
    public getOffset(): number {
        return this.offset;
    }

    /**
     * Returns the current offset of the buffer as a location.
     *
     * @param offset The offset of the buffer to read from.
     * @returns The offset of the buffer in the form of `[x, z, slot]`.
     */
    public getOffsetLocation(offset: number = this.offset, bufferWidth: number = 16): [number, number, number] {
        let blockOffset = Math.floor(offset / 27);

        let blockX = Math.floor(blockOffset / bufferWidth);
        let blockZ = blockOffset % bufferWidth;

        let blockSlot = offset % 27;

        return [blockX, blockZ, blockSlot];
    }

    /**
     * Returns the number of used bytes in the buffer.
     *
     * @returns The number of used bytes.
     */
    public getUsedBytes(maxSize: number = Buffer.MAX_SIZE, bufferWidth: number = 16): number {
        let count = 0;
        for (let i = 0; i < maxSize; i++) {
            try {
                this.read(i, bufferWidth);
                count++;
            } catch (e) {
                return count;
            }
        }
        return count;
    }

    /**
     * Changes the buffers reading position to the specified offset.
     *
     * @param offset The new offset location.
     */
    public setOffset(offset: number) {
        if (offset < 0 && offset > Buffer.MAX_SIZE) {
            throw new Error("Invalid offset. Must be between 0 and " + Buffer.MAX_SIZE);
        }
        this.offset = offset;
    }

    /**
     * Removes `removeByteCount` bytes from the buffer left to right at the specified offset.
     *
     * @param removeByteCount The number of bytes to remove.
     * @param offset The starting offset of the buffer to remove from.
     *
     * @throws `Error` if there is nothing to remove at the specified offset.
     */
    public remove(removeByteCount: number = 1, offset: number) {
        try {
            this.read(offset);
        } catch (e) {
            throw new Error(`Nothing to remove at offset ${offset}.`);
        }

        let byteCount: number = this.getUsedBytes();

        // Remove the specified number of bytes from the buffer.
        for (let i = offset; i < (offset + removeByteCount); i++) {
            let [x, z, slot]: number[] = this.getOffsetLocation(i);

            let block = world.getDimension(this.dimension).getBlock({x, y:this.dimensionMinY, z});
            block!.getComponent("inventory")!.container!.setItem(slot, new ItemStack("minecraft:air"));
        }

        // Shift the remaining bytes to the left.
        for (let i = (offset + removeByteCount), j = 0; i < byteCount; i++) {
            let [x, z, slot]: number[] = this.getOffsetLocation(i);

            let value = this.read(i);

            let block = world.getDimension(this.dimension).getBlock({x, y:this.dimensionMinY, z});
            block!.getComponent("inventory")!.container!.setItem(slot, new ItemStack("minecraft:air"));

            this.write(value, offset + j++);
        }

        this.offset -= removeByteCount;
    }

    /**
     * Reads a boolean from the buffer at the specified offset.
     *
     * @param offset The offset of the buffer to read from.
     * @returns The boolean read from the buffer.
     */
    public readBoolean(offset: number = this.offset): boolean {
        if (arguments.length > 0) {
            this.offset = offset;
        }

        let value = this.read(offset);
        this.offset += 1;
        return value == 1;
    }

    /**
     * Reads a unsigned byte from the buffer at the specified offset.
     *
     * @param offset The offset of the buffer to read from.
     * @returns The unsigned byte read from the buffer.
     */
    public readUByte(offset: number = this.offset): number {
        if (arguments.length > 0) {
            this.offset = offset;
        }

        let value = this.read(offset);
        this.offset += 1;
        return (value < 0) ? value + Math.pow(2, 8) : value;
    }

    /**
     * Reads a byte from the buffer at the specified offset.
     *
     * @param offset The offset of the buffer to read from.
     * @returns The byte read from the buffer.
     */
    public readByte(offset = this.offset): number {
        if (arguments.length > 0) {
            this.offset = offset;
        }

        let value = this.read(offset);
        this.offset += 1;
        return value;
    }

    /**
     * Reads a unsigned short from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The unsigned short read from the buffer.
     */
    public readUShort(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        let value: number = littleEndian
            ? (this.read(offset) & 0xFF) | ((this.read(offset + 1) & 0xFF) << 8)
            : ((this.read(offset) & 0xFF) << 8) | (this.read(offset + 1) & 0xFF);

        this.offset += 2;
        return (value < 0) ? value + Math.pow(2, 16) : value;
    }

    /**
     * Reads a short from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The short read from the buffer.
     */
    public readShort(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        let value: number = littleEndian
            ? (this.read(offset) & 0xFF) | ((this.read(offset + 1) & 0xFF) << 8)
            : ((this.read(offset) & 0xFF) << 8) | (this.read(offset + 1) & 0xFF);

        this.offset += 2;
        return value;
    }

    /**
     * Reads a unsigned integer from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The unsigned integer read from the buffer.
     */
    public readUInt(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        let value: number = littleEndian
            ? (this.read(offset) & 0xFF) | ((this.read(offset + 1) & 0xFF) << 8) | ((this.read(offset + 2) & 0xFF) << 16) | ((this.read(offset + 3) & 0xFF) << 24)
            : ((this.read(offset) & 0xFF) << 24) | ((this.read(offset + 1) & 0xFF) << 16) | ((this.read(offset + 2) & 0xFF) << 8) | (this.read(offset + 3) & 0xFF);

        this.offset += 4;
        return (value < 0) ? value + Math.pow(2, 32) : value;
    }

    /**
     * Reads a integer from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The integer read from the buffer.
     */
    public readInt(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        let value: number = littleEndian
            ? (this.read(offset) & 0xFF) | ((this.read(offset + 1) & 0xFF) << 8) | ((this.read(offset + 2) & 0xFF) << 16) | ((this.read(offset + 3) & 0xFF) << 24)
            : ((this.read(offset) & 0xFF) << 24) | ((this.read(offset + 1) & 0xFF) << 16) | ((this.read(offset + 2) & 0xFF) << 8) | (this.read(offset + 3) & 0xFF);

        this.offset += 4;
        return value;
    }

    /**
     * Reads a unsigned long from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The unsigned long read from the buffer.
     */
    public readULong(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        let value: number = littleEndian
            ? (this.read(offset) & 0xFF) | ((this.read(offset + 1) & 0xFF) << 8) | ((this.read(offset + 2) & 0xFF) << 16) | ((this.read(offset + 3) & 0xFF) << 24) | ((this.read(offset + 4) & 0xFF) << 32) | ((this.read(offset + 5) & 0xFF) << 40) | ((this.read(offset + 6) & 0xFF) << 48) | ((this.read(offset + 7) & 0xFF) << 56)
            : ((this.read(offset) & 0xFF) << 56) | ((this.read(offset + 1) & 0xFF) << 48) | ((this.read(offset + 2) & 0xFF) << 40) | ((this.read(offset + 3) & 0xFF) << 32) | ((this.read(offset + 4) & 0xFF) << 24) | ((this.read(offset + 5) & 0xFF) << 16) | ((this.read(offset + 6) & 0xFF) << 8) | (this.read(offset + 7) & 0xFF);

        this.offset += 8;
        return (value < 0) ? value + Math.pow(2, 64) : value;
    }

    /**
     * Reads a long from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The long read from the buffer.
     */
    public readLong(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        let value: number = littleEndian
            ? (this.read(offset) & 0xFF) | ((this.read(offset + 1) & 0xFF) << 8) | ((this.read(offset + 2) & 0xFF) << 16) | ((this.read(offset + 3) & 0xFF) << 24) | ((this.read(offset + 4) & 0xFF) << 32) | ((this.read(offset + 5) & 0xFF) << 40) | ((this.read(offset + 6) & 0xFF) << 48) | ((this.read(offset + 7) & 0xFF) << 56)
            : ((this.read(offset) & 0xFF) << 56) | ((this.read(offset + 1) & 0xFF) << 48) | ((this.read(offset + 2) & 0xFF) << 40) | ((this.read(offset + 3) & 0xFF) << 32) | ((this.read(offset + 4) & 0xFF) << 24) | ((this.read(offset + 5) & 0xFF) << 16) | ((this.read(offset + 6) & 0xFF) << 8) | (this.read(offset + 7) & 0xFF);

        this.offset += 8;
        return value;
    }

    /**
     * Reads a float from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The float read from the buffer.
     */
    public readFloat(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        const buffer: ArrayBuffer = new ArrayBuffer(4);
        const view: DataView = new DataView(buffer);

        view.setUint8(0, this.read(offset));
        view.setUint8(1, this.read(offset + 1));
        view.setUint8(2, this.read(offset + 2));
        view.setUint8(3, this.read(offset + 3));

        this.offset += 4;
        return view.getFloat32(0, littleEndian);
    }

    /**
     * Reads a double from the buffer at the specified offset.
     *
     * @param littleEndian Whether the value should be read as a little-endian value.
     * @param offset The offset of the buffer to read from.
     * @returns The double read from the buffer.
     */
    public readDouble(littleEndian: boolean = false, offset: number = this.offset): number {
        if (arguments.length > 1) {
            this.offset = offset;
        }

        const buffer: ArrayBuffer = new ArrayBuffer(8);
        const view: DataView = new DataView(buffer);

        view.setUint8(0, this.read(offset));
        view.setUint8(1, this.read(offset + 1));
        view.setUint8(2, this.read(offset + 2));
        view.setUint8(3, this.read(offset + 3));
        view.setUint8(4, this.read(offset + 4));
        view.setUint8(5, this.read(offset + 5));
        view.setUint8(6, this.read(offset + 6));
        view.setUint8(7, this.read(offset + 7));

        this.offset += 8;
        return view.getFloat64(0, littleEndian);
    }

    /**
     * Reads a string from the buffer at the specified offset.
     *
     * @param {CharSets} charSet The character set of the string.
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value. (Only applicable for UTF-16)
     * @param {number} offset The offset of the buffer to read from.
     * @returns {string} The string read from the buffer.
     */
    public readString(charSet: CharSets = CharSets.UTF8, littleEndian: boolean = false, offset: number = this.offset): string {
        if (arguments.length > 2) {
            this.offset = offset;
        }

        let length = this.readUShort(littleEndian, offset);
        offset += 2;

        let strBytes: number[] = [];
        for (let i = 0; i < length; i++) {
            strBytes.push(this.read(offset + i));
        }

        let encoder = new Encoder(charSet);
        let value = encoder.decode(strBytes, littleEndian);

        this.offset += value.length;
        return value;
    }

    /**
     * Writes a boolean to the buffer at the specified offset.
     *
     * @param value The boolean to write to the buffer.
     * @param offset The offset of the buffer to write to.
     */
    public writeBoolean(value: boolean, offset: number = this.offset) {
        if (Buffer.MAX_SIZE - offset < 1) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 1) {
            this.offset = offset;
        }

        this.write(value ? 1 : 0, offset);
        this.offset += 1;
    }

    /**
     * Writes a unsigned byte to the buffer at the specified offset.
     *
     * @param value The unsigned byte to write to the buffer.
     * @param offset The offset of the buffer to write to.
     */
    public writeUByte(value: number, offset: number = this.offset) {
        if (value < 0 || value > 255) {
            throw new Error(`Invaild value for type: unsigned byte. Value must be between 0 and 255. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 1) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 1) {
            this.offset = offset;
        }

        let byte = (value & 0xFF);
        this.write(byte, offset);
        this.offset += 1;
    }

    /**
     * Writes a byte to the buffer at the specified offset.
     *
     * @param value The byte to write to the buffer.
     * @param offset The offset of the buffer to write to.
     */
    public writeByte(value: number, offset: number = this.offset) {
        if (value < -128 || value > 127) {
            throw new Error(`Invaild value for type: byte. Value must be between -128 and 127. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 1) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 1) {
            this.offset = offset;
        }

        let byte: number = (value & 0xFF);
        this.write(byte, offset);
        this.offset += 1;
    }

    /**
     * Writes a unsigned short to the buffer at the specified offset.
     *
     * @param value The unsigned short to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeUShort(value: number, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < 0 || value > 65_535) {
            throw new Error(`Invaild value for type: unsigned short. Value must be between 0 and 65,535. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 2) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        for (let i = 0; i < 2; i++) {
            let byte: number = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((1 - i) * 8)) & 0xFF);

            this.write(byte, offset + i);
        }
        this.offset += 2;
    }

    /**
     * Writes a short to the buffer at the specified offset.
     *
     * @param value The short to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeShort(value: number, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < -32_768 || value > 32_767) {
            throw new Error(`Invaild value for type: short. Value must be between -32,768 and 32,767. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 2) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        for (let i = 0; i < 2; i++) {
            let byte: number = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((1 - i) * 8)) & 0xFF);

            this.write(byte, offset + i);
        }
        this.offset += 2;
    }

    /**
     * Writes a unsigned integer to the buffer at the specified offset.
     *
     * @param value The unsigned integer to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeUInt(value: number, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < 0 || value > 4_294_967_295) {
            throw new Error(`Invaild value for type: unsigned int. Value must be between 0 and 4,294,967,295. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 4) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        for (let i = 0; i < 4; i++) {
            let byte: number = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((3 - i) * 8)) & 0xFF);

            this.write(byte, offset + i);
        }
        this.offset += 4;
    }

    /**
     * Writes a integer to the buffer at the specified offset.
     *
     * @param value The integer to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeInt(value: number, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < -2_147_483_648 || value > 2_147_483_647) {
            throw new Error(`Invaild value for type: int. Value must be between -2,147,483,648 and 2,147,483,647. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 4) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        for (let i = 0; i < 4; i++) {
            let byte: number = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((3 - i) * 8)) & 0xFF);

            this.write(byte, offset + i);
        }
        this.offset += 4;
    }

    /**
     * Writes a unsigned long to the buffer at the specified offset.
     *
     * @param value The unsigned long to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeULong(value: number, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < 0 || value > 18_446_744_073_709_551_615n) {
            throw new Error(`Invaild value for type: unsigned long. Value must be between 0 and 18,446,744,073,709,551,615. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 8) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        for (let i = 0; i < 8; i++) {
            let byte: number = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((7 - i) * 8)) & 0xFF);

            this.write(byte, offset + i);
        }
        this.offset += 8;
    }

    /**
     * Writes a long to the buffer at the specified offset.
     *
     * @param value The long to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeLong(value: bigint, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < -9_223_372_036_854_775_808n || value > 9_223_372_036_854_775_807n) {
            throw new Error(`Invaild value for type: long. Value must be between -9,223,372,036,854,775,808 and 9,223,372,036,854,775,807. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 8) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        for (let i = 0n; i < 8n; i++) {
            let byte: bigint = littleEndian
                ? ((value >> (i * 8n)) & 0xFFn)
                : ((value >> ((7n - i) * 8n)) & 0xFFn);

            this.write(byte, offset + Number(i));
        }
        this.offset += 8;
    }

    /**
     * Writes a float to the buffer at the specified offset.
     *
     * @param value The float to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeFloat(value: number, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < (1.4 * Math.pow(10, -45)) || value > (3.4 * Math.pow(10, 38))) {
            throw new Error(`Invaild value for type: float. Value must be between ${1.4 * Math.pow(10, -45)} and ${3.4 * Math.pow(10, 38)}. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 4) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        const buffer: ArrayBuffer = new ArrayBuffer(4);
        const view: DataView = new DataView(buffer);

        view.setFloat32(0, value, littleEndian);
        let bytes: Uint8Array = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            this.write(bytes[i]!, offset + i);
        }
        this.offset += 4;
    }

    /**
     * Writes a double to the buffer at the specified offset.
     *
     * @param value The double to write to the buffer.
     * @param littleEndian Whether the value should be written as a little-endian value.
     * @param offset The offset of the buffer to write to.
     */
    public writeDouble(value: number, littleEndian: boolean = false, offset: number = this.offset) {
        if (value < (4.9 * Math.pow(10, -324)) || value > (1.8 * Math.pow(10, 308))) {
            throw new Error(`Invaild value for type: double. Value must be between ${4.9 * Math.pow(10, -324)} and ${1.8 * Math.pow(10, 308)}. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 8) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.offset = offset;
        }

        const buffer: ArrayBuffer = new ArrayBuffer(8);
        const view: DataView = new DataView(buffer);

        view.setFloat64(0, value, littleEndian);
        let bytes: Uint8Array = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            this.write(bytes[i]!, offset + i);
        }
        this.offset += 8;
    }

    /**
     * Writes a string to the buffer at the specified offset.
     *
     * @param value The string to write to the buffer.
     * @param charSet The character set of the string.
     * @param littleEndian Whether the value should be written as a little-endian value. (Only applicable for UTF-16)
     * @param offset The offset of the buffer to write to.
     */
    public writeString(value: string, charSet: CharSets = CharSets.UTF8, littleEndian: boolean = false, offset: number = this.offset) {
        if (Buffer.MAX_SIZE - offset < (value.length + 2)) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 3) {
            this.offset = offset;
        }

        let encoder: Encoder = new Encoder(charSet);
        let bytes: number[] = encoder.encode(value, littleEndian);

        for (let i = 0; i < bytes.length; i++) {
            this.write(bytes[i]!, offset + i);
        }
        this.offset += bytes.length;
    }

    private read(offset: number = this.offset, bufferWidth: number = 16): number {
        let [blockX, blockZ, blockSlot]: number[] = this.getOffsetLocation(offset, bufferWidth);

        let dataBlock: Block = world.getDimension(this.dimension).getBlock({x:blockX, y:this.dimensionMinY, z:blockZ})!;

        if (dataBlock.typeId != "minecraft:barrel") {
            throw new Error("Offset out of bounds. Nothing to read at: " + offset);
        }

        let dataSlot: ItemStack = dataBlock.getComponent("inventory")!.container!.getItem(blockSlot)!;

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
            default:
                throw new Error("Unknown data item type: " + dataSlot.typeId);
        }
    }

    private write(value: number|bigint, offset: number = this.offset) {
        let [blockX, blockZ, blockSlot]: number[] = this.getOffsetLocation(offset);

        let dataBlock: Block = world.getDimension(this.dimension).getBlock({x:blockX, y:this.dimensionMinY, z:blockZ})!;

        if (dataBlock!.typeId != "minecraft:barrel") {
            world.getDimension(this.dimension).setBlockPermutation({x:blockX, y:this.dimensionMinY, z:blockZ}, BlockPermutation.resolve("minecraft:barrel", {"facing_direction": 0}));
        }

        let itemStack;
        if (value == 0) {
            itemStack = new ItemStack("minecraft:tinted_glass", 1);
        } else if (value >= 1 && value <= 64) {
            itemStack = new ItemStack("minecraft:white_stained_glass", Number(value));
        } else if (value >= 65 && value <= 128) {
            itemStack = new ItemStack("minecraft:light_gray_stained_glass", Number(value) - 64);
        } else if (value >= 129 && value <= 192) {
            itemStack = new ItemStack("minecraft:gray_stained_glass", Number(value) - 128);
        } else if (value >= 193 && value <= 255) {
            itemStack = new ItemStack("minecraft:black_stained_glass", Number(value) - 192);
        }

        dataBlock.getComponent("inventory")!.container!.setItem(blockSlot, itemStack);
    }
}
