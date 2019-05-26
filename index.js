let app = require('express')();
let http = require('http').createServer(app);
let io = require('socket.io')(http);

app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
});

http.listen('55555', () => {
    console.log('Listening on *:55555');
});

class Plyr {
    constructor (data) {
        this.x = data.x;
        this.y = data.y;
        this.r = 25;
        this.d = { x: 0, y: 0 }
        this.s = 5;
    }

    move(dir) {
        this.x += dir.x * this.s;
        this.y += dir.y * this.s;
    }

    isEating(oth) {
        let dx = this.x - oth.x;
        let dy = this.y - oth.y;
        let d2 = dx * dx + dy * dy;

        return d2 < this.r * this.r;
    }

    addVolume(v) {
        let A = Math.PI * this.r * this.r;
        this.r = Math.sqrt((A + v) / Math.PI);
    }
};

class Food {
    constructor (data) {
        this.x = data.x;
        this.y = data.y;
        this.v = Math.floor(100 + 50 * Math.random());
        this.r = 5 + 5 * Math.random();
    }
}

let WORLDLIMIT = 2000;
let MAXFOOD = 500;

let playersLists = [];

let players = new Map();
let food = [];
let blocks = [];

io.on('connection', socket => {
    console.log(`New connection: ${socket.id}`);
    playersLists.push(socket.id);

    players.set(socket.id,
        new Plyr({
            x: 2 * WORLDLIMIT * Math.random() - WORLDLIMIT,
            y: 2 * WORLDLIMIT * Math.random() - WORLDLIMIT
        })
    );

    socket.on('update', data => {
        let norm = Math.sqrt(data.x * data.x + data.y * data.y);
        let plyr = players.get(socket.id);

        plyr.move({
            x: data.x / norm,
            y: data.y / norm
        });
    });

    socket.on('disconnect', () => {
        console.log(`Connection closed: ${socket.id}`);
        playersLists = playersLists.filter(id => id != socket.id);
        players.delete(socket.id);
    });
});

let broadcast = () => {
    let data = {
        pl: playersLists,
        p: [...players],
        f: food,
        b: blocks
    };

    io.emit('broadcast', data);
};

let refill = () => {
    while (food.length < MAXFOOD) {
        let fd = new Food({
            x: 2 * WORLDLIMIT * Math.random() - WORLDLIMIT,
            y: 2 * WORLDLIMIT * Math.random() - WORLDLIMIT,
        })
        food.push(fd);
    }
};

let checkCollisions = () => {
    players.forEach(p => {
        for (let i = food.length - 1; i >= 0; i--) {
            if (p.isEating(food[i])) {
                p.addVolume(food[i].v);
                food.splice(i, 1);
            }
        }
    });

    for (let i = playersLists.length - 1; i >=0 ; i--) {
        for (let j = playersLists.length - 1; j >= 0; j--) {
            if (i == j) continue;

            let plyrA = players.get(playersLists[i]);
            let plyrB = players.get(playersLists[j]);

            if (plyrA.isEating(plyrB)) {
                let plyrBV = Math.PI * plyrB.r * plyrB.r;

                plyrA.addVolume(plyrBV);

                players.delete(playersLists[j]);

                players.set(playersLists[j], new Plyr({
                    x: 2 * WORLDLIMIT * Math.random() - WORLDLIMIT,
                    y: 2 * WORLDLIMIT * Math.random() - WORLDLIMIT
                }));
            }
        }
    }
};

let loopGame = () => {
    refill();
    checkCollisions();    
    broadcast();
};

setInterval(() => {
    loopGame()
}, 100);
