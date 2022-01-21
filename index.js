const main = () => {};

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
      const svg = parser.parseFromString(text, "text/xml");

      renderSvg(svg);
    };
    reader.onerror = (e) => {
      console.log("Some error reading the file");
    };
  }
};

const renderSvg = (svg) => {
  console.log(getViewBox(svg));
};

const getViewBox = (svg) => {
  return svg.getElementsByTagName("svg")[0].viewBox.baseVal;
};
