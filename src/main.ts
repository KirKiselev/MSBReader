import MSBReader from "./MSBReader";
import { MSBModel } from "./MSBReader";
import { mat4, vec3 } from "gl-matrix";

//////////////////////////////////////////////////////////////////////////////////////////

let materialAtlas = new Map<string, number>();
let images = new Map<string, ImageBitmap>();
let textures = new Map<string, WebGLTexture>();

let VSHADER_SOURCE =
  "attribute vec4 a_Position;\n" +
  "attribute vec4 a_Normal;\n" +
  "attribute vec2 a_TexCoord;\n" +
  "uniform mat4 u_MvpMatrix;\n" +
  "uniform mat4 u_mMatrix;\n" +
  "uniform mat4 u_NormalMatrix;\n" +
  "uniform vec3 u_ambientLightColor;\n" +
  "uniform vec3 u_directionalLightColor;\n" +
  "uniform vec3 u_LightDirection;\n" +
  "uniform float u_ambientLightPower;\n" +
  "uniform float u_directionalLightPower;\n" +
  "uniform float u_diffusalLightPower;\n" +
  "uniform vec3 u_diffusalLightPosition;\n" +
  "uniform vec3 u_diffusalLightColor;\n" +
  "varying vec2 v_TexCoord;\n" +
  "varying vec4 v_lightIntense;\n" +
  "void main() {\n" +
  " gl_Position = u_MvpMatrix * u_mMatrix * a_Position;\n" +
  " v_TexCoord = a_TexCoord;\n" +
  " vec3 normal = normalize(vec3(u_NormalMatrix * a_Normal));\n" +
  //direction light
  " float nDotL = max(dot(u_LightDirection, normal), 0.0);\n" +
  " vec3 directional = u_directionalLightColor * nDotL * u_directionalLightPower;\n" +
  // diffusal light
  " vec3 diffusalLightDirection = normalize(u_diffusalLightPosition - vec3(a_Position));\n" +
  " nDotL = max(dot(diffusalLightDirection, normal), 0.0);\n" +
  " vec3 diffuse = u_diffusalLightColor * nDotL * u_diffusalLightPower;\n" +
  //ambient light
  " vec3 ambient = u_ambientLightColor * u_ambientLightPower;\n" +
  " v_lightIntense = vec4(directional + diffuse + ambient, 1.0);\n" +
  "}\n";

let FSHADER_SOURCE =
  "#ifdef GL_ES\n" +
  ////////////////////////////////////////////////////////////////////////////////
  "precision mediump float;\n" +
  "#endif\n" +
  "uniform sampler2D u_Sampler;\n" +
  "varying vec2 v_TexCoord;\n" +
  "varying vec4 v_lightIntense;\n" +
  "void main() {\n" +
  " gl_FragColor = texture2D(u_Sampler, v_TexCoord) * v_lightIntense;\n" +
  "}\n";

let vShader: WebGLShader;
let fShader: WebGLShader;
//@ts-ignore
let program: WebGLProgram | null | undefined;

let lightDirection = vec3.create();
vec3.set(lightDirection, 1.0, 0.0, 0.0);
vec3.normalize(lightDirection, lightDirection);

let directionaLightColor = vec3.create();
vec3.set(directionaLightColor, 1.0, 1.0, 1.0);
let ambientLightColor = vec3.create();
vec3.set(ambientLightColor, 1.0, 1.0, 1.0);
let diffusalLightColor = vec3.create();
vec3.set(diffusalLightColor, 1.0, 1.0, 1.0);
let diffusalLightPosition = vec3.create();
vec3.set(diffusalLightPosition, -5.0, 5.0, 5.0);

let ambientLightPower = 0.0;
let directionalLightPower = 0.0;
let diffusalLightPower = 1.0;

let a_Position: WebGLUniformLocation;
let a_TexCoord: WebGLUniformLocation;
let a_Normal: WebGLUniformLocation;
let u_MvpMatrix: WebGLUniformLocation;
let u_mMatrix: WebGLUniformLocation;
let u_Sampler: WebGLUniformLocation;
let u_ambientLightColor: WebGLUniformLocation;
let u_directionalLightColor: WebGLUniformLocation;
let u_LightDirection: WebGLUniformLocation;
let u_diffusalLightColor: WebGLUniformLocation;
let u_NormalMatrix: WebGLUniformLocation;
let u_ambientLightPower: WebGLUniformLocation;
let u_directionalLightPower: WebGLUniformLocation;
let u_diffusalLightPower: WebGLUniformLocation;
let u_diffusalLightPosition: WebGLUniformLocation;

let vertexBuffer: WebGLVertexArrayObject;
let vertexTexCoordBuffer: WebGLVertexArrayObject;
let indexBuffer: WebGLVertexArrayObject;
let normalBuffer: WebGLVertexArrayObject;

let vpMatrix = mat4.create();
let vMatrix = mat4.create();
let pMatrix = mat4.create();
let mMatrix = mat4.create();
let normalMatrix = mat4.create();

let eye = vec3.create();
let center = vec3.create();
let up = vec3.create();

let prevX = 0;
let prevY = 0;

let modelRotation = { x: 0, y: 0 };

let model: MSBModel;

let canvas = document.getElementById("canvas");
//@ts-ignore
let aspectRatio = canvas.width / canvas.height;
//@ts-ignore
let gl = canvas.getContext("webgl");

/////////////////////////////////////////////////////////////////////////////////////////

//@ts-ignore
function createShader(context, shaderType, source) {
  let shader = context.createShader(shaderType);
  if (shader == null) {
    console.log("unable to create shader");
    return null;
  }
  context.shaderSource(shader, source);
  context.compileShader(shader);

  let compiled = context.getShaderParameter(shader, context.COMPILE_STATUS);
  if (!compiled) {
    let error = context.getShaderInfoLog(shader);
    console.log("Failed to compile shader: " + error);
    context.deleteShader(shader);
    return null;
  }

  return shader;
}
//@ts-ignore
function createProgram(context, vshader, fshader) {
  let program = context.createProgram();
  if (!program) {
    return null;
  }

  context.attachShader(program, vshader);
  context.attachShader(program, fshader);

  context.linkProgram(program);

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    console.log("Failed to link program: " + context.getProgramInfoLog(program));
    context.deleteProgram(program);
    context.deleteShader(vshader);
    context.deleteShader(fshader);
    return null;
  }

  context.useProgram(program);
  context.program = program;
}

const input = document.getElementById("file_input");

if (input) {
  input.onchange = () => {
    //@ts-ignore
    model = MSBReader(input.files[0]);
    console.log(model);
  };
}

function getUniqueMaterials() {
  let counter = 0;
  model.materials.forEach((material) => {
    if (!materialAtlas.has(material[0])) {
      materialAtlas.set(material[0], counter);
      counter++;
    }

    if (material[1] !== undefined) {
      if (!materialAtlas.has(material[1])) {
        materialAtlas.set(material[1], counter);
        counter++;
      }
    }
  });
}
const startbutton = document.getElementById("start");
if (startbutton) {
  startbutton.onclick = () => {
    getUniqueMaterials();

    let promises: Array<Promise<any>> = [];

    //@ts-ignore
    materialAtlas.forEach((value, materialName, map) => {
      promises.push(
        fetch(`./${materialName}.png`)
          .then((response) => response.blob())
          .then((blob) => createImageBitmap(blob))
          .then((imgBitmap) => images.set(materialName, imgBitmap))
      );
    });

    Promise.all(promises)
      .then(() => {
        materialAtlas.forEach((value, materialName) => {
          gl.activeTexture(gl.TEXTURE0 + value);
          textures.set(materialName, gl.createTexture());
          gl.bindTexture(gl.TEXTURE_2D, textures.get(materialName));
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          //@ts-ignore
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images.get(materialName));
        });
      })
      .then(() => {
        draw();
      });
  };
}

vShader = createShader(gl, gl.VERTEX_SHADER, VSHADER_SOURCE);
fShader = createShader(gl, gl.FRAGMENT_SHADER, FSHADER_SOURCE);

program = createProgram(gl, vShader, fShader);

vec3.set(eye, 0, 0, 60);
vec3.set(center, 0, 0, -100);
vec3.set(up, 0, 1, 0);

mat4.lookAt(vMatrix, eye, center, up);
mat4.perspective(pMatrix, (45 * Math.PI) / 180, aspectRatio, 1, 2000);

mat4.multiply(vpMatrix, pMatrix, vMatrix);

gl.clearColor(0.5, 0.5, 0.5, 1.0);
gl.enable(gl.DEPTH_TEST);

a_Position = gl.getAttribLocation(gl.program, "a_Position");
a_TexCoord = gl.getAttribLocation(gl.program, "a_TexCoord");

u_MvpMatrix = gl.getUniformLocation(gl.program, "u_MvpMatrix");
u_mMatrix = gl.getUniformLocation(gl.program, "u_mMatrix");

u_ambientLightColor = gl.getUniformLocation(gl.program, "u_ambientLightColor");
u_diffusalLightColor = gl.getUniformLocation(gl.program, "u_diffusalLightColor");
u_directionalLightColor = gl.getUniformLocation(gl.program, "u_directionalLightColor");
u_LightDirection = gl.getUniformLocation(gl.program, "u_LightDirection");
u_ambientLightPower = gl.getUniformLocation(gl.program, "u_ambientLightPower");
u_directionalLightPower = gl.getUniformLocation(gl.program, "u_directionalLightPower");
u_diffusalLightPower = gl.getUniformLocation(gl.program, "u_diffusalLightPower");
u_diffusalLightPosition = gl.getUniformLocation(gl.program, "u_diffusalLightPosition");

u_NormalMatrix = gl.getUniformLocation(gl.program, "u_NormalMatrix");

u_Sampler = gl.getUniformLocation(gl.program, "u_Sampler");

let str;
let last;

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.clear(gl.DEPTH_BUFFER_BIT);

  mMatrix = mat4.create();
  mat4.rotateX(mMatrix, mMatrix, (modelRotation.x * Math.PI) / 180);
  mat4.rotateY(mMatrix, mMatrix, (modelRotation.y * Math.PI) / 180);

  mat4.invert(normalMatrix, mMatrix);
  mat4.transpose(normalMatrix, normalMatrix);

  if (model) {
    for (let n = 0; n < model.vertices.length - 1; n++) {
      str = model.materials[n][0];
      last = materialAtlas.get(str);

      gl.uniform3fv(u_ambientLightColor, ambientLightColor);
      gl.uniform3fv(u_directionalLightColor, directionaLightColor);
      gl.uniform3fv(u_diffusalLightColor, diffusalLightColor);
      gl.uniform1f(u_ambientLightPower, ambientLightPower);
      gl.uniform1f(u_directionalLightPower, directionalLightPower);
      gl.uniform1f(u_diffusalLightPower, diffusalLightPower);

      gl.uniform3fv(u_LightDirection, lightDirection);
      gl.uniform3fv(u_diffusalLightPosition, diffusalLightPosition);

      gl.uniform1i(u_Sampler, last);

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, model.vertices[n], gl.STATIC_DRAW);

      gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(a_Position);

      vertexTexCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexTexCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, model.uvs[n], gl.STATIC_DRAW);

      gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(a_TexCoord);

      normalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, model.normals[n], gl.STATIC_DRAW);

      a_Normal = gl.getAttribLocation(gl.program, "a_Normal");
      gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(a_Normal);

      indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices[n], gl.STATIC_DRAW);

      gl.uniformMatrix4fv(u_MvpMatrix, false, vpMatrix);

      gl.uniformMatrix4fv(u_mMatrix, false, mMatrix);

      gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix);

      gl.drawElements(gl.TRIANGLES, model.indices[n].length, gl.UNSIGNED_SHORT, 0);
    }
  }

  requestAnimationFrame(draw);
}

//////////////////////////////////////////////////////////////////////////////////////

window.addEventListener("wheel", (ev) => {
  if (ev.deltaY > 0) {
    vec3.set(eye, eye[0], eye[1], eye[2] - 1);
  } else {
    vec3.set(eye, eye[0], eye[1], eye[2] + 1);
  }

  mat4.lookAt(vMatrix, eye, center, up);
  mat4.multiply(vpMatrix, pMatrix, vMatrix);
});

document.addEventListener("mousemove", (ev) => {
  if (prevX == 0) {
    prevX = ev.x;
  }
  if (prevY == 0) {
    prevY = ev.y;
  }

  modelRotation.y += ev.x - prevX;
  modelRotation.x += ev.y - prevY;

  prevX = ev.x;
  prevY = ev.y;
});
