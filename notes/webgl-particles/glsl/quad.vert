#ifdef GL_ES
precision highp float;
#endif

attribute vec2 quad; //aPosition equivalent
varying vec2 index; //looks like a local var

void main() {
    index = (quad + 1.0) / 2.0; //index, we add position vec by 1 then divide by 2 and change to a vec4
    //it's a vec2 because it only has x and y
    gl_Position = vec4(quad, 0, 1);
}
