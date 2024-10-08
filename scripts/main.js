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
        writeFile();
        write = false;
    }
    if (clear) {
        clearFile();
        clear = false;
    }
}, 40);

function writeFile() {
    let buffer = new Buffer();

    let locations = [{x:5, y:-64, z:4}, {x:5, y:-64, z:5}];

    buffer.writeByte({value: 20});
    buffer.writeShort({value: locations.length});

    for (let i = 0; i < locations.length; i++) {
        buffer.writeInt({value: locations[i].x});
        buffer.writeInt({value: locations[i].y});
        buffer.writeInt({value: locations[i].z});
    }
}

function parseFile() {
    let buffer = new Buffer();

    let header = buffer.readByte();

    if (header != 20) {
        console.error("Invalid header. Expected 20, got " + header);
        return;
    }

    let length = buffer.readShort();

    let locations = [];

    for (let i = 0; i < length; i++) {
        let x = buffer.readInt();
        let y = buffer.readInt();
        let z = buffer.readInt();

        locations.push({x, y, z});
    }

    for (let i = 0; i < locations.length; i++) {
        console.warn("["+locations[i].x+","+locations[i].y+","+locations[i].z+"]");
    }
}

function clearFile() {
    let buffer = new Buffer();
    buffer.clear();
}
