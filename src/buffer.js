import { Block, BlockInventoryComponent, BlockPermutation, BlockVolume, Container, DimensionType, DimensionTypes, ItemStack, StructureSaveMode, world } from "@minecraft/server";
import Encoder from "./utils/encoder.js";
import { CharSets } from "./utils/charsets.js";

/**
 * A class for parsing and writing binary data to and from a multi-barrel based buffer within a Minecraft world.
 */
export default class Buffer {
    /** @readonly */
    static #MAX_SIZE = 48*48*27;
    /** @deprecated */ #useExperimental;
    /** @deprecated */ #isClosed = false;
    #offset = 0;
    #dimensionMinY = -64;
    /** @type {string} */
    #dimension;

    /**
     * @param {string} dimension
     * @param {boolean} useExperimental
     */
    constructor(dimension = "minecraft:overworld", /** @deprecated */ useExperimental = false) {
        if (!(DimensionTypes.getAll().includes(/** @type {DimensionType} */ (DimensionTypes.get(dimension))))) {
            throw new Error(`"${dimension}" is not a valid dimension.`);
        }

        if (dimension == "minecraft:the_end") {
            throw new Error(`"${dimension}" is not a supported dimension.`);
        }

        this.#dimensionMinY = world.getDimension(dimension).heightRange.min;

        this.#dimension = dimension;
        this.#useExperimental = useExperimental;

        // Check if data storage area has been initialized, if not, initialize it.
        let checkDimension = world.getDimension(this.#dimension);

        let checkBlock = /** @type {Block} */ (checkDimension.getBlock({x:0, y:this.#dimensionMinY, z:0}));

        if (checkBlock != undefined && checkBlock.typeId != "minecraft:air" && checkBlock.typeId != "minecraft:barrel") {
            checkDimension.runCommand(`tickingarea add 0 ${this.#dimensionMinY} 0 47 ${this.#dimensionMinY} 47 \"dynamic-data-storage-area\" true`);
            checkDimension.fillBlocks(new BlockVolume({x:0, y:this.#dimensionMinY, z:0}, {x:47, y:this.#dimensionMinY, z:47}), "minecraft:air");
            checkDimension.fillBlocks(new BlockVolume({x:0, y:this.#dimensionMinY + 1, z:0}, {x:47, y:this.#dimensionMinY + 1, z:47}), "minecraft:bedrock");
        }
    }

    /**
     * The maximum size supported by the buffer.
     *
     * @returns {number} 62,208
     */
    static get MAX_SIZE() {
        return Buffer.#MAX_SIZE;
    }

    /**
     * Clears all of the buffers data and resets the current offset to 0.
     *
     * @returns {void}
     */
    clear() {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        world.getDimension(this.#dimension).fillBlocks(new BlockVolume({x:0, y:this.#dimensionMinY, z:0}, {x:47, y:this.#dimensionMinY, z:47}), "minecraft:air");
        this.#offset = 0;
    }

    /**
     * Closes the buffer.
     *
     * @returns {void}
     *
     * @experimental This is an experimental feature and is not guaranteed to stay.
     * @deprecated This feature is deprecated and will be removed in a future version.
     */
    close() {
        if (!this.#useExperimental) {
            throw new Error("useExperimental was not enabled when buffer instance was created.");
        }

        if (this.#isClosed) {
            throw new Error("Buffer is already closed!");
        }

        let blocks = world.getDimension(this.#dimension).getBlocks(new BlockVolume({x:0, y:this.#dimensionMinY, z:0}, {x:47, y:this.#dimensionMinY, z:47}), {includePermutations: [BlockPermutation.resolve("minecraft:barrel")]});
        if (blocks.getCapacity() == 0) {
            throw new Error("Buffer is already clear!");
        }

        world.getDimension(this.#dimension).fillBlocks(new BlockVolume({x:0, y:this.#dimensionMinY, z:0}, {x:47, y:this.#dimensionMinY, z:47}), "minecraft:air");
        this.#isClosed = true;
    }

    /**
     * Deletes the saved buffer from the world data.
     *
     * @param {string} saveName The name of the saved buffer to delete.
     * @returns {void}
     *
     * @experimental This is an experimental feature and is not guaranteed to stay.
     * @deprecated This feature is deprecated and will be removed in a future version.
     */
    delete(saveName) {
        if (!this.#useExperimental) {
            throw new Error("useExperimental was not enabled when buffer instance was created.");
        }

        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (saveName.trim() == "") {
            throw new Error("save name can't be blank");
        }

        world.structureManager.delete(`dynamic_data_storage_file:${saveName}`);
    }

    /**
     * Returns the dimension the buffer was created for.
     *
     * @returns {string} The dimension the buffer was created for.
     */
    getDimension() {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        return this.#dimension;
    }

    /**
     * Returns the current offset of the buffer.
     *
     * @returns {number} The offset of the buffer.
     */
    getOffset() {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        return this.#offset;
    }

    /**
     * Returns the current offset of the buffer as a location.
     *
     * @param {number} offset The offset of the buffer to read from.
     * @returns {[x: number, z: number, slot: number]} The offset of the buffer in the form of `[x, z, slot]`.
     */
    getOffsetLocation(offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        let blockOffset = Math.floor(offset / 27);

        let blockX = Math.floor(blockOffset / 48);
        let blockZ = blockOffset % 48;

        let blockSlot = offset % 27;

        return [blockX, blockZ, blockSlot];
    }

    /**
     * Returns the number of used bytes in the buffer.
     *
     * @returns {number} The number of used bytes.
     */
    getUsedBytes() {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        let count = 0;
        for (let i = 0; i < Buffer.#MAX_SIZE; i++) {
            try {
                this.#read(i);
                count++;
            } catch (e) {
                return count;
            }
        }
        return count;
    }

    /**
     * Saves the buffer to the world data so i can be loaded again later. (Doesn't close the buffer)
     *
     * @param {string} saveName The name for the buffer to be save as.
     * @param {boolean} override Whether to override an existing buffer with the same name. (Default: false)
     * @returns {void}
     *
     * @throws Error if buffer is empty.
     * @experimental This is an experimental feature and is not guaranteed to stay.
     * @deprecated This feature is deprecated and will be removed in a future version.
     */
    save(saveName, override = false) {
        if (!this.#useExperimental) {
            throw new Error("useExperimental was not enabled when buffer instance was created.");
        }

        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (saveName.trim() == "") {
            throw new Error("save name can't be blank");
        }

        let structureIds = world.structureManager.getWorldStructureIds();

        let blocks = world.getDimension(this.#dimension).getBlocks(new BlockVolume({x:0, y:this.#dimensionMinY, z:0}, {x:47, y:this.#dimensionMinY, z:47}), {includePermutations: [BlockPermutation.resolve("minecraft:barrel")]});
        if (blocks.getCapacity() == 0) {
            throw new Error("Aborting saving, buffer is empty!");
        }

        if (structureIds.includes(`dynamic_data_storage_file:${saveName}`) && !override) {
            throw new Error(`A buffer with the name ${saveName} already exists! Set override argument to true to override the existing buffer.`);
        }

        world.structureManager.createFromWorld(`dynamic_data_storage_file:${saveName}`, world.getDimension(this.#dimension), {x:0, y:this.#dimensionMinY, z:0}, {x:47, y:this.#dimensionMinY, z:47}, {saveMode: StructureSaveMode.World, includeEntities: false});
    }

    /**
     * Changes the buffers reading position to the specified offset.
     *
     * @param {number} offset The new offset location.
     * @returns {void}
     */
    setOffset(offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (offset < 0 && offset > Buffer.MAX_SIZE) {
            throw new Error("Invalid offset. Must be between 0 and " + Buffer.MAX_SIZE);
        }
        this.#offset = offset;
    }

    /**
     * Loads a saved buffer from the world data.
     *
     * @param {string} saveName The name of the saved buffer to load.
     * @returns {void}
     *
     * @throws `Error` if another buffer is already loaded or `saveName` doesn't exist.
     * @experimental This is an experimental feature and is not guaranteed to stay.
     * @deprecated This feature is deprecated and will be removed in a future version.
     */
    load(saveName) {
        if (!this.#useExperimental) {
            throw new Error("useExperimental was not enabled when buffer instance was created.");
        }

        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (saveName.trim() == "") {
            throw new Error("save name can't be blank");
        }

        let blocks = world.getDimension(this.#dimension).getBlocks(new BlockVolume({x:0, y:this.#dimensionMinY, z:0}, {x:47, y:this.#dimensionMinY, z:47}), {includePermutations: [BlockPermutation.resolve("minecraft:barrel")]});
        if (blocks.getCapacity() > 0) {
            throw new Error("Aborting loading, another buffer is loaded!");
        }

        let structureIds = world.structureManager.getWorldStructureIds();
        if (!structureIds.includes(`dynamic_data_storage_file:${saveName}`)) {
            throw new Error(`${saveName} does not exist!`);
        }

        world.structureManager.place(`dynamic_data_storage_file:${saveName}`, world.getDimension(this.#dimension), {x:0, y:this.#dimensionMinY, z:0});
    }

    /**
     * Removes `removeByteCount` bytes from the buffer left to right at the specified offset.
     *
     * @param {number} removeByteCount The number of bytes to remove.
     * @param {number} offset The starting offset of the buffer to remove from.
     * @returns {void}
     *
     * @throws `Error` if there is nothing to remove at the specified offset.
     */
    remove(removeByteCount = 1, offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        try {
            this.#read(offset);
        } catch (e) {
            throw new Error(`Nothing to remove at offset ${offset}.`);
        }

        let byteCount = this.getUsedBytes();

        // Remove the specified number of bytes from the buffer.
        for (let i = offset; i < (offset + removeByteCount); i++) {
            let [x, z, slot] = this.getOffsetLocation(i);

            let block = /** @type {Block} */ (world.getDimension(this.#dimension).getBlock({x, y:this.#dimensionMinY, z}));
            /** @type {Container} */ (/** @type {BlockInventoryComponent} */ (block.getComponent("inventory")).container).setItem(slot, new ItemStack("minecraft:air"));
        }

        // Shift the remaining bytes to the left.
        for (let i = (offset + removeByteCount), j = 0; i < byteCount; i++) {
            let [x, z, slot] = this.getOffsetLocation(i);

            let value = this.#read(i);

            let block = /** @type {Block} */ (world.getDimension(this.#dimension).getBlock({x, y:this.#dimensionMinY, z}));
            /** @type {Container} */ (/** @type {BlockInventoryComponent} */ (block.getComponent("inventory")).container).setItem(slot, new ItemStack("minecraft:air"));

            this.#write(value, offset + j++);
        }

        this.#offset -= removeByteCount;
    }

    /**
     * Reads a boolean from the buffer at the specified offset.
     *
     * @param {number} offset The offset of the buffer to read from.
     * @returns {boolean} The boolean read from the buffer.
     */
    readBoolean(offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 0) {
            this.#offset = offset;
        }

        let value = this.#read(offset);
        this.#offset += 1;
        return value == 1;
    }

    /**
     * Reads a unsigned byte from the buffer at the specified offset.
     *
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The unsigned byte read from the buffer.
     */
    readUByte(offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 0) {
            this.#offset = offset;
        }

        let value = this.#read(offset);
        this.#offset += 1;
        return (value < 0) ? value + Math.pow(2, 8) : value;
    }

    /**
     * Reads a byte from the buffer at the specified offset.
     *
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The byte read from the buffer.
     */
    readByte(offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 0) {
            this.#offset = offset;
        }

        let value = this.#read(offset);
        this.#offset += 1;
        return value;
    }

    /**
     * Reads a unsigned short from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The unsigned short read from the buffer.
     */
    readUShort(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        /** @type {number} */
        let value = littleEndian
            ? (this.#read(offset) & 0xFF) | ((this.#read(offset + 1) & 0xFF) << 8)
            : ((this.#read(offset) & 0xFF) << 8) | (this.#read(offset + 1) & 0xFF);

        this.#offset += 2;
        return (value < 0) ? value + Math.pow(2, 16) : value;
    }

    /**
     * Reads a short from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The short read from the buffer.
     */
    readShort(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        /** @type {number} */
        let value = littleEndian
            ? (this.#read(offset) & 0xFF) | ((this.#read(offset + 1) & 0xFF) << 8)
            : ((this.#read(offset) & 0xFF) << 8) | (this.#read(offset + 1) & 0xFF);

        this.#offset += 2;
        return value;
    }

    /**
     * Reads a unsigned integer from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The unsigned integer read from the buffer.
     */
    readUInt(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        /** @type {number} */
        let value = littleEndian
            ? (this.#read(offset) & 0xFF) | ((this.#read(offset + 1) & 0xFF) << 8) | ((this.#read(offset + 2) & 0xFF) << 16) | ((this.#read(offset + 3) & 0xFF) << 24)
            : ((this.#read(offset) & 0xFF) << 24) | ((this.#read(offset + 1) & 0xFF) << 16) | ((this.#read(offset + 2) & 0xFF) << 8) | (this.#read(offset + 3) & 0xFF);

        this.#offset += 4;
        return (value < 0) ? value + Math.pow(2, 32) : value;
    }

    /**
     * Reads a integer from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The integer read from the buffer.
     */
    readInt(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        /** @type {number} */
        let value = littleEndian
            ? (this.#read(offset) & 0xFF) | ((this.#read(offset + 1) & 0xFF) << 8) | ((this.#read(offset + 2) & 0xFF) << 16) | ((this.#read(offset + 3) & 0xFF) << 24)
            : ((this.#read(offset) & 0xFF) << 24) | ((this.#read(offset + 1) & 0xFF) << 16) | ((this.#read(offset + 2) & 0xFF) << 8) | (this.#read(offset + 3) & 0xFF);

        this.#offset += 4;
        return value;
    }

    /**
     * Reads a unsigned long from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The unsigned long read from the buffer.
     */
    readULong(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        /** @type {number} */
        let value = littleEndian
            ? (this.#read(offset) & 0xFF) | ((this.#read(offset + 1) & 0xFF) << 8) | ((this.#read(offset + 2) & 0xFF) << 16) | ((this.#read(offset + 3) & 0xFF) << 24) | ((this.#read(offset + 4) & 0xFF) << 32) | ((this.#read(offset + 5) & 0xFF) << 40) | ((this.#read(offset + 6) & 0xFF) << 48) | ((this.#read(offset + 7) & 0xFF) << 56)
            : ((this.#read(offset) & 0xFF) << 56) | ((this.#read(offset + 1) & 0xFF) << 48) | ((this.#read(offset + 2) & 0xFF) << 40) | ((this.#read(offset + 3) & 0xFF) << 32) | ((this.#read(offset + 4) & 0xFF) << 24) | ((this.#read(offset + 5) & 0xFF) << 16) | ((this.#read(offset + 6) & 0xFF) << 8) | (this.#read(offset + 7) & 0xFF);

        this.#offset += 8;
        return (value < 0) ? value + Math.pow(2, 64) : value;
    }

    /**
     * Reads a long from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The long read from the buffer.
     */
    readLong(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        /** @type {number} */
        let value = littleEndian
            ? (this.#read(offset) & 0xFF) | ((this.#read(offset + 1) & 0xFF) << 8) | ((this.#read(offset + 2) & 0xFF) << 16) | ((this.#read(offset + 3) & 0xFF) << 24) | ((this.#read(offset + 4) & 0xFF) << 32) | ((this.#read(offset + 5) & 0xFF) << 40) | ((this.#read(offset + 6) & 0xFF) << 48) | ((this.#read(offset + 7) & 0xFF) << 56)
            : ((this.#read(offset) & 0xFF) << 56) | ((this.#read(offset + 1) & 0xFF) << 48) | ((this.#read(offset + 2) & 0xFF) << 40) | ((this.#read(offset + 3) & 0xFF) << 32) | ((this.#read(offset + 4) & 0xFF) << 24) | ((this.#read(offset + 5) & 0xFF) << 16) | ((this.#read(offset + 6) & 0xFF) << 8) | (this.#read(offset + 7) & 0xFF);

        this.#offset += 8;
        return value;
    }

    /**
     * Reads a float from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The float read from the buffer.
     */
    readFloat(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

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
        return view.getFloat32(0, littleEndian);
    }

    /**
     * Reads a double from the buffer at the specified offset.
     *
     * @param {boolean} littleEndian Whether the value should be read as a little-endian value.
     * @param {number} offset The offset of the buffer to read from.
     * @returns {number} The double read from the buffer.
     */
    readDouble(littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

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
    readString(charSet = CharSets.UTF8, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        let length = this.readUShort(littleEndian, offset);
        offset += 2;

        /** @type {number[]} */
        let strBytes = [];
        for (let i = 0; i < length; i++) {
            strBytes.push(this.#read(offset + i));
        }

        let encoder = new Encoder(charSet);
        let value = encoder.decode(strBytes, littleEndian);

        this.#offset += value.length;
        return value;
    }

    /**
     * Writes a boolean to the buffer at the specified offset.
     *
     * @param {boolean} value The boolean to write to the buffer.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeBoolean(value, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (Buffer.MAX_SIZE - offset < 1) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        this.#write(value ? 1 : 0, offset);
        this.#offset += 1;
    }

    /**
     * Writes a unsigned byte to the buffer at the specified offset.
     *
     * @param {number} value The unsigned byte to write to the buffer.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeUByte(value, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < 0 || value > 255) {
            throw new Error(`Invaild value for type: unsigned byte. Value must be between 0 and 255. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 1) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        let byte = (value & 0xFF);
        this.#write(byte, offset);
        this.#offset += 1;
    }

    /**
     * Writes a byte to the buffer at the specified offset.
     *
     * @param {number} value The byte to write to the buffer.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeByte(value, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < -128 || value > 127) {
            throw new Error(`Invaild value for type: byte. Value must be between -128 and 127. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 1) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 1) {
            this.#offset = offset;
        }

        let byte = (value & 0xFF);
        this.#write(byte, offset);
        this.#offset += 1;
    }

    /**
     * Writes a unsigned short to the buffer at the specified offset.
     *
     * @param {number} value The unsigned short to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeUShort(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < 0 || value > 65_535) {
            throw new Error(`Invaild value for type: unsigned short. Value must be between 0 and 65,535. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 2) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        for (let i = 0; i < 2; i++) {
            let byte = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((1 - i) * 8)) & 0xFF);

            this.#write(byte, offset + i);
        }
        this.#offset += 2;
    }

    /**
     * Writes a short to the buffer at the specified offset.
     *
     * @param {number} value The short to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeShort(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < -32_768 || value > 32_767) {
            throw new Error(`Invaild value for type: short. Value must be between -32,768 and 32,767. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 2) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        for (let i = 0; i < 2; i++) {
            let byte = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((1 - i) * 8)) & 0xFF);

            this.#write(byte, offset + i);
        }
        this.#offset += 2;
    }

    /**
     * Writes a unsigned integer to the buffer at the specified offset.
     *
     * @param {number} value The unsigned integer to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeUInt(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < 0 || value > 4_294_967_295) {
            throw new Error(`Invaild value for type: unsigned int. Value must be between 0 and 4,294,967,295. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 4) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        for (let i = 0; i < 4; i++) {
            let byte = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((3 - i) * 8)) & 0xFF);

            this.#write(byte, offset + i);
        }
        this.#offset += 4;
    }

    /**
     * Writes a integer to the buffer at the specified offset.
     *
     * @param {number} value The integer to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeInt(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < -2_147_483_648 || value > 2_147_483_647) {
            throw new Error(`Invaild value for type: int. Value must be between -2,147,483,648 and 2,147,483,647. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 4) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        for (let i = 0; i < 4; i++) {
            let byte = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((3 - i) * 8)) & 0xFF);

            this.#write(byte, offset + i);
        }
        this.#offset += 4;
    }

    /**
     * Writes a unsigned long to the buffer at the specified offset.
     *
     * @param {number} value The unsigned long to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeULong(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < 0 || value > 18_446_744_073_709_551_615n) {
            throw new Error(`Invaild value for type: unsigned long. Value must be between 0 and 18,446,744,073,709,551,615. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 8) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        for (let i = 0; i < 8; i++) {
            let byte = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((7 - i) * 8)) & 0xFF);

            this.#write(byte, offset + i);
        }
        this.#offset += 8;
    }

    /**
     * Writes a long to the buffer at the specified offset.
     *
     * @param {number} value The long to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeLong(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < -9_223_372_036_854_775_808n || value > 9_223_372_036_854_775_807n) {
            throw new Error(`Invaild value for type: long. Value must be between -9,223,372,036,854,775,808 and 9,223,372,036,854,775,807. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 8) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        for (let i = 0; i < 8; i++) {
            let byte = littleEndian
                ? ((value >> (i * 8)) & 0xFF)
                : ((value >> ((7 - i) * 8)) & 0xFF);

            this.#write(byte, offset + i);
        }
        this.#offset += 8;
    }

    /**
     * Writes a float to the buffer at the specified offset.
     *
     * @param {number} value The float to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeFloat(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < (1.4 * Math.pow(10, -45)) || value > (3.4 * Math.pow(10, 38))) {
            throw new Error(`Invaild value for type: float. Value must be between ${1.4 * Math.pow(10, -45)} and ${3.4 * Math.pow(10, 38)}. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 4) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);

        view.setFloat32(0, value, littleEndian);
        let bytes = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            this.#write(/** @type {number} */ (bytes[i]), offset + i);
        }
        this.#offset += 4;
    }

    /**
     * Writes a double to the buffer at the specified offset.
     *
     * @param {number} value The double to write to the buffer.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value.
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeDouble(value, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (value < (4.9 * Math.pow(10, -324)) || value > (1.8 * Math.pow(10, 308))) {
            throw new Error(`Invaild value for type: double. Value must be between ${4.9 * Math.pow(10, -324)} and ${1.8 * Math.pow(10, 308)}. Got: ${value}`);
        }

        if (Buffer.MAX_SIZE - offset < 8) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 2) {
            this.#offset = offset;
        }

        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);

        view.setFloat64(0, value, littleEndian);
        let bytes = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
            this.#write(/** @type {number} */ (bytes[i]), offset + i);
        }
        this.#offset += 8;
    }

    /**
     * Writes a string to the buffer at the specified offset.
     *
     * @param {string} value The string to write to the buffer.
     * @param {CharSets} charSet The character set of the string.
     * @param {boolean} littleEndian Whether the value should be written as a little-endian value. (Only applicable for UTF-16)
     * @param {number} offset The offset of the buffer to write to.
     * @returns {void}
     */
    writeString(value, charSet = CharSets.UTF8, littleEndian = false, offset = this.#offset) {
        if (this.#isClosed) {
            throw new Error("Unable to do operation. Buffer is closed!");
        }

        if (Buffer.MAX_SIZE - offset < (value.length + 2)) {
            throw new Error("Buffer Overflow! Failed to write to buffer, not enough space.");
        }

        if (arguments.length > 3) {
            this.#offset = offset;
        }

        let encoder = new Encoder(charSet);
        let bytes = encoder.encode(value, littleEndian);

        for (let i = 0; i < bytes.length; i++) {
            this.#write(/** @type {number} */ (bytes[i]), offset + i);
        }
        this.#offset += bytes.length;
    }

    /**
     * @param {number} offset
     * @returns {number}
     */
    #read(offset = this.#offset) {
        let [blockX, blockZ, blockSlot] = this.getOffsetLocation(offset);

        let dataBlock = /** @type {Block} */ (world.getDimension(this.#dimension).getBlock({x:blockX, y:this.#dimensionMinY, z:blockZ}));

        if (dataBlock.typeId != "minecraft:barrel") {
            throw new Error("Offset out of bounds. Nothing to read at: " + offset);
        }

        let dataSlot = /** @type {ItemStack} */ (/** @type {Container} */ (/** @type {BlockInventoryComponent} */ (dataBlock.getComponent("inventory")).container).getItem(blockSlot));

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

    /**
     * @param {number} value
     * @param {number} offset
     * @returns {void}
     */
    #write(value, offset = this.#offset) {
        let [blockX, blockZ, blockSlot] = this.getOffsetLocation(offset);

        let dataBlock = /** @type {Block} */ (world.getDimension(this.#dimension).getBlock({x:blockX, y:this.#dimensionMinY, z:blockZ}));

        if (dataBlock.typeId != "minecraft:barrel") {
            world.getDimension(this.#dimension).setBlockPermutation({x:blockX, y:this.#dimensionMinY, z:blockZ}, BlockPermutation.resolve("minecraft:barrel", {"facing_direction": 0}));
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

        /** @type {Container} */ (/** @type {BlockInventoryComponent} */ (dataBlock.getComponent("inventory")).container).setItem(blockSlot, itemStack);
    }
}
