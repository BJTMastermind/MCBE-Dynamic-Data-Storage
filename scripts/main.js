import { system, world } from "@minecraft/server"
import Buffer from "./buffer.js"

let read = false;
let write = false;
let clear = false;

world.beforeEvents.chatSend.subscribe((event) => {
    switch (event.message) {
        case "!test read":
            event.cancel = true;
            read = true;
            break;
        case "!test write":
            event.cancel = true;
            write = true;
            break;
        case "!test clear":
            event.cancel = true;
            clear = true;
            break;
        default:
            break;
    }
});

system.runInterval(() => {
    if (read) {
        parseFile();
        read = false;
    }
    if (write) {
        writeFileTest();
        write = false;
    }
    if (clear) {
        world.getDimension("minecraft:overworld").runCommand("fill 0 -64 0 47 -64 47 air");
        clear = false;
    }
}, 40);

function writeFileTest() {
    let buffer = new Buffer("minecraft:overworld");

    let locations = [{x:5, y:-64, z:4}, {x:5, y:-64, z:5}];

    buffer.writeByte(20);
    buffer.writeShort(locations.length);

    for (let i = 0; i < locations.length; i++) {
        buffer.writeInt(locations[i].x);
        buffer.writeInt({twosComplement: true}, locations[i].y);
        buffer.writeInt(locations[i].z);
    }
}

function parseFile() {
    let buffer = new Buffer("minecraft:overworld");

    let header = buffer.readByte();

    if (header != 20) {
        console.error("Invalid header. Expected 20, got " + header);
        return;
    }

    let length = buffer.readShort();

    let locations = [];

    for (let i = 0; i < length; i++) {
        let x = buffer.readInt();
        let y = buffer.readInt({twosComplement: true});
        let z = buffer.readInt();

        locations.push({x, y, z});
    }

    for (let i = 0; i < locations.length; i++) {
        console.warn("["+locations[i].x+","+locations[i].y+","+locations[i].z+"]");
    }
}
