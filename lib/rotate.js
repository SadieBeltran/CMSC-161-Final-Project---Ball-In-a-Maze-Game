/**
 * Updates modelMatrix for rotation based on keypressed
 * 
 * @param {mat4} modelMatrix matrix to manipulate/update
 * @param {mat4} ballModelMatrix matrix to manipulate/update
 * @param {function} callback function to call after updating (drawScene)
 * @param {function} rotate function to use for rotating (mat4.rotate)
 * @param {function} translate function to use for rotating (mat4.rotate)
 * @returns {mat4} updated modelMatrix
 */

function rotateListener(modelMatrix, ballModelMatrix, callback, rotate, translate) {
  const RAD = 0.01;
  const MAXROTATION = 0.3; // Maximum rotation in radians (30% of a full circle)
  let rotationX = 0; // Cumulative rotation around the X-axis
  let rotationZ = 0; // Cumulative rotation around the Z-axis
  const activeKeys = new Set();
  var velocity = [0, 0, 0, 0];
  var speed = 0.001;
  let isAnimating = false;

  // Handle keydown events
  document.addEventListener("keydown", (event) => {
    if (event.isComposing || activeKeys.has(event.key)) {
      return;
    }
    // console.log(event.key)
    activeKeys.add(event.key);
    startAnimation();
  });

  // Handle keyup events
  document.addEventListener("keyup", (event) => {
    activeKeys.delete(event.key);
    if (activeKeys.size === 0) {
      stopAnimation();
    }
  });

  function updateModelMatrix() {
    activeKeys.forEach(key => {
      switch (key) {
        case "ArrowUp":
          velocity[1] += speed;
          translate(ballModelMatrix, ballModelMatrix, velocity);
          break;
        case "w":
        case "W":
          if (rotationX < MAXROTATION) {
            rotate(modelMatrix, modelMatrix, -RAD, [1, 0, 0]);
            rotationX += RAD;
          }
          break;
        case "ArrowDown":
          velocity[1] -= speed;
          translate(ballModelMatrix, ballModelMatrix, velocity);
          break;
        case "s":
        case "S":
          if (rotationX > -MAXROTATION) {
            rotate(modelMatrix, modelMatrix, RAD, [1, 0, 0]);
            rotationX -= RAD;
          }
          break;
        case "ArrowLeft":
          velocity[0] += speed;
          translate(ballModelMatrix, ballModelMatrix, velocity);
          break;
        case "a":
        case "A":
          if (rotationZ < MAXROTATION) {
            rotate(modelMatrix, modelMatrix, RAD, [0, 1, 0]);
            rotationZ += RAD;
          }
          break;
        case "ArrowRight":
          velocity[0] -= speed;
          translate(ballModelMatrix, ballModelMatrix, velocity);
          break;
        case "d":
        case "D":
          if (rotationZ > -MAXROTATION) {
            rotate(modelMatrix, modelMatrix, -RAD, [0, 1, 0]);
            rotationZ -= RAD;
          }
          break;
      }
    });
    callback();
  }

  function animationLoop() {
    if (!isAnimating) return;
    updateModelMatrix();
    requestAnimationFrame(animationLoop);
  }

  function startAnimation() {
    if (ballModelMatrix[12] < 1.6 && ballModelMatrix[12] > 1.4 && ballModelMatrix[13] < 1.15 && ballModelMatrix[13] > 1.11) {
      alert("HAPPY PRIDE MONTH! YOU WIN!!");
    }
    if (!isAnimating) {
      isAnimating = true;
      animationLoop();
    }
  }

  function stopAnimation() {
    isAnimating = false;
    velocity = [0, 0, 0, 0];
  }
}