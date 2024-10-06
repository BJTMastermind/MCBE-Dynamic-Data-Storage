import { world } from "@minecraft/server"
import Buffer from "./buffer.js"

world.afterEvents.worldInitialize.subscribe((event) => {
    if (world.getDimension("overworld").getBlock({x:0, y:-64, z:0}).typeId != "minecraft:air" && world.getDimension("overworld").getBlock({x:0, y:-64, z:0}).typeId != "minecraft:light_gray_shulker_box") {
        world.getDimension("overworld").runCommand("tickingarea add 0 -64 0 47 -64 47 \"dynamic-data-storage-area\"");
        world.getDimension("overworld").runCommand("fill 0 -64 0 47 -64 47 air");
        world.getDimension("overworld").runCommand("fill 0 -63 0 47 -63 47 bedrock");
    }

    parseFile();
    // writeFileTest();
});

function writeFileTest() {
    let buffer = new Buffer("minecraft:overworld");

    for (let i = 0; i < Buffer.MAX_SIZE; i += 2) {
        buffer.writeShort({twosComplement: true}, -1);
    }
}

function parseFile() {
    // let start = Date.now();
    let buffer = new Buffer("minecraft:overworld");
    buffer.clear();

    // for (let i = 0; i < Buffer.MAX_SIZE; i += 2) {
    //     let value = buffer.readShort({twosComplement: true});
    // }

    // let end = Date.now();
    // console.warn(((end - start) / 1000) + "s");

    // let length = buffer.readShort({offset: 54});
    // let value = buffer.readString(length);

    // console.warn(length);
    // console.warn(value);

    // let header = buffer.readByte();

    // if (header != 20) {
    //     console.error("Invalid header. Expected 20, got " + header);
    //     return;
    // }

    // let length = buffer.readShort();

    // let jukeboxLocations = [];

    // for (let i = 0; i < length; i++) {
    //     let x = buffer.readInt();
    //     let y = buffer.readInt({twosComplement: true});
    //     let z = buffer.readInt();

    //     jukeboxLocations.push({x, y, z});
    // }

    // for (let i = 0; i < jukeboxLocations.length; i++) {
    //     console.warn("["+jukeboxLocations[i].x+","+jukeboxLocations[i].y+","+jukeboxLocations[i].z+"]");
    // }
}
