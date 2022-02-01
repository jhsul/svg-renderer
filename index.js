/**
 * January 31, 2022
 * Jack Sullivan
 * CS 4731 Project 1
 *
 * This is my submission for project 1. A live demo is available on github:
 * https://jhsul.github.io/svg-renderer/
 *
 * Extra credit:
 * -------------
 * I implemented an export feature which will save the svg along with any
 * user created lines. You can save it with the export button. If there is
 * no svg loaded, then it will not do anything.
 *
 * My zoom functionality also will always follow the cursor. I'm not sure if
 * what I have counts as extra credit as per the email that was sent out, but
 * I figured I'd mention it.
 */

// Constants
const CANVAS_SIZE = 600;
const SCROLL_SCALE = 500; // smaller = more sensitive

// The current XML tree as parsed by the DOMParser
let svg = null;

// WebGL context
let gl = null;

// Canvas HTML element
let canvas = null;

// SVG worldspace
let viewBox = null;
let originalViewBox = null;

// States associated with the dragging mechanic
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// Current point for user drawing
let userPoint = null;
let userEnd = null;
let userLines = [];

/**
 * Initial WebGL setup
 * Do not render anything at this point
 */
const main = () => {
  // Setup the canvas object
  canvas = document.getElementById("webgl");

  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  // Canvas event listeners
  canvas.addEventListener("wheel", scrollHandler, false);
  canvas.addEventListener("mousedown", downHandler, false);
  canvas.addEventListener("mousemove", moveHandler, false);
  canvas.addEventListener("mouseup", upHandler, false);
  canvas.addEventListener("contextmenu", rightClickHandler, false);

  // Reset button event listener
  const body = document.getElementsByTagName("body")[0];
  body.addEventListener("keypress", resetHandler, false);

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
  if (!svg) return true;

  const { deltaY } = e;
  const pos = cursorPosition(e);

  // Zoom is bounded on [0.1, 10]
  const zoom = 1 - deltaY / SCROLL_SCALE;

  // Cap the zoom between 0.1 and 10
  const lowerBound = 0.1 * originalViewBox.size;
  const upperBound = 10 * originalViewBox.size;

  const newSize = Math.min(
    upperBound,
    Math.max(lowerBound, viewBox.size / zoom)
  );

  // How far the viewbox needs to be shifted to "focus" on the mouse
  const offset = {
    x: pos.x - viewBox.x,
    y: pos.y - viewBox.y,
  };

  viewBox = {
    x: pos.x - (offset.x / viewBox.size) * newSize,
    y: pos.y - (offset.y / viewBox.size) * newSize,
    size: newSize,
  };

  setTransform();
  draw();
  e.preventDefault();
};

/**
 * Helper function that calculates cursor position from mouse events
 * It returns the mouse's coordinates in the SVG viewbox
 */
const cursorPosition = (e) => {
  const rect = canvas.getBoundingClientRect();
  const canvasPos = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };

  const svgPos = {
    x: (viewBox.size / CANVAS_SIZE) * canvasPos.x + viewBox.x,
    y: (viewBox.size / CANVAS_SIZE) * canvasPos.y + viewBox.y,
  };

  return svgPos;
};

/**
 * Left click down event (begin dragging)
 */
const downHandler = (e) => {
  if (!svg || e.which !== 1) return true;
  isDragging = true;
  const pos = cursorPosition(e);
  dragStart = pos;
  console.log(pos);
  e.preventDefault();
};

/**
 * Mouse movement handler for canvas
 */
const moveHandler = (e) => {
  if (!svg) return true;
  const pos = cursorPosition(e);
  if (isDragging) {
    viewBox = {
      x: viewBox.x - pos.x + dragStart.x,
      y: viewBox.y - pos.y + dragStart.y,
      size: viewBox.size,
    };
    setTransform();
    draw();
  } else {
    if (userPoint) {
      userEnd = pos;
      draw();
    }
  }
};

/**
 * Left click release event (stop dragging)
 */
const upHandler = (e) => {
  if (!isDragging || e.which !== 1) return false;
  isDragging = false;
  return false;
};

/**
 * Right click mouse event (draw points)
 */
const rightClickHandler = (e) => {
  if (!svg) return false;
  const pos = cursorPosition(e);
  if (userPoint) {
    userLines.push([userPoint, pos]);
    userPoint = null;
    draw();
  } else {
    userPoint = pos;
  }

  e.preventDefault();
  return false;
};

/**
 * Reset the viewbox
 */
const resetHandler = (e) => {
  if (e.key !== "r") return false;
  viewBox = originalViewBox;
  setTransform();
  draw();
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

      const { x, y, width, height } = svg.getElementsByTagName("svg")[0].viewBox
        ? svg.getElementsByTagName("svg")[0].viewBox.baseVal
        : { x: 0, y: 0, width: CANVAS_SIZE, height: CANVAS_SIZE };

      const size = Math.max(width, height);
      originalViewBox = { x, y, size };
      viewBox = originalViewBox;

      console.log(svg);
      document.getElementById("export").removeAttribute("disabled");

      setTransform();
      draw();
    };
    reader.onerror = (e) => {
      console.log("Some error reading the file");
    };
  }
};

/**
 * Exports the currently loaded svg along with any user defined lines
 */
const exportHandler = async () => {
  if (!svg) return false;

  const root = svg.getElementsByTagName("svg")[0];
  userLines.forEach(([pointA, pointB]) => {
    const line = svg.createElement("line");
    line.setAttribute("x1", pointA.x.toString());
    line.setAttribute("y1", pointA.y.toString());

    line.setAttribute("x2", pointB.x.toString());
    line.setAttribute("y2", pointB.y.toString());

    line.setAttribute("stroke", "#000000");
    line.setAttribute("stroke-width", ".1%");
    root.appendChild(line);
  });
  const serializer = new XMLSerializer();
  const xmlString = serializer.serializeToString(svg);

  const blob = new Blob([xmlString], { type: "text/xml" });

  const fileHandle = await window.showSaveFilePicker({
    types: [
      { description: "Your SVG file", accept: { "text/plain": [".svg"] } },
    ],
  });
  const fileStream = await fileHandle.createWritable();

  await fileStream.write(blob);
  await fileStream.close();
};

/**
 * Draws all user defined lines and the base svg image
 */
const draw = () => {
  if (!svg) return null;

  const lines = [...svg.getElementsByTagName("line")];

  const points = [];
  const colors = [];

  lines.forEach((line) => {
    const x1 = parseFloat(line.getAttribute("x1"));
    const y1 = parseFloat(line.getAttribute("y1"));

    const x2 = parseFloat(line.getAttribute("x2"));
    const y2 = parseFloat(line.getAttribute("y2"));

    const color = line.getAttribute("stroke")
      ? parseInt(line.getAttribute("stroke").substring(1), 16)
      : 0;
    const colorVec = vec4(
      ((color & 0xff0000) >> 16) / 256,
      ((color & 0x00ff00) >> 8) / 256,
      (color & 0x0000ff) / 256,
      1
    );

    points.push(vec4(x1, y1, 0, 1));
    points.push(vec4(x2, y2, 0, 1));

    colors.push(colorVec);
    colors.push(colorVec);
  });

  userLines.forEach(([pointA, pointB]) => {
    points.push(vec4(pointA.x, pointA.y, 0, 1));
    points.push(vec4(pointB.x, pointB.y, 0, 1));

    colors.push(vec4(0, 0, 0, 1));
    colors.push(vec4(0, 0, 0, 1));
  });

  if (userPoint && userEnd) {
    points.push(vec4(userPoint.x, userPoint.y, 0, 1));
    points.push(vec4(userEnd.x, userEnd.y, 0, 1));

    colors.push(vec4(1, 0, 0, 1));
    colors.push(vec4(1, 0, 0, 1));
  }

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

/**
 * Set the transform matrix based on the current viewbox
 */
const setTransform = () => {
  const { x, y, size } = viewBox;

  const orthoMatrix = ortho(x, x + size, y + size, y, 1, -1);
  const orthoTransform = gl.getUniformLocation(program, "orthoTransform");
  gl.uniformMatrix4fv(orthoTransform, false, flatten(orthoMatrix));
};
