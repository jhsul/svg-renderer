/**
 * Global variables
 */

const CANVAS_SIZE = 600;

// The current XML tree as parsed by the DOMParser
let svg = null;

// WebGL context
let gl = null;

// The zoom level (bounded by 0.1 and 10)
let zoom = 1;

// Canvas HTML element
let canvas = null;

// States associated with the dragging mechanic
let isDragging = false;
let dragPosition = { x: 0, y: 0 };
let prevPosition = { x: 0, y: 0 };

//let translateMatrix = translate(0, 0, 0);

/**
 * Initial WebGL setup
 * Do not render anything at this point
 */
const main = () => {
  // Setup the canvas object
  canvas = document.getElementById("webgl");

  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  canvas.addEventListener("wheel", scrollHandler, false);
  canvas.addEventListener("mousedown", downHandler, false);
  canvas.addEventListener("mousemove", moveHandler, false);
  canvas.addEventListener("mouseup", upHandler, false);

  // WebGL boilerplate
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    console.log("Failed to get the rendering context for WebGL");
    return;
  }
  program = initShaders(gl, "vshader", "fshader");

  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);
};

/**
 * Handles scrolling events in the canvas
 */
const scrollHandler = (e) => {
  if (!svg) return true; // Don't do anything if there is no SVG loaded

  const { deltaY } = e;
  const scrollScale = 10;

  // Zoom is bounded on [0.1, 10]
  if (deltaY > 0) {
    zoom = Math.min(zoom + deltaY / scrollScale, 10);
  } else {
    zoom = Math.max(zoom + deltaY / scrollScale, 0.1);
  }
  setZoomTransform();
  renderSvg();
  e.preventDefault();
};

/**
 * Helper function that calculates the cursor position relative to the canvas for mouse events
 */
const cursorPosition = (e) => {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};

/**
 * Handles click events in the canvas
 */
const downHandler = (e) => {
  isDragging = true;
  //console.log(cursorPosition(e));
  dragPosition = cursorPosition(e);
  e.preventDefault();
};

/**
 * Helper that makes adjustments to raw mouse event coordinates
 */
const normalizeCoords = (pos) => {
  const x =
    (2 * (pos.x - dragPosition.x)) / (canvas.width * zoom) + prevPosition.x;
  const y =
    (-2 * (pos.y - dragPosition.y)) / (canvas.height * zoom) + prevPosition.y;

  return { x, y };
};

/**
 * Handles mouse movement events in the canvas
 */
const moveHandler = (e) => {
  if (!isDragging) return true;

  const pos = cursorPosition(e);

  const { x, y } = normalizeCoords(pos);

  const translateMatrix = translate(x, y, 0);

  const translateTransform = gl.getUniformLocation(
    program,
    "translateTransform"
  );
  gl.uniformMatrix4fv(translateTransform, false, flatten(translateMatrix));

  renderSvg();
};

const upHandler = (e) => {
  if (!isDragging) return true;
  isDragging = false;

  const pos = cursorPosition(e);

  const { x, y } = normalizeCoords(pos);

  prevPosition = { x, y };
};

/**
 * Handles the uploading and parsing of files
 */
const fileHandler = () => {
  const file = document.getElementById("upload").files[0];

  if (file) {
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = (e) => {
      const text = e.target.result;
      const parser = new DOMParser();
      svg = parser.parseFromString(text, "text/xml");
      console.log(svg);
      setAllTransforms();
      renderSvg();
    };
    reader.onerror = (e) => {
      console.log("Some error reading the file");
    };
  }
};

const renderSvg = () => {
  if (!svg) return null;

  const lines = [...svg.getElementsByTagName("line")];
  const points = [];
  const colors = [];

  //const color = gl.getUniformLocation(program, "fColor");
  //gl.uniform4fv(color, flatten(vec4(0, 0, 0, 1)));
  lines.forEach((line) => {
    const x1 = parseFloat(line.getAttribute("x1"));
    const y1 = parseFloat(line.getAttribute("y1"));

    const x2 = parseFloat(line.getAttribute("x2"));
    const y2 = parseFloat(line.getAttribute("y2"));

    //const color = line.getAttribute("stroke")
    // ? parseInt(`0x${line.getAttribute("stroke").substring(1)}`)
    //  : 0;
    //console.log(color);

    //console.log({ x1, y1, x2, y2 });
    points.push(vec4(x1, y1, 0, 1));
    points.push(vec4(x2, y2, 0, 1));

    colors.push(vec4(1, 0, 0, 1));
    colors.push(vec4(1, 0, 0, 1));
    //colors.push(vec4(color & 0xff0000, color & 0x00ff00, color & 0x0000ff, 1));
  });

  const pBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

  const vPosition = gl.getAttribLocation(program, "vPosition");
  gl.enableVertexAttribArray(vPosition);
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

  const cBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

  const vColor = gl.getAttribLocation(program, "vColor");
  gl.enableVertexAttribArray(vColor);
  gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.drawArrays(gl.LINES, 0, points.length);
};

const setZoomTransform = () => {
  const zoomMatrix = scalem(zoom, zoom, zoom);
  const zoomTransform = gl.getUniformLocation(program, "zoomTransform");
  gl.uniformMatrix4fv(zoomTransform, false, flatten(zoomMatrix));
};

const setOrthoTransform = () => {
  const { x, y, width, height } =
    svg.getElementsByTagName("svg")[0].viewBox.baseVal;

  const orthoMatrix = ortho(x, x + width, y + height, y, 1, -1);
  const orthoTransform = gl.getUniformLocation(program, "orthoTransform");
  gl.uniformMatrix4fv(orthoTransform, false, flatten(orthoMatrix));
};

const setTranslateTransform = () => {
  const translateMatrix = translate(0, 0, 0);
  const translateTransform = gl.getUniformLocation(
    program,
    "translateTransform"
  );
  gl.uniformMatrix4fv(translateTransform, false, flatten(translateMatrix));
};

const setAllTransforms = () => {
  setZoomTransform();
  setOrthoTransform();
  setTranslateTransform();
};
