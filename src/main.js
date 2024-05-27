// Vertex shader program
var VSHADER_SOURCE = `
precision mediump float;
attribute vec4 a_Position;
attribute vec2 a_UV;
attribute vec3 a_Normal;
varying vec2 v_UV;
varying vec3 v_Normal;
varying vec4 v_VertPos;
uniform mat4 u_ModelMatrix;
uniform mat4 u_NormalMatrix;
uniform mat4 u_GlobalRotateMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjectionMatrix;

void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal,1)));
    v_VertPos = u_ModelMatrix * a_Position;
}
`
  ;

// Fragment shader program
var FSHADER_SOURCE = `
precision mediump float;
varying vec2 v_UV;
varying vec3 v_Normal;
varying vec4 v_VertPos;
uniform vec4 u_FragColor;
uniform sampler2D u_Sampler0;
uniform sampler2D u_Sampler1;
uniform sampler2D u_Sampler2;
uniform sampler2D u_Sampler3;
uniform sampler2D u_Sampler4;
uniform int u_whichTexture;
uniform vec3 u_cameraPos;
uniform bool u_lightOn;
uniform vec3 u_lightPos;
uniform vec3 u_spotLightPos;
uniform vec3 u_lightColor; 
uniform vec3 lightPosition;
uniform vec3 lightDirection;
uniform float lightInnerCutoff; // cos angle
uniform float lightOuterCutoff;

void main() {
    if (u_whichTexture == -3) {
        gl_FragColor = vec4(v_Normal + 1.0 / 2.0, 1.0); // use normal debug
    } else if (u_whichTexture == -2) {
        gl_FragColor = u_FragColor; // use color
    } else if (u_whichTexture == -1) {
        gl_FragColor = vec4(v_UV, 1.0, 1.0); // use uv debug color
    } else if (u_whichTexture == 0) {
        gl_FragColor = texture2D(u_Sampler0, v_UV); // use texture0
    } else if (u_whichTexture == 1) {
        gl_FragColor = texture2D(u_Sampler1, v_UV); // use texture1
    } else if (u_whichTexture == 2) {
        gl_FragColor = texture2D(u_Sampler2, v_UV); // use texture2
    } else if (u_whichTexture == 3) {
        gl_FragColor = texture2D(u_Sampler3, v_UV); // use texture3
    } else if (u_whichTexture == 4) {
        gl_FragColor = texture2D(u_Sampler4, v_UV); // use texture4
    } else {
        gl_FragColor = vec4(1, .2, .2, 1);
    }

    vec3 lightVector = u_lightPos - vec3(v_VertPos);
    float r = length(lightVector);

    // N dot L 
    vec3 L = normalize(lightVector);
    vec3 N = normalize(v_Normal);
    float nDotL = max(dot(N, L), 0.0);

    // reflection 
    vec3 R = reflect(-L, N);

    // eye 
    vec3 E = normalize(u_cameraPos - vec3(v_VertPos));

    // specular 
    float specular = pow(max(dot(E, R), 0.0), 64.0) * 0.8;

    vec3 diffuse = vec3(gl_FragColor) * nDotL * 0.7;
    vec3 ambient = vec3(gl_FragColor) * 0.3;

    vec3 spotLightDirection = vec3(0,-1,0);
    vec3 spotLightDiffuse = max(0.0, dot(spotLightDirection, normalize(v_Normal))) * vec3(gl_FragColor) * vec3(1.0, 0.0, 1.0);
    float angleToSurface = dot(-spotLightDirection, lightDirection);
    float cos = smoothstep(lightOuterCutoff, lightInnerCutoff, angleToSurface);
    diffuse += spotLightDiffuse * cos;

    if (u_lightOn) {
      if (u_whichTexture == 0) {
        gl_FragColor = vec4(diffuse+ambient, 1.0);
      } else {
        gl_FragColor = vec4(specular * u_lightColor + diffuse * u_lightColor + ambient, 1.0);
      }
    }

    if(u_lightOn) {
      if(u_whichTexture ==  0) {
        gl_FragColor = vec4(specular + diffuse + ambient, 1.0);
      } else {
        gl_FragColor = vec4(diffuse + ambient, 1.0);
      }
    }
}`;

// GLSL stuff
let canvas;
let gl;
let a_Position;
let a_UV;
let u_FragColor;
let u_ModelMatrix;
let u_GlobalRotateMatrix;
let u_ProjectionMatrix;
let u_ViewMatrix;
let u_Sampler0;
let u_Sampler1;
let u_whichTexture;

let g_selectedColor = [1.0, 1.0, 1.0, 1.0];
let g_yellowAngle = 0;
let g_yellowAngle2 = -45;
let g_blueAngle = 0;
let g_globalAngle = 0;
let g_lastX = 0;
let g_lastY = 0;
let g_x = 0;
let g_yAngle = 0;
let g_zAngle = 0;
let dragging = false;

let animation = false;
let SHAPE = 'POINT';
let g_segments = 10;
let camera;
let g_normalOn = false;
let g_lightOn = true;
let u_lightOn = true;
let g_lightPos = [-5, 1, -5];
let g_spotlightPos = [1, 2, 1];
let g_spotlightColor = [255 / 255, 0 / 255, 255 / 255, 1];
function setupWebGL() {
  canvas = document.querySelector('#canvas');
  //make the dimensions 80% of the window
  canvas.width = window.innerWidth * 0.8;
  canvas.height = window.innerHeight * 0.8;
  gl = getWebGLContext(canvas);
  gl.enable(gl.DEPTH_TEST);
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('failed to init shaders');
    return;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  u_cameraPos = gl.getUniformLocation(gl.program, 'u_cameraPos');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');

  u_lightOn = gl.getUniformLocation(gl.program, 'u_lightOn');
  u_lightPos = gl.getUniformLocation(gl.program, 'u_lightPos');
  u_spotLightPos = gl.getUniformLocation(gl.program, 'u_spotLightPos');
  u_lightColor = gl.getUniformLocation(gl.program, 'u_lightColor');



  const identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
}

function initTextures() {

  const image = new Image();
  image.onload = function () { sendTextureToGLSL0(image); };
  image.src = renderMandelbrot();

  const grass = new Image();
  grass.onload = function () { sendTextureToGLSL1(grass); };
  grass.src = getWater();
}

function sendTextureToGLSL0(image) {
  const texture = gl.createTexture();
  // flip the images y axis
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  // enable texture unit0
  gl.activeTexture(gl.TEXTURE0);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Set up the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // set up the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.uniform1i(u_Sampler0, 0)
}
function sendTextureToGLSL1(image) {
  const texture = gl.createTexture();
  // flip the images y axis
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  // enable texture unit0
  gl.activeTexture(gl.TEXTURE1);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Set up the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // set up the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.uniform1i(u_Sampler1, 1)
}
function setupUI() {
  document.getElementById('normalOn').onclick = function () { g_normalOn = !g_normalOn; };
  document.getElementById('lightOnButton').onclick = function () { g_lightOn = !g_lightOn; };
  document.getElementById('lightSlideX').value = g_lightPos[0]
  document.getElementById('lightSlideY').value = g_lightPos[1]
  document.getElementById('lightSlideZ').value = g_lightPos[2]
  document.getElementById('lightSlideX').addEventListener('mousemove', function (ev) { if (ev.buttons == 1) { g_lightPos[0] = this.value / 10; renderAllShapes(); } });
  document.getElementById('lightSlideY').addEventListener('mousemove', function (ev) { if (ev.buttons == 1) { g_lightPos[1] = this.value / 10; renderAllShapes(); } });
  document.getElementById('lightSlideZ').addEventListener('mousemove', function (ev) { if (ev.buttons == 1) { g_lightPos[2] = this.value / 10; renderAllShapes(); } });

  camera = new Camera();
  canvas.addEventListener('mousedown', (e) => {
    camera.beginRotate(e);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.scrollFactor += e.deltaY * -0.001;
    camera.beginRotate(e);
    camera.rotateCamera(e);
    camera.moving = false;

  })

  document.addEventListener('mousemove', (e) => {
    if (camera.moving && e.target === canvas) {
      camera.rotateCamera(e);
    }
  });

  canvas.addEventListener('mouseup', () => {
    camera.moving = false;
  });

  canvas.addEventListener('mouseenter', (e) => {
    camera.rotateCamera(e);
    if (!camera.moving) {
      camera.moving = false;
    }
  });

  document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) { // Use toLowerCase() to ensure case insensitivity
      case 'w':
        camera.moveDirection.forward = true;
        break;
      case 's':
        camera.moveDirection.back = true;
        break;
      case 'a':
        camera.moveDirection.left = true;
        break;
      case 'd':
        camera.moveDirection.right = true;
        break;
      case 'q':
        camera.moveDirection.rotateLeft = true;
        break;
      case 'e':
        camera.moveDirection.rotateRight = true;
        break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
      case 'w':
        camera.moveDirection.forward = false;
        break;
      case 's':
        camera.moveDirection.back = false;
        break;
      case 'a':
        camera.moveDirection.left = false;
        break;
      case 'd':
        camera.moveDirection.right = false;
        break;
      case 'q':
        camera.moveDirection.rotateLeft = false;
        break;
      case 'e':
        camera.moveDirection.rotateRight = false;
        break;
    }
  });
}
function main() {
  setupWebGL();
  // Initialize shaders
  connectVariablesToGLSL();
  initTextures();
  gl.clearColor(0.0, 0.5, 1.0, 1.0);
  setupUI();

  renderAllShapes();
  tick();
}


let time_since_last_frame = performance.now();
let lastUpdateTime = 0;
const updateInterval = 1000;
const fpsel = document.querySelector('#fps');
let time = 0;
function tick() {
  const now = performance.now();
  const delta = now - time_since_last_frame;
  time_since_last_frame = now;
  time += delta;
  const fps = 1000 / delta;
  if (now - lastUpdateTime > updateInterval) {
    fpsel.innerText = `ms: ${Math.round(delta)}\tFPS: ${Math.round(fps)}`;
    lastUpdateTime = now;
    Cube.updateColors();
  }
  renderAllShapes(delta, time);
  requestAnimationFrame(tick);
}

class Camera {
  constructor() {
    this.m = new Matrix4();
    this.angleX = 0;
    this.angleY = 0;
    this.angleZ = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.scrollFactor = 1;
    this.moving = false;
    this.position = [0, 0, -10];
    this.moveSpeed = 0.1;
    this.moveDirection = { forward: false, back: false, left: false, right: false, rotateLeft: false, rotateRight: false };
  }
  updatePosition() {
    if (this.moveDirection.forward) {
      this.position[2] += this.moveSpeed;
    }
    if (this.moveDirection.back) {
      this.position[2] -= this.moveSpeed;
    }
    if (this.moveDirection.left) {
      this.position[0] -= this.moveSpeed;
    }
    if (this.moveDirection.right) {
      this.position[0] += this.moveSpeed;
    }
    if (this.moveDirection.rotateLeft) {
      this.rotateLeft();
    }
    if (this.moveDirection.rotateRight) {
      this.rotateRight();
    }
  }
  convertMouseToEventCoords(e) {

    let x = e.clientX; // x coordinate of a mouse pointer
    let y = e.clientY; // y coordinate of a mouse pointer

    const rect = (e.target).getBoundingClientRect();

    x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2); // canvas dt 
    y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2); // canvas dt


    return ([x, y]);
  }

  rotateCamera(e) {
    if (!this.moving) return;

    const [x, y] = this.convertMouseToEventCoords(e);

    // Calculate angle changes
    let deltaX = (x - this.lastX) * 120; // Adjust sensitivity as needed
    let deltaY = (y - this.lastY) * 120;

    // Update angles based on the delta
    this.angleY += deltaX;
    this.angleX += deltaY;

    // Update the matrix
    this.m.setIdentity();
    this.m.rotate(this.angleX, 1, 0, 0);
    this.m.rotate(this.angleY, 0, 1, 0);
    this.m.rotate(this.angleZ, 0, 0, 1);
    this.m.scale(this.scrollFactor, this.scrollFactor, this.scrollFactor);

    // Save current positions for the next update
    this.lastX = x;
    this.lastY = y;

    // Update the uniform
    gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "u_GlobalRotateMatrix"), false, this.m.elements);
  }

  rotateLeft() {
    let x = this.lastX - 0.01;
    let y = this.lastY;
    let deltaX = (x - this.lastX) * 120; // Adjust sensitivity as needed
    let deltaY = (y - this.lastY) * 120;

    // Update angles based on the delta
    this.angleY += deltaX;
    this.angleX += deltaY;

    // Update the matrix
    this.m.setIdentity();
    this.m.rotate(this.angleX, 1, 0, 0);
    this.m.rotate(this.angleY, 0, 1, 0);
    this.m.rotate(this.angleZ, 0, 0, 1);
    this.m.scale(this.scrollFactor, this.scrollFactor, this.scrollFactor);

    // Save current positions for the next update
    this.lastX = x;
    this.lastY = y;

    // Update the uniform
    gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "u_GlobalRotateMatrix"), false, this.m.elements);
  }

  rotateRight() {
    let x = this.lastX + 0.01;
    let y = this.lastY;
    let deltaX = (x - this.lastX) * 120; // Adjust sensitivity as needed
    let deltaY = (y - this.lastY) * 120;

    // Update angles based on the delta
    this.angleY += deltaX;
    this.angleX += deltaY;

    // Update the matrix
    this.m.setIdentity();
    this.m.rotate(this.angleX, 1, 0, 0);
    this.m.rotate(this.angleY, 0, 1, 0);
    this.m.rotate(this.angleZ, 0, 0, 1);
    this.m.scale(this.scrollFactor, this.scrollFactor, this.scrollFactor);

    // Save current positions for the next update
    this.lastX = x;
    this.lastY = y;

    // Update the uniform
    gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "u_GlobalRotateMatrix"), false, this.m.elements);
  }


  beginRotate(e) {
    this.moving = true;
    [this.lastX, this.lastY] = this.convertMouseToEventCoords(e);
  }
}


function renderAllShapes(delta, time) {

  camera.updatePosition();


  const projMat = new Matrix4();
  projMat.setPerspective(60, canvas.width / canvas.height, 1, 100);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMat.elements);

  const viewMat = new Matrix4();
  viewMat.lookAt(camera.position[0], camera.position[1], camera.position[2], 0, 0, 0, 0, 1, 0);

  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMat.elements);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, camera.m.elements);

  let lightoffset_x = Math.sin(time / 1000)
  let lightoffset_z = Math.cos(time / 1000)
  gl.uniform3f(u_lightPos, g_lightPos[0] + lightoffset_x, g_lightPos[1], g_lightPos[2] + lightoffset_z);

  gl.uniform3f(u_cameraPos, camera.position[0], camera.position[1], camera.position[2]);

  gl.uniform1i(u_lightOn, g_lightOn);

  gl.uniform3f(u_spotLightPos, g_spotlightPos[0], g_spotlightPos[1], g_spotlightPos[2]);

  const light = new Cube();
  light.color = [2, 2, 0, 1];
  
  light.matrix.scale(0.5, 0.5, 0.5);
  light.matrix.translate(g_lightPos[0] + lightoffset_x, g_lightPos[1], g_lightPos[2] + lightoffset_z);
  
  light.textureNum = -3
  light.render();

  const spotlight = new Cube();
  spotlight.color = g_spotlightColor;
  spotlight.matrix.translate(g_spotlightPos[0], g_spotlightPos[1], g_spotlightPos[2]);
  spotlight.matrix.scale(0.5, 0.5, 0.5);
  spotlight.matrix.translate(2, -0.5, 1);
  spotlight.textureNum = -3
  spotlight.render();

  const ground = new Cube();
  ground.color = [1, 0, 0, 1];
  ground.matrix.translate(0, -2, 0);
  ground.matrix.scale(50, 1, 50);
  ground.matrix.translate(-.5, 0, -.5);
  ground.renderLerp(delta);

  const sphere = new Sphere();
  sphere.color = [1.0, 0.0, 0.0, 1.0];
  sphere.matrix.translate(-2.5, .5, 0.0);
  sphere.render();


  // Skybox
  const sky = new Cube();
  sky.color = [1, 0, 0, 1];
  if (g_normalOn) {
    sky.textureNum = -3;
  } else {
    sky.textureNum = 0;
  }
  sky.matrix.scale(50, 50, 50);
  sky.matrix.translate(-.5, -.5, -.5);
  if (g_normalOn) {
    sky.renderFaster();
  } else {
    sky.render();
  }




}




main();