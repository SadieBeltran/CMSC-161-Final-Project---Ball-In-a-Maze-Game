#ifdef GL_ES
precision highp float;
#endif
//called in line 280, concerned with animation
// sampler2d is a random access array in a shader
uniform sampler2D position; //0
uniform sampler2D velocity; //1
uniform sampler2D obstacles; //2
uniform int derivative; //0
uniform vec2 scale; //scale of world?
uniform float random; //a random number
uniform vec2 gravity; //[0, -0.05] <- just a fixed number where the ball goes down the y axis
uniform vec2 wind; //[0,0] affects direction where ball goes
uniform float restitution; //float unsure what's used for
uniform vec2 worldsize; //i assume this is used to check world bounds
varying vec2 index; // doesn't look like it receives anything when called, maybe this is inherited from quad.vert?

const float BASE = 255.0;
const float OFFSET = BASE * BASE / 2.0;

float decode(vec2 channels, float scale) {
    return (dot(channels, vec2(BASE, BASE * BASE)) - OFFSET) / scale;
}

vec2 encode(float value, float scale) {
    value = value * scale + OFFSET;
    float x = mod(value, BASE);
    float y = floor(value / BASE);
    return vec2(x, y) / BASE;
}

void updatePosition(inout vec2 p, inout vec2 v, vec2 obstacle) {
    p += v + wind; //v + wind
    if (p.y <= 0.0 || p.x < 0.0 || p.x > worldsize.x) {
        /* Left the world, reset particle. */
        p.y += worldsize.y + random + (index.y - 0.5) * sign(random);
        p.x = mod(p.x + random * 10.0, worldsize.x);
    }
    if (length(obstacle) > 0.5) {
        p -= v;        // back out velocity change
        p += obstacle; // push out out obstacle
    }
}

void updateVelocity(inout vec2 p, inout vec2 v, vec2 obstacle) {
    v += gravity;
    if (p.y + v.y < -1.0) {
        /* Left the world, reset particle. */
        v.x = v.x + random / 2.0 + (index.x - 0.5) * sign(random);
        v.y = 0.0;
    }
    if (length(obstacle) > 0.5) {
        if (length(v) < 0.5) {
            v = obstacle * 0.5; // velocity too low, jiggle outward
        } else {
            v = reflect(v, obstacle) * restitution; // bounce
        }
    }
}

void main() {
    vec4 psample = texture2D(position, index); //get texture at position
    vec4 vsample = texture2D(velocity, index); //get texture at velocity
    
    vec2 p = vec2(decode(psample.rg, scale.x), decode(psample.ba, scale.x)); 
    //a vec containing the dotproduct of the position vector and an OFFSET vector (OFFSET, OFFSET^2) subtracted by OFFSET then divided by scale.
    //psample red-green channels of texture, according to the book of shaders, it's accessing vector.xy
    //in this vector scale is scale of X
    //and the dotproduct of psample.zw, with scale.x
    //i think it gets the xposition and 
    vec2 v = vec2(decode(vsample.rg, scale.y), decode(vsample.ba, scale.y));
    //same thing here but with velocity and y because... *jazz hands* gravity    
    
    vec2 obstacle = (texture2D(obstacles, p / worldsize).xy - 0.5) * 2.0;
    //sample obstacles. gonna need to store the maze verts in here
    vec2 result; //var dec
    float s; //var dec
    if (derivative == 0) { //change == 0 (if-else statement to check if this is just declaration)
        updatePosition(p, v, obstacle);
        result = p;
        s = scale.x;
    } else {
        updateVelocity(p, v, obstacle);
        result = v;
        s = scale.y;
    }
    //result contains the position and velocity i thnk
    gl_FragColor = vec4(encode(result.x, s), encode(result.y, s));
}
