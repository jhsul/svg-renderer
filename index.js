/**
 * Global variables
 */

// The current XML tree as parsed by the DOMParser
let svg = null;

// WebGL context
let gl = null;

// The zoom level (bounded by 0.1 and 10)
let zoom = 1;

/**
 * Initial WebGL setup
 * Do not render anything at this point
 */
const main = () => {
  const canvas = $("#webgl")[0];
  //console.log(canvas);
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
 * Handles the uploading and parsing of files
 */
const fileHandler = () => {
  console.log("File uploaded");
  const file = $("#upload")[0].files[0];

  if (file) {
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = (e) => {
      const text = e.target.result;
      const parser = new DOMParser();
      svg = parser.parseFromString(text, "text/xml");

      renderSvg(svg);
    };
    reader.onerror = (e) => {
      console.log("Some error reading the file");
    };
  }
};

const renderSvg = (svg) => {
  setCoordinateTransform(svg);
  drawPoints(svg);

  console.log(svg);

  //lines.forEach(renderLine);
};

const drawPoints = (svg) => {
  const lines = [...svg.getElementsByTagName("line")];
  const points = [];

  //const color = gl.getUniformLocation(program, "fColor");
  //gl.uniform4fv(color, flatten(vec4(0, 0, 0, 1)));

  lines.forEach((line) => {
    const x1 = parseFloat(line.getAttribute("x1"));
    const y1 = parseFloat(line.getAttribute("y1"));

    const x2 = parseFloat(line.getAttribute("x2"));
    const y2 = parseFloat(line.getAttribute("y2"));

    console.log({ x1, y1, x2, y2 });
    points.push(vec4(x1, y1, 0, 1));
    points.push(vec4(x2, y2, 0, 1));
  });

  const pBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

  const vPosition = gl.getAttribLocation(program, "vPosition");
  gl.enableVertexAttribArray(vPosition);
  gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.drawArrays(gl.LINES, 0, points.length);
};

const setCoordinateTransform = (svg) => {
  // Remove the unnecessary stuff like the prototype

  const { x, y, width, height } =
    svg.getElementsByTagName("svg")[0].viewBox.baseVal;

  const matrix = ortho(x, x + width, y + height, y, 1, -1);

  console.log("Setting coordinate transform matrix: ");
  console.log(matrix);

  const coordinateTransform = gl.getUniformLocation(
    program,
    "coordinateTransform"
  );
  gl.uniformMatrix4fv(coordinateTransform, false, flatten(matrix));
};
