/*global Igloo */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} nparticles initial particle count
 * @param {size} [size=5] particle size in pixels
 * @constructor
 */
function Particles(canvas, nparticles, size) {
    var igloo = this.igloo = new Igloo(canvas),
        gl = igloo.gl,
        w = canvas.width, h = canvas.height;
    gl.disable(gl.DEPTH_TEST);
    this.worldsize = new Float32Array([w, h]);
    var scale = Math.floor(Math.pow(Particles.BASE, 2) / Math.max(w, h) / 3);
    this.scale = [scale, scale * 100];
    this.listeners = [];

    /* Vertex shader texture access not guaranteed on OpenGL ES 2.0. */
    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) === 0) {
        var msg = 'Vertex shader texture access not available.' +
                'Try again on another platform.';
        alert(msg);
        throw new Error(msg);
    }

    /* Drawing parameters. */
    this.size = size || 5;
    this.color = [0.14, 0.62, 1, 0.6];
    this.obstacleColor = [0.45, 0.35, 0.25, 1.0];

    /* Simulation parameters. */
    this.running = false; //toggle animation variable
    this.gravity = [0, -0.05];
    this.wind = [0, 0];
    this.restitution = 0.25; //bounce coefficient
    this.obstacles = [];

    function texture() {
        return igloo.texture(null, gl.RGBA, gl.CLAMP_TO_EDGE, gl.NEAREST);
    }

    this.programs = {
        update:  igloo.program('glsl/quad.vert', 'glsl/update.frag'),
        draw:    igloo.program('glsl/draw.vert', 'glsl/draw.frag'),
        flat:    igloo.program('glsl/quad.vert', 'glsl/flat.frag'),
        ocircle: igloo.program('glsl/ocircle.vert', 'glsl/ocircle.frag')
    };
    this.buffers = {
        quad: igloo.array(Igloo.QUAD2), 
        //Igloo.QUAD2 = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]); vec in GL_Triangle_STRIP draw guessing it's normals?
        //buffer = gl.createBuffer()
        //gl.bufferData(buffer, QUAD2, gl.STATIC_DRAW)
        indexes: igloo.array(), //new array buffer with optional data
        point: igloo.array(new Float32Array([0, 0]))
    };
    this.textures = {
        p0: texture(), //gl.createTexture?
        p1: texture(),
        v0: texture(),
        v1: texture(),
        obstacles: igloo.texture().blank(w, h)
        //new 
        //blank(w,h)
        //gl.bindBuffer(gl.ARRAY_ELEM, gl.createBuffer())
        //gl.texImage2D(gl.TEXTURE_2D, 0, w, h, 0, gl.UNSIGNED_BYTE, null)
    };
    this.framebuffers = {
        step: igloo.framebuffer(), //gl.createFramebuffer()
        obstacles: igloo.framebuffer().attach(this.textures.obstacles) 
        //gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    };

    this.setCount(nparticles, true);
    this.addObstacle([w / 2, h / 2], 32);
}

/**
 * Encoding base.
 * @type {number}
 * @const
 */
Particles.BASE = 255;

/**
 * @param {number} value
 * @param {number} scale to maximize use of dynamic range
 * @returns {Array} the 2-byte encoding of VALUE
 */
Particles.encode = function(value, scale) {
    var b = Particles.BASE;
    value = value * scale + b * b / 2;
    var pair = [
        Math.floor((value % b) / b * 255),
        Math.floor(Math.floor(value / b) / b * 255)
    ];
    return pair;
};

/**
 * @param {Array} pair
 * @param {number} scale to maximize use of dynamic range
 * @returns {number} the value for the encoded PAIR
 */
Particles.decode = function(pair, scale) {
    var b = Particles.BASE;
    //255 because scale is 255^2
    return (((pair[0] / 255) * b +
             (pair[1] / 255) * b * b) - b * b / 2) / scale;
};

/**
 * Allocates textures and fills them with initial random state.
 * @returns {Particles} this
 */
Particles.prototype.initTextures = function() {
    var tw = this.statesize[0], th = this.statesize[1],
        w = this.worldsize[0], h = this.worldsize[1],
        s = this.scale,
        rgbaP = new Uint8Array(tw * th * 4),
        rgbaV = new Uint8Array(tw * th * 4);
    for (var y = 0; y < th; y++) {
        for (var x = 0; x < tw; x++) {
            var i = y * tw * 4 + x * 4,
                px = Particles.encode(Math.random() * w, s[0]),
                py = Particles.encode(Math.random() * h, s[0]),
                vx = Particles.encode(Math.random() * 1.0 - 0.5, s[1]),
                vy = Particles.encode(Math.random() * 2.5, s[1]);
            rgbaP[i + 0] = px[0];
            rgbaP[i + 1] = px[1];
            rgbaP[i + 2] = py[0];
            rgbaP[i + 3] = py[1];
            rgbaV[i + 0] = vx[0];
            rgbaV[i + 1] = vx[1];
            rgbaV[i + 2] = vy[0];
            rgbaV[i + 3] = vy[1];
        }
    }
    this.textures.p0.set(rgbaP, tw, th);
    this.textures.v0.set(rgbaV, tw, th);
    this.textures.p1.blank(tw, th);
    this.textures.v1.blank(tw, th);
    return this;
};


/**
 * Allocate array buffers and fill with needed values.
 * @returns {Particles} this
 */
Particles.prototype.initBuffers = function() {
    //eq of 
    /*  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
     */

    //tw = canvas width, th = canvas height ??
    var tw = this.statesize[0], th = this.statesize[1],
        gl = this.igloo.gl,
        //index array of size tw*th*2, we multiply it twice because we will be filling the array
        indexes = new Float32Array(tw * th * 2);
    for (var y = 0; y < th; y++) {
        for (var x = 0; x < tw; x++) {
            var i = y * tw * 2 + x * 2; //getting index
            //add indexes
            indexes[i + 0] = x; //add number 1...tw
            indexes[i + 1] = y; //add number 1...th
        }
    }
    this.buffers.indexes.update(indexes, gl.STATIC_DRAW); //load to buffer
    return this;
};

/**
 * Set a new particle count. This is a minimum and the actual count
 * may be slightly higher to fill out a texture.
 * @param {number} n
 * @returns {Particles} this
 */
Particles.prototype.setCount = function(n) {
    var tw = Math.ceil(Math.sqrt(n)),
        th = Math.floor(Math.sqrt(n));
    this.statesize = new Float32Array([tw, th]);
    this.initTextures();
    this.initBuffers();
    return this;
};

/**
 * @returns {number} the actual particle count
 */
Particles.prototype.getCount = function() {
    return this.statesize[0] * this.statesize[1];
};

/**
 * @returns {Array} list of all particle positions
 */
Particles.prototype.get = function() {
    var gl = this.igloo.gl;
    this.framebuffers.step.attach(this.textures.p0);
    var w = this.statesize[0], h = this.statesize[1],
        s = this.scale,
        rgba = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    var particles = [];
    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            var i = y * w * 4 + x * 4,
                px = Particles.decode([rgba[i + 0], rgba[i + 1]], s[0]),
                py = Particles.decode([rgba[i + 2], rgba[i + 3]], s[0]);
            particles.push({x: px, y: py});
        }
    }
    return particles;
};

/**
 * Swap the foreground and background state.
 * @returns {Particles} this
 */
Particles.prototype.swap = function() {
    var tmp = this.textures.p0;
    this.textures.p0 = this.textures.p1;
    this.textures.p1 = tmp;
    tmp = this.textures.v0;
    this.textures.v0 = this.textures.v1;
    this.textures.v1 = tmp;
    return this;
};

/**
 * Brings the obstacles texture up to date.
 * @returns {Particles} this
 */
Particles.prototype.updateObstacles = function() {
    var gl = this.igloo.gl;
    // gl.bindFramebuffer(gl.FRAMEBUFFER)
    this.framebuffers.obstacles.bind();
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, this.worldsize[0], this.worldsize[1]);
    gl.clearColor(0.5, 0.5, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (var i = 0; i < this.obstacles.length; i++) {
        var obstacle = this.obstacles[i];
        if (obstacle.enabled) {
            //add to buffer
            obstacle.program.use()
                .attrib('vert', obstacle.verts, 2)
                .uniform('position', new Float32Array(obstacle.position))
                .uniform('worldsize', this.worldsize)
                .uniform('size', obstacle.size)
                .draw(obstacle.mode, obstacle.length);
        }
    }
    return this;
};

/**
 * Introduces a new circle obstacle to the simulation. You can
 * continue to update the obstacle position, radius, etc. so long as
 * you call updateObstacles() afterwards.
 * @param {Array} center
 * @param {number} radius
 * @returns {Object} the obstacle object
 */
Particles.prototype.addObstacle = function(center, radius) {
    var igloo = this.igloo, gl = igloo.gl,
        w = this.worldsize[0], h = this.worldsize[1];
    var obstacle = {
        enabled: true,
        program: this.programs.ocircle,
        verts: this.buffers.point,
        position: center,
        size: radius,
        mode: gl.POINTS,
        length: 1
    };
    this.obstacles.push(obstacle);
    this.updateObstacles();
    return obstacle;
};

/**
 * Step the simulation forward by one iteration.
 * @returns {Particles} this
 */
Particles.prototype.step = function() {
    //i think
    var igloo = this.igloo, gl = igloo.gl;
    gl.disable(gl.BLEND);
    this.framebuffers.step.attach(this.textures.p1);
    this.textures.p0.bind(0);
    this.textures.v0.bind(1);
    this.textures.obstacles.bind(2);
    gl.viewport(0, 0, this.statesize[0], this.statesize[1]);
    //update updates the position of 
    this.programs.update.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniformi('position', 0) //in frag
        .uniformi('velocity', 1)
        .uniformi('obstacles', 2)
        .uniform('scale', this.scale)
        .uniform('random', Math.random() * 2.0 - 1.0)
        .uniform('gravity', this.gravity)
        .uniform('wind', this.wind)
        .uniform('restitution', this.restitution)
        .uniform('worldsize', this.worldsize)
        .uniformi('derivative', 0)
        .draw(gl.TRIANGLE_STRIP, Igloo.QUAD2.length / 2);
    this.framebuffers.step.attach(this.textures.v1);
    //this updates the velocity
    this.programs.update
        .uniformi('derivative', 1)
        .uniform('random', Math.random() * 2.0 - 1.0)
        .draw(gl.TRIANGLE_STRIP, Igloo.QUAD2.length / 2);
    this.swap();
    return this;
};

/**
 * Draw the current simulation state to the display.
 * @returns {Particles} this
 */
Particles.prototype.draw = function() {
    //looks like the equivalent of this is drawscene
    var igloo = this.igloo, gl = igloo.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    igloo.defaultFramebuffer.bind();
    gl.viewport(0, 0, this.worldsize[0], this.worldsize[1]); //size of viewport
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.textures.p0.bind(0); //binding textures
    this.textures.v0.bind(1);
    //equivalent of drawScene
    this.programs.draw.use() //in drawFrag
        .attrib('index', this.buffers.indexes, 2) //varying vec2, the 2 is the element size
        //gl.getUniformLocation(program, 'positions)
        //gl.uniform1i(positionspointer, 0)
        .uniformi('positions', 0) 
        .uniformi('velocities', 1)
        .uniform('statesize', this.statesize) //
        .uniform('worldsize', this.worldsize)
        .uniform('size', this.size)
        .uniform('scale', this.scale)
        .uniform('color', this.color)
        .draw(gl.POINTS, this.statesize[0] * this.statesize[1]);
    this.textures.obstacles.bind(2);
    this.programs.flat.use()
        .attrib('quad', this.buffers.quad, 2)
        .uniformi('background', 2)
        .uniform('color', this.obstacleColor)
        .uniform('worldsize', this.worldsize)
        .draw(gl.TRIANGLE_STRIP, Igloo.QUAD2.length / 2);
    return this;
};

/**
 * Register with requestAnimationFrame to step and draw a frame.
 * @returns {Particles} this
 */
Particles.prototype.frame = function() {
    window.requestAnimationFrame(function() {
        if (this.running) {
            this.step().draw().frame();
            for (var i = 0; i < this.listeners.length; i++) {
                this.listeners[i]();
            }
        }
    }.bind(this));
    return this;
};

/**
 * Start animating the simulation if it isn't already.
 * @returns {Particles} this
 */
Particles.prototype.start = function() {
    if (!this.running) {
        this.running = true;
        this.frame();
    }
    return this;
};

/**
 * Immediately stop the animation.
 * @returns {Particles} this
 */
Particles.prototype.stop = function() {
    this.running = false;
    return this;
};
