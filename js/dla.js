var stats, scene, camera, renderer, controls;
var worker = new Worker('js/worker.js');
var geometry, pointcloud;
var nParticles = 30000, nextParticleIndex;
var spawnRadiusLimit = 140;
var sphere;
var container;
var chart;
var doReset = false;

var params = {
    nParticlesPSec: 10,
    particleSize: 1.0,
    displayFog: true,
    displayBoundary: false,
    displayDFrac: true,
    reset: registerReset
};

function init_gui(container){
    var gui = new dat.GUI({ autoPlace: false });

    // particles per sec
    var controller = gui.add(params, "nParticlesPSec", 0, 1000);
    controller.name("Particles/sec");
    controller.step(1);

    // particles per sec
    controller = gui.add(params, "particleSize", 0.2, 2.0);
    controller.name("Sprite size");
    controller.onChange(function(value) {
        pointcloud.material.size = value;
    });

    // fog toggle
    controller = gui.add(params, "displayFog");
    controller.onChange(function(value) {
        scene.fog.density = value?0.004:0.0;
    });
    controller.name("Display fog");

    // boundary toggle
    controller = gui.add(params, "displayBoundary");
    controller.onChange(function(value) {
        sphere.visible = value;
    });
    controller.name("Display boundary");

    // Chart toggle
    controller = gui.add(params, "displayDFrac");
    controller.onChange(function(value) {
        document.getElementById('chart').style.visibility = value?'visible':'hidden';
    });
    controller.name("Display chart");

    // reset button
    gui.add(params, "reset");

    gui.domElement.id = 'datGui';
    container.appendChild(gui.domElement);
}

function onWindowResize() {
    camera.aspect = container.clientWidth/container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.clientWidth, container.clientHeight );
    render();
}

function registerReset(){
    doReset = true;
}

function reset(){
    doReset = false;
    for(var i=0; i<nParticles; ++i)
        pointcloud.geometry.vertices[i].fromArray([99999, 99999, 99999]);
    pointcloud.geometry.vertices[0].fromArray([0,0,0]);
    pointcloud.geometry.verticesNeedUpdate = true;
    nextParticleIndex = 1;
    chart.series[0].setData([]);
    params.reset = registerReset;
    worker.postMessage({ mode: 'init', spawnRadiusLimit: spawnRadiusLimit, nMax: nParticles });
    worker.postMessage({ mode: '', nParticlesPSec: params.nParticlesPSec });
}

function init() {
    container = document.getElementById('glContainer');

    // GUI overlay
    init_gui(container);

    // renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( container.clientWidth, container.clientHeight );
    container.appendChild( renderer.domElement );
    window.addEventListener( 'resize', onWindowResize, false );

    // camera and controls
    camera = new THREE.PerspectiveCamera( 75, container.clientWidth/container.clientHeight, 0.1, 1000 );
    camera.position.set(2,4,6);
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.damping = 0.2;
    controls.addEventListener( 'change', render );

    // scene and boundary
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2( 0x000000, 0.004 );
    geometry = new THREE.SphereGeometry( spawnRadiusLimit-10, 16, 16 );
    material = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
    sphere = new THREE.EdgesHelper(  new THREE.Mesh( geometry, material ), 0x0666666 );
    sphere.visible = params.displayBoundary;
    scene.add( sphere );

    // init point geometry
    geometry = new THREE.Geometry();
    for(var i=0; i<nParticles; ++i){
        geometry.vertices.push( new THREE.Vector3(99999,99999,99999) );
        geometry.colors[i] = new THREE.Color();
        geometry.colors[i].setHSL( i/nParticles, 1, 0.5 );
    }
    nextParticleIndex = 1;
    geometry.vertices[0].set(0,0,0);
    var sprite = THREE.ImageUtils.loadTexture( "gfx/sphere4.png" );
    //sprite.generateMipmaps = false;
    //sprite.minFilter = THREE.NearestFilter;
    //sprite.magFilter = THREE.NearestFilter;
    var material = new THREE.PointCloudMaterial( { size:1.1, map: sprite, alphaTest: 0.5, vertexColors: THREE.VertexColors } );
    pointcloud = new THREE.PointCloud( geometry, material );
    scene.add( pointcloud );

    // worker
    worker.onmessage = function(response) {
        if(doReset)
            reset();
        else if(response.data.type=="debug"){
            console.log(response.data.msg);
        }
        else if(!(response.data.goOn)){
            console.log("end detected.");
            params.reset = reset;
        }
        else{
            for(var i=0; i< response.data.positions.length; ++i){
                pointcloud.geometry.vertices[nextParticleIndex].fromArray(response.data.positions[i]);
                nextParticleIndex++;
            }
            pointcloud.geometry.verticesNeedUpdate = true;

            var dFrac = Math.log(nextParticleIndex)/Math.log(response.data.maxParticleDistanceS/2);
            if( dFrac<5 && dFrac>1 && (response.data.positions.length>0)){
                chart.series[0].addPoint(dFrac);
                if(chart.series[0].data.length>50)
                    chart.series[0].removePoint(0);
            }
            worker.postMessage({ mode: '', nParticlesPSec: params.nParticlesPSec });
        }
    };

    worker.postMessage({
        mode: 'init',
        spawnRadiusLimit: spawnRadiusLimit,
        nMax: nParticles });
    worker.postMessage({ mode: '', nParticlesPSec: params.nParticlesPSec });

    // chart
    var chartOptions = {
        tooltip: { enabled: false },
        chart: {
            renderTo: 'chart',
            type: 'line',
            backgroundColor: "rgba(255,255,255,0.1)",
            height: 150,
            animation: false
        },
        plotOptions: {
            line: {
                marker: {
                    enabled: false },
                states: {
                    hover: {
                        enabled: false
                    } } }
        },
        title: {
            text: 'Fractal Dimension',
            style: { "color": "#ffffff", "fontSize": "12px" } },
        xAxis: {
            labels:{
                enabled: false } },
        yAxis: {
            title: {
                text: '' },
            labels:{
                style: {"color":"#ffffff","fontWeight":"bold"} } },
        series: [{
            name: 'dFrac',
            data: []
        }],
        legend: {
            enabled: false },
        credits: {
            enabled: false }
    };
    chart = new Highcharts.Chart(chartOptions);
    animate();
}

function animate() {
    requestAnimationFrame( animate );
    controls.update();
    render();
}

function render() {
    renderer.render( scene, camera );
}
