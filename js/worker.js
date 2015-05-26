importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/1.6.0/math.min.js');

var gridSize, offset;
var spawnRadius, spawnRadiusLimit, maxParticleDistance;
var position = [];
var latticeNB=[];
var t0=-1, t1=-1;
var nParticles, nParticlesLimit, nParticlesPSec=1;
var positions = [];
var countCurrent;
var updateInterval = 100;

function init(spawnRadiusLimitP){
    nParticles = 1;
    maxParticleDistance = 0.0;
    gridSize = spawnRadiusLimitP*2+1+40;
    offset = Math.floor(gridSize/2);
    spawnRadius = maxParticleDistance+10;

    if(latticeNB.length==0)
        latticeNB = new Array(gridSize * gridSize * gridSize);
    for (var i = 0; i < latticeNB.length; ++i)
        latticeNB[i] = 0;
    latticeNB[offset * gridSize * gridSize + offset * gridSize + (offset + 1)] = 1;
    latticeNB[offset * gridSize * gridSize + offset * gridSize + (offset - 1)] = 1;
    latticeNB[offset * gridSize * gridSize + (offset + 1) * gridSize + offset] = 1;
    latticeNB[offset * gridSize * gridSize + (offset - 1) * gridSize + offset] = 1;
    latticeNB[(offset + 1) * gridSize * gridSize + offset * gridSize + offset] = 1;
    latticeNB[(offset - 1) * gridSize * gridSize + offset * gridSize + offset] = 1;
}

function getStartPos(radius){
    // Simple alg for starting on a sphere: random position inside cube. Throw
    // away anything outside of sphere, then normalize.
    position[0] = math.random(-radius, radius);
    position[1] = math.random(-radius, radius);
    position[2] = math.random(-radius, radius);
    while((position[0]*position[0] + position[1]*position[1] + position[2]*position[2]) > (radius*radius)){
        position[0] = math.random(-radius, radius);
        position[1] = math.random(-radius, radius);
        position[2] = math.random(-radius, radius);
    }
    var length = Math.sqrt(position[0]*position[0] + position[1]*position[1] + position[2]*position[2]);
    position[0] = Math.floor(position[0]/length*radius);
    position[1] = Math.floor(position[1]/length*radius);
    position[2] = Math.floor(position[2]/length*radius);
    return position;
}

function getDockPos(){
    // start somewhere on a sphere from the origin
    position = getStartPos(spawnRadius);
    var startBackup = position.slice();

    // walk until on neighbor site
    while(latticeNB[(position[0]+offset)*gridSize*gridSize + (position[1]+offset)*gridSize + (position[2]+offset)] == 0){
        var directionChoice = math.randomInt(3);

        // one step into any direction
        if(directionChoice == 0)
            position[0] += math.randomInt(2)*2-1;
        else if(directionChoice == 1)
            position[1] += math.randomInt(2)*2-1;
        else
            position[2] += math.randomInt(2)*2-1;

        // run out of sphere? back to initial start
        if( (position[0]*position[0] + position[1]*position[1] + position[2]*position[2]) > Math.pow(spawnRadius+20,2) )
            position = startBackup.slice();
    }

    // mark neighbor spots of found position
    latticeNB[(position[0]+offset  )*gridSize*gridSize + (position[1]+offset  )*gridSize + (position[2]+offset+1)] = 1;
    latticeNB[(position[0]+offset  )*gridSize*gridSize + (position[1]+offset  )*gridSize + (position[2]+offset-1)] = 1;
    latticeNB[(position[0]+offset  )*gridSize*gridSize + (position[1]+offset+1)*gridSize + (position[2]+offset  )] = 1;
    latticeNB[(position[0]+offset  )*gridSize*gridSize + (position[1]+offset-1)*gridSize + (position[2]+offset  )] = 1;
    latticeNB[(position[0]+offset+1)*gridSize*gridSize + (position[1]+offset  )*gridSize + (position[2]+offset  )] = 1;
    latticeNB[(position[0]+offset-1)*gridSize*gridSize + (position[1]+offset  )*gridSize + (position[2]+offset  )] = 1;

    // new biggest distance?
    var radius2 = position[0]*position[0] + position[1]*position[1] + position[2]*position[2];
    if( radius2 > (maxParticleDistance*maxParticleDistance) ){
        maxParticleDistance = Math.sqrt(radius2);
        spawnRadius = maxParticleDistance+15;
    }
    return position;
}

function respond(doMore){
    self.postMessage({
        type: 'result',
        positions: positions,
        maxParticleDistanceS: maxParticleDistance,
        goOn: doMore
    });
    t0 = performance.now();
    positions = [];
}

self.addEventListener('message', function(response) {
    if(response.data.mode == 'init'){
        //self.postMessage({ type: "debug", msg: "init" });
        nParticlesLimit = response.data.nMax;
        init(response.data.spawnRadiusLimit);
        spawnRadiusLimit = response.data.spawnRadiusLimit;
        t0 = performance.now();
    }
    else{
        //self.postMessage({ type: "debug", msg: "test" });
        t0 = performance.now();
        t1 = t0;
        countCurrent = 0;
        nParticlesPSec = response.data.nParticlesPSec;
        var goOn = true;
        while(!((t1-t0) > updateInterval || !(goOn) || countCurrent>=(nParticlesPSec/(1000/updateInterval)))){
            positions.push(getDockPos(spawnRadius).slice());
            nParticles++;
            countCurrent++;
            t1 = performance.now();
            goOn = !(spawnRadius>spawnRadiusLimit || nParticles>=nParticlesLimit);
        }

        if((t1-t0) > updateInterval)
            respond(goOn);
        else
            setTimeout(function() { respond(goOn); }, updateInterval);
    }
});
