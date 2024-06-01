/*
 * For establishing world
 */


/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} nparticles initial particle count
 * @param {size} [size=5] particle size in pixels
 * @constructor
 */
function Particles(){
    // Starts the world canvas
    var igloo = this.igloo = new Igloo(canvas),
        gl = igloo.gl,
        w = canvas.width, h = canvas.height;
    gl.disable(gl.DEPTH_TEST); //no z
    
    //defines the world size and assigns to worldsize func
    this.worldsize = new Float32Array([w,h]);
    var scale = Math.floor(Math.pow(Particles.BASE, 2) / Math.max(w, h) / 3);
    this.scale = [scale, scale * 100];
    this.listeners = []; //??

    /* Drawing parameters. */
    this.size = size || 5; //size of particles
    this.color = [0.14, 0.62, 1, 0.6]; // colors of particles
    this.obstacleColor = [0.45, 0.35, 0.25, 1.0]; //obstacle color

    /* Simulation parameters. */
    this.running = false;
    this.gravity = [0, -0.05];
    this.wind = [0, 0];
    this.restitution = 0.25;
    this.obstacles = [];

    
}