# Minecraft: Bedrock Edition Dynamic Data Storage

A library that allows you to read and write data into a multiple shulker box based buffer for uses with the scripting API.

## How To Use

First install the library to your project with:

```sh
npm install https://github.com/BJTMastermind/MCBE-Dynamic-Data-Storage#1.0.0
```

then to use the library in your project import the `Buffer` class with:

```sh
import Buffer from "@bjtmastermind/dynamic-data-storage/scripts/buffer";

# When working with UTF-16 strings you will also want to import CharSets
import { CharSets } from "@bjtmastermind/dynamic-data-storage/scripts/utils/charsets.js";
```

Now that you have it imported you will have the following methods avalible to use:

***Stable***

```js
// creating buffer instance
let buffer = new Buffer();

// reading
buffer.readBoolean();
buffer.readUByte();
buffer.readByte();
buffer.readUShort();
buffer.readShort();
buffer.readUInt();
buffer.readInt();
buffer.readULong();
buffer.readLong();
buffer.readFloat();
buffer.readDouble();
buffer.readString();

// writing
buffer.writeBoolean();
buffer.writeUByte();
buffer.writeByte();
buffer.writeUShort();
buffer.writeShort();
buffer.writeUInt();
buffer.writeInt();
buffer.writeULong();
buffer.writeLong();
buffer.writeFloat();
buffer.writeDouble();
buffer.writeString();

// other
buffer.MAX_SIZE;
buffer.clear();
buffer.getDimension();
buffer.getOffset();
buffer.getOffsetLocation();
buffer.setOffset();
```

***Experimental***

```js
buffer.close();
buffer.delete();
buffer.save();
buffer.load();
```

All methods have doc strings for extra details about how to use them and what they are for.

***For Devs***

All data written from this library is stored in a 48x48 area under X0,Z0 at the bottom of the world in the dimension it was told to be saved in. (Defaults to the overworld)

## Language(s) Used

* Javascript 2024
* Node v21.7.3
