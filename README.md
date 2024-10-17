# Minecraft: Bedrock Edition Dynamic Data Storage

A library that allows you to read and write data into a multi-barrel based buffer for uses with the scripting API.

## How To Use

### Project Setup

> [!TIP]
> If you don't want to manually setup the project you can download it as a template from [BJTMastermind/Scripts-Behavior-Pack-Template](https://github.com/BJTMastermind/Scripts-Behavior-Pack-Template) (Currently JavaScript only)

First let's make the pack a node package, open your terminal and run:

```
node init
```

Follow the intructions, then you should have a `package.json` file in the root of the pack.

<details>
<summary>
Using <b>Typescript?</b>
<p></p>
</summary>

Install the `typescript` package, in your terminal run:

```
npm install -D typescript
```
</details>

Now let's setup `esbuild`, open your terminal and run:

```
npm install -D esbuild
```

If this is an existing behavior pack, rename your `scripts` folder to `src` to prevent esbuild from overriding your code. Otherwise create the `src` folder.

Create a new file called `esbuild.js` in the root of your pack and put the following contents in it.

<details>
<summary>
<code>esbuild.js</code> Contents
<p></p>
</summary>

```js
const esbuild = require("esbuild");

const external = [
    "@minecraft/common",
    "@minecraft/debug-utilities",
    "@minecraft/server-admin",
    "@minecraft/server-editor",
    "@minecraft/server-gametest",
    "@minecraft/server-net",
    "@minecraft/server-ui",
    "@minecraft/server",
    "@minecraft/vanilla-data",
    "@minecraft/math"
];

esbuild.build({
    entryPoints: ["src/index.js"],
    outfile: "scripts/main.js",
    bundle: true,
    format: "esm",
    external,
}).then(() => {
    console.log("Bundling finished!");
}).catch((error) => {
    console.error(error);
});
```
</details>

The folder structure should now look something like this:

```
My_Behavior_Pack
├── src/
│   ├── main.js
│   └── index.js    # Exports main.js and other source files in this directory
├── esbuild.js
├── package.json
└── manifest.json
```

### Installing And Using The Library

To install the library, open a terminal and run:

```sh
# install the latest version with:
npm install https://github.com/BJTMastermind/MCBE-Dynamic-Data-Storage
# or install specific version with:
npm install https://github.com/BJTMastermind/MCBE-Dynamic-Data-Storage#<version>
```

Then to use the library in your project import the `Buffer` class with:

```js
import Buffer from "@bjtmastermind/dynamic-data-storage/src/buffer";

// When working with UTF-16 strings you will also want to import CharSets
import { CharSets } from "@bjtmastermind/dynamic-data-storage/src/utils/charsets.js";
```

Now that you have it imported you will have the following methods avalible to use:

<details open>
<summary>
<b><i>Stable functions</i></b>
<p></p>
</summary>

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
</details>

<details>
<summary>
<b><i>Experimental (Deprecated) functions</i></b>
<p></p>
</summary>

```js
buffer.close();
buffer.delete();
buffer.save();
buffer.load();
```
</details>

All methods have doc strings for extra details about how to use them and what they are for.

Once your ready to test your scripts in-game, open your terminal in the root folder of your pack and run:

```
node esbuild.js
```

You should now have a `scripts` folder generated with a single file in it called `main.js` which the game will read from.

***For Devs***

All data written from this library is stored in a 48x48 area under X0,Z0 at the bottom of the world in the dimension it was told to be saved in. (Defaults to the overworld)

## Language(s) Used

* Javascript 2024
* Node v21.7.3
